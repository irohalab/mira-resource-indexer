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

import { inject, injectable } from 'inversify';
import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger-factory';
import { TYPES } from '@irohalab/mira-shared';
import { ConfigManager } from '../utils/config-manager';

/**
 * Shared MongoClient provider. Singleton in the root container.
 * Each mode's DatabaseService gets its own Db instance from this shared client.
 */
@injectable()
export class MongoClientProvider {

    private _client!: MongoClient;

    public get client(): MongoClient {
        return this._client;
    }

    constructor(@inject(TYPES.ConfigManager) private _config: ConfigManager) {
    }

    public async connect(): Promise<void> {
        const url = `mongodb://${this._config.getDbUser()}:${this._config.getDbPass()}@${
            this._config.getDbHost()
        }:${this._config.getDbPort()}?authSource=${this._config.getAuthSource()}`;
        this._client = await MongoClient.connect(url);
        logger.info('MongoClient connected');
    }

    public async close(): Promise<void> {
        if (this._client) {
            await this._client.close();
        }
    }
}
