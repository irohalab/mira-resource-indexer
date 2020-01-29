/*
 * Copyright 2020 IROHA LAB
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

import { injectable } from 'inversify';
import { ConfigLoader } from '../types';

@injectable()
export class FakeConfigManager implements ConfigLoader {

    public dbHost: string;
    public dbPort: number;
    public mode: string;
    public dbMode: string;
    public dbUser: string;
    public dbName: string;
    public dbPass: string;
    public authSource: string;
    public serverPort: number;
    public minCheckInterval: number;
    public minInterval: number;
    public maxPageNo: number;
    public maxSearchCount: number;
    public serverHost: string;

    public load(): void {
        this.mode = process.env.INDEXER_MODE;
        if (!this.mode) {
            throw new Error('No mode specified!');
        }
        this.dbMode = process.env.DB_MODE || 'mongo';
        this.dbHost = process.env.DB_HOST || 'localhost';
        this.dbPort = parseInt(process.env.DB_PORT, 10) || 27017;
        this.dbUser = process.env.DB_USER || process.env.USER;
        if (process.env.DB_NAME) {
            this.dbName = process.env.DB_NAME;
        } else {
            this.dbName = this.mode + '_indexer';
        }
        this.dbPass = process.env.DB_PASS || '123456';
        this.authSource = process.env.AUTH_SOURCE || 'admin';
        this.serverHost = process.env.SERVER_HOST || '0.0.0.0';
        this.serverPort = parseInt(process.env.SERVER_PORT, 10) || 35120;
        this.minInterval = parseInt(process.env.MIN_INTERVAL, 10) || 10;
        this.minCheckInterval = parseInt(process.env.MIN_CHECK_INTERVAL, 10) || (15 * 60);
        this.maxPageNo = parseInt(process.env.MAX_PAGE_NO, 10) || 5;
        this.maxSearchCount = parseInt(process.env.MAX_SEARCH_COUNT, 10) || 100;
    }
}
