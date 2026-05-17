/*
 * Copyright 2026 IROHA LAB
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

declare module 'parse-torrent' {
    interface TorrentFile {
        path: string;
        name: string;
        length: number;
        offset: number;
    }

    interface Instance {
        infoHash?: string;
        name?: string;
        files?: TorrentFile[];
        length?: number;
        pieceLength?: number;
        lastPieceLength?: number;
        pieces?: string[];
        announce?: string[];
        urlList?: string[];
    }

    type ParseTorrent = (torrentId: string | Buffer | Uint8Array | object) => Promise<Instance>;

    const parseTorrent: ParseTorrent;
    export default parseTorrent;

    export function toMagnetURI(parsed: Instance | object): string;
    export function toTorrentFile(parsed: Instance | object): Uint8Array;
}
