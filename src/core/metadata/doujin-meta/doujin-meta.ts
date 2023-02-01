import Axios from 'axios'
import Fuse from 'fuse.js'
import { localJson } from '../local-json/local-json'
import { Metadata } from '../metadata'
import { MetadataSource } from '../metadata-source'

const owner = 'the1812'
const repo = 'Doujin-Meta'
const githubApi = Axios.create({
  headers: {
    Accept: 'application/vnd.github+json',
  },
  responseType: 'json',
})

interface GitTreeNode {
  path: string
  mode: string
  type: string
  sha: string
  url: string
}
interface TreeResponse {
  sha: string
  url: string
  tree: GitTreeNode[]
}
interface BlobResponse {
  sha: string
  url: string
  size: number
  content: string
  encoding: string
}

const goToFolder = async (path: string) => {
  const mainTreeApi = `https://api.github.com/repos/${owner}/${repo}/git/trees/main`
  const { data: mainTree } = await githubApi.get<TreeResponse>(mainTreeApi)
  const segments = path.split('/')
  let currentTree = mainTree
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    if (!segment) {
      continue
    }
    const nextFolder = currentTree.tree.find(it => it.path === segment)
    if (!nextFolder) {
      throw new Error(`获取 ${segment} 文件夹失败`)
    }
    const { data: nextTree } = await githubApi.get<TreeResponse>(nextFolder.url)
    currentTree = nextTree
  }
  return currentTree
}

export class DoujinMeta extends MetadataSource {
  private dataTree: Promise<TreeResponse>
  private fuse: Promise<Fuse<GitTreeNode>>

  private getDataTree() {
    return goToFolder('public/data')
  }

  private init() {
    this.dataTree = this.getDataTree()
    this.fuse = this.dataTree.then(({ tree }) => new Fuse(tree, {
      keys: ['path'],
      threshold: 0.4,
    }))
  }

  private checkInitStatus() {
    if (!this.dataTree) {
      this.init()
    }
  }

  private async findCover(nodes: GitTreeNode[]) {
    const allowedExtensions = ['.jpg', '.png']
    const result = nodes.find(it => allowedExtensions.some(extension => it.path === `cover${extension}`))
    if (!result) {
      return undefined
    }
    const { data: coverData } = await githubApi.get<BlobResponse>(result.url)
    return Buffer.from(coverData.content, 'base64')
  }

  async resolveAlbumName(albumName: string): Promise<string | string[]> {
    this.checkInitStatus()
    const fuse = await this.fuse
    const result = fuse.search(albumName)
    if (result.length === 1) {
      return result[0].item.path
    }
    return result.map(it => it.item.path).slice(0, 20)
  }

  async getMetadata(albumName: string, cover?: Buffer): Promise<Metadata[]> {
    this.checkInitStatus()
    const { tree } = await this.dataTree
    const node = tree.find(it => it.path === albumName)
    if (!node) {
      throw new Error(`data 目录中不存在 "${albumName}"`)
    }
    const { data: albumDetailTree } = await githubApi.get<TreeResponse>(node.url)
    const coverBuffer = cover ?? await this.findCover(albumDetailTree.tree)
    const metadataNode = albumDetailTree.tree.find(it => it.path === 'metadata.json')
    if (!metadataNode) {
      throw new Error(`${albumName} 元数据缺失`)
    }
    const { data: metadataTree } = await githubApi.get<BlobResponse>(metadataNode.url)
    const metadataJson: Metadata[] = JSON.parse(Buffer.from(metadataTree.content, 'base64').toString('utf8'))
    return localJson.normalize(metadataJson, coverBuffer)
  }
}
export const doujinMeta = new DoujinMeta()
