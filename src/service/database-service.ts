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

import { inject, injectable } from 'inversify';
import { Db, MongoClient } from 'mongodb';
import { ConfigLoader, TYPES } from '../types';
import { captureException } from '../utils/sentry';
import { logger } from '../utils/logger-factory';

@injectable()
export class DatabaseService {

    private _db: Db;
    private _client: MongoClient;
    private _collectionNames: string[] = [];

    public get db(): Db {
        return this._db;
    }

    constructor(@inject(TYPES.ConfigLoader) private _config: ConfigLoader) {
    }

    public async onEnd(): Promise<void> {
        await this._client.close();
    }

    public async onStart(): Promise<void> {
        const url = `mongodb://${this._config.dbUser}:${this._config.dbPass}@${
            this._config.dbHost
            }:${this._config.dbPort}?authSource=${this._config.authSource}`;
        this._client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
        this._db = this._client.db(this._config.dbName);
        await this._doCheckCollection();
        return Promise.resolve();
    }

    public checkCollection(collectionNames: string[]): void {
        this._collectionNames = this._collectionNames.concat(collectionNames);
        if (this.db) {
            this._doCheckCollection()
                .then(() => {
                    logger.info('collection checked');
                });
        }
    }

    public async transaction(transactionAction: (client: MongoClient) => Promise<void>): Promise<void> {
        let session = null;
        try {
            session = this._client.startSession();
            await session.withTransaction(async () => {
                await transactionAction(this._client);
            });
        } catch (e) {
            logger.error('transaction_error', {
                stack: e.stack
            });
            captureException(e);
        } finally {
            if (session != null) {
                session.endSession();
            }
        }
    }

    private async _doCheckCollection(): Promise<void> {
        let collectionNames = this._collectionNames;
        let existCollections: string[];
        let cur = null;
        try {
            cur = this.db.listCollections({}, {nameOnly: true});
            existCollections = await cur.toArray() as string[];
            if (existCollections) {
                for (let collectionName of collectionNames) {
                    if (existCollections.indexOf(collectionName) === -1) {
                        await this.db.createCollection(collectionName);
                    }
                }
            }
        } catch (e) {
            console.error(e);
            captureException(e);
        } finally {
            if (cur != null && !cur.isClosed()) {
                cur.close();
            }
        }
    }
}
