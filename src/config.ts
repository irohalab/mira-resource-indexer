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
import { ConfigLoader } from './types';

@injectable()
export class ConfigManager implements ConfigLoader {

    public static DMHY = 'dmhy';
    public static BANGUMI_MOE = 'bangumi_moe';
    public static NYAA = 'nyaa';
    
    public static PG = 'postgres';
    public static MONGO = 'mongo';

    private  _mode: string;
    private _dbMode: string;
    private _dbHost: string;
    private _dbPort: number;
    private _dbUser: string;
    private _dbName: string;
    private _dbPass: string;
    private _authSource: string;
    private _serverHost: string;
    private _serverPort: number;
    private _minInterval: number;
    private _minCheckInterval: number;
    private _maxPageNo: number;
    private _maxSearchCount: number;
    private _maxRetryCount: number;

    public get mode(): string {
        return this._mode;
    }

    public get dbMode(): string {
        return this._dbMode;
    }

    public get dbHost(): string {
        return this._dbHost;
    }

    public get dbPort(): number {
        return this._dbPort;
    }

    public get dbUser(): string {
        return this._dbUser;
    }

    public get dbName(): string {
        return this._dbName;
    }

    public get dbPass(): string {
        return this._dbPass;
    }

    public get authSource(): string {
        return this._authSource;
    }

    public get serverHost(): string {
        return this._serverHost;
    }

    public get serverPort(): number {
        return this._serverPort;
    }

    public get minInterval(): number {
        return this._minInterval;
    }

    public get minCheckInterval(): number {
        return this._minCheckInterval;
    }

    public get maxPageNo(): number {
        return this._maxPageNo;
    }

    public get maxSearchCount(): number {
        return this._maxSearchCount;
    }

    public get maxRetryCount(): number {
        return this._maxRetryCount;
    }

    public load(): void {
        this._mode = process.env.INDEXER_MODE;
        if (!this._mode) {
            throw new Error('No mode specified!');
        }
        this._dbMode = process.env.DB_MODE || 'mongo';
        this._dbHost = process.env.DB_HOST || 'localhost';
        this._dbPort = parseInt(process.env.DB_PORT, 10) || 27017;
        this._dbUser = process.env.DB_USER || process.env.USER;
        if (process.env.DB_NAME) {
            this._dbName = process.env.DB_NAME;
        } else {
            this._dbName = this._mode + '_indexer';
        }
        this._dbPass = process.env.DB_PASS || '123456';
        this._authSource = process.env.AUTH_SOURCE || 'admin';
        this._serverHost = process.env.SERVER_HOST || '0.0.0.0';
        this._serverPort = parseInt(process.env.SERVER_PORT, 10) || 35120;
        this._minInterval = parseInt(process.env.MIN_INTERVAL, 10) || 10000;
        this._minCheckInterval = parseInt(process.env.MIN_CHECK_INTERVAL, 10) || (15 * 60 * 1000);
        this._maxPageNo = parseInt(process.env.MAX_PAGE_NO, 10) || 5;
        this._maxSearchCount = parseInt(process.env.MAX_SEARCH_COUNT, 10) || 100;
        this._maxRetryCount = parseInt(process.env.MAX_RETRY_COUNT, 10) || 5;
    }
}
