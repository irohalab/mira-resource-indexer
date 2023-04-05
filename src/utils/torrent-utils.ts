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

import parseTorrent = require('parse-torrent');
import { readFile, promises } from 'fs';
import * as ParseTorrentFile from 'parse-torrent-file';
import { basename, extname } from 'path';
import { promisify } from 'util';
import { downloadFile } from '../utils/download';
import { MediaFile } from '../entity/media-file';

const { unlink } = promises;

const readFilePromise = promisify(readFile);

export async function getTorrentFiles(torrentPath: string) {
    const file = await readFilePromise(torrentPath);
    const torrent = parseTorrent(file) as ParseTorrentFile.Instance;
    return torrent.files;
}

export async function getMagnetUri(url: string) {
    const torrentPath = await downloadFile(url);
    const torrent = await readFilePromise(torrentPath);
    const parsed = parseTorrent(torrent);
    return parseTorrent.toMagnetURI(parsed);
}

export async function getMediaFiles(url: string) {
    const torrentPath = await downloadFile(url);
    const files = await getTorrentFiles(torrentPath);
    const mediaFiles = files.map(file => {
        let mediaFile = new MediaFile();
        mediaFile.size = file.length.toString();
        mediaFile.path = file.path;
        mediaFile.ext = extname(mediaFile.path);
        mediaFile.name = basename(mediaFile.path, mediaFile.ext);
        return mediaFile;
    });
    await unlink(torrentPath);
    return mediaFiles;
}
