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

import axios from 'axios';
import { createWriteStream } from 'fs';
import { basename, resolve as resolvePath } from 'path';

export async function downloadFile(url: string, savePath = '/var/tmp/'): Promise<string> {
    const fileName = basename(url);
    const filePath = resolvePath(savePath, fileName);
    const writer = createWriteStream(filePath);
    const response = await axios.get(url, {
        responseType: 'stream'
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            resolve(filePath);
        });
        writer.on('error', err => {
            writer.close();
            reject(err);
        });
    });
}
