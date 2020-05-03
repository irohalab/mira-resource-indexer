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

type Func = () => void;

@injectable()
export class DatabaseService {

    private _db: Db;
    private _client: MongoClient;
    private onStartCallbacks: Array<{callback: Func, context: any}>;

    public get isStarted(): boolean {
        return this._client.isConnected();
    }

    public get db(): Db {
        return this._db;
    }

    constructor(@inject(TYPES.ConfigLoader) private _config: ConfigLoader) {
        this.onStartCallbacks = [];
    }

    public async onEnd(): Promise<void> {
        await this._client.close();
        for (let i = 0; i < this.onStartCallbacks.length; i++) {
            this.onStartCallbacks[i].context = null;
            this.onStartCallbacks[i].callback = null;
            this.onStartCallbacks[i] = null;
        }
    }

    public async onStart(): Promise<void> {
        if (this.isStarted) {
            return;
        }
        const url = `mongodb://${this._config.dbUser}:${this._config.dbPass}@${
            this._config.dbHost
            }:${this._config.dbPort}?authSource=${this._config.authSource}`;
        this._client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
        this._db = this._client.db(this._config.dbName);
        for (let callbackWrapper of this.onStartCallbacks) {
            callbackWrapper.callback.call(callbackWrapper.context);
        }
        return Promise.resolve();
    }

    public addOnStartCallback(context: any, callback: () => void) {
        this.onStartCallbacks.push({
            callback,
            context
        });
    }
}
