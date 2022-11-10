"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mp3Writer = exports.Mp3Writer = void 0;
const metadata_writer_1 = require("../metadata-writer");
const node_id3_1 = __importDefault(require("../../node-id3"));
const languageCodeConvert = (code) => {
    const mapping = {
        ja: 'jpn',
        de: 'deu',
        zh: 'zho'
    };
    return code ? (mapping[code] || 'jpn') : 'jpn';
};
const getNodeId3Tag = (metadata, separator) => {
    const tag = {
        title: metadata.title,
        artist: metadata.artists.join(separator),
        album: metadata.album,
        partOfSet: metadata.discNumber,
        trackNumber: metadata.trackNumber,
        composer: metadata.composers ? metadata.composers.join(separator) : '',
        genre: metadata.genres ? metadata.genres.join(separator) : '',
        year: metadata.year || '',
        textWriter: metadata.lyricists ? metadata.lyricists.join(separator) : '',
        performerInfo: metadata.albumArtists ? metadata.albumArtists.join(separator) : '',
        comment: {
            text: metadata.comments || '',
        },
        unsynchronisedLyrics: {
            language: languageCodeConvert(metadata.lyricLanguage),
            text: metadata.lyric || '',
        },
        TSOA: metadata.albumOrder,
    };
    if (metadata.coverImage) {
        tag.image = {
            type: {
                id: 3,
                name: 'front cover'
            },
            description: metadata.album,
            imageBuffer: metadata.coverImage,
        };
    }
    return tag;
};
class Mp3Writer extends metadata_writer_1.MetadataWriter {
    async write(metadata, filePath) {
        const tag = getNodeId3Tag(metadata, this.config.separator);
        if (this.config.lyric && this.config.lyric.output === 'lrc') {
            tag.unsynchronisedLyrics.text = '';
            tag.unsynchronisedLyrics.language = undefined;
        }
        const result = node_id3_1.default.write(tag, filePath);
        if (result === false) {
            throw new Error(`Write operation failed. filePath = ${filePath}`);
        }
    }
}
exports.Mp3Writer = Mp3Writer;
exports.mp3Writer = new Mp3Writer();