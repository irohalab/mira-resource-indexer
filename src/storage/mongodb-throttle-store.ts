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

import { DatabaseService } from '../service/database-service';
import { inject } from 'inversify';
import { ConfigLoader, ThrottleStore, TYPES_IDX } from '../TYPES_IDX';
import { Db } from 'mongodb';

const MAIN_TASK_RECORD_NAME = 'MainTask';

interface ThrottleRecord {
    name: string;
    timestamp: number;
}

export class MongodbThrottleStore implements ThrottleStore {

    private get db(): Db {
        return this._databaseService.db;
    }

    private _throttleCollectionName = 'throttle';

    constructor(private _databaseService: DatabaseService,
                @inject(TYPES_IDX.ConfigLoader) private _config: ConfigLoader) {
        this._databaseService.checkCollection([this._throttleCollectionName]);
    }

    public async getLastMainTaskTime(): Promise<number> {
        const record = await this.db.collection(this._throttleCollectionName).findOne({name: MAIN_TASK_RECORD_NAME});
        if (record) {
            const mainTaskRecord = record.value as ThrottleRecord;
            return mainTaskRecord.timestamp;
        }
        return 0;
    }

    public async setLastMainTaskTime(): Promise<void> {
        await this.db.collection(this._throttleCollectionName).findOneAndUpdate({
            name: MAIN_TASK_RECORD_NAME
        }, {timestamp: Date.now()}, {upsert: true});
    }
}
