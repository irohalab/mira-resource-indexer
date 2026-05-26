/*
 * Copyright 2021 IROHA LAB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { readFile, stat } from 'fs';
import { basename, extname } from 'path';
import { promisify } from 'util';
import { MediaFile } from '../entity/media-file';
import { logger } from './logger-factory';

const readFilePromise = promisify(readFile);
const statPromise = promisify(stat);

// Torrent files larger than this are skipped to avoid OOM.
// A typical anime series (several hundred episodes) produces a .torrent well under 1 MB.
// The 262K-file torrent that caused OOM was 23 MB.
const MAX_TORRENT_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

// Use indirect import to bypass ts-node converting import() to require(),
// which fails because parse-torrent v11 is ESM-only.
const dynamicImport = new Function('specifier', 'return import(specifier)');

async function loadParseTorrent() {
    const mod = await dynamicImport('parse-torrent');
    return { parseTorrent: mod.default, toMagnetURI: mod.toMagnetURI };
}

export async function getTorrentFiles(torrentPath: string) {
    const { parseTorrent } = await loadParseTorrent();
    const file = await readFilePromise(torrentPath);
    try {
        const torrent = await parseTorrent(file);
        return torrent.files;
    } catch (e: any) {
        logger.warn('Failed to parse torrent file: %s, error: %s', torrentPath, e.message);
        return [];
    }
}

export async function getTorrentInfo(torrentPath: string, withMagnet?: boolean) {
    const fileInfo = await statPromise(torrentPath);
    if (fileInfo.size > MAX_TORRENT_FILE_SIZE) {
        return { magnet_uri: undefined, files: [] as MediaFile[] };
    }

    const { parseTorrent, toMagnetURI } = await loadParseTorrent();
    const torrent = await readFilePromise(torrentPath);
    let parsed: any;
    try {
        parsed = await parseTorrent(torrent);
    } catch (e: any) {
        logger.warn('Failed to parse torrent file: %s, error: %s', torrentPath, e.message);
        return { magnet_uri: undefined, files: [] as MediaFile[] };
    }

    let magnet_uri: string | undefined;
    if (withMagnet) {
        magnet_uri = toMagnetURI(parsed as any);
    }
    const files = parsed.files || [];
    const mediaFiles: MediaFile[] = files.map((file: any) => {
        const mediaFile = new MediaFile();
        mediaFile.size = file.length.toString();
        mediaFile.path = file.path;
        mediaFile.ext = extname(mediaFile.path);
        mediaFile.name = basename(mediaFile.path, mediaFile.ext);
        return mediaFile;
    });
    return { magnet_uri, files: mediaFiles };
}
