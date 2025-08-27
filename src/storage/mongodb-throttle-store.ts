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
import { inject, injectable } from 'inversify';
import { ThrottleStore } from '../TYPES_IDX';
import { Db } from 'mongodb';
import { TYPES } from '@irohalab/mira-shared';
import { ConfigManager } from '../utils/config-manager';

const MAIN_TASK_RECORD_NAME = 'MainTask';
const FAILED_TASK_RECORD_NAME = 'FailedTask';

interface ThrottleRecord {
    name: string;
    timestamp: number;
}

@injectable()
export class MongodbThrottleStore implements ThrottleStore {

    private get db(): Db {
        return this._databaseService.db;
    }

    private _throttleCollectionName = 'throttle';

    constructor(private _databaseService: DatabaseService,
                @inject(TYPES.ConfigManager) private _config: ConfigManager) {
        this._databaseService.checkCollection([this._throttleCollectionName]);
    }

    public getLastMainTaskTime(): Promise<number> {
        return this.getLastTaskTime(MAIN_TASK_RECORD_NAME);
    }

    public async setLastMainTaskTime(): Promise<void> {
        await this.setLastTaskTime(MAIN_TASK_RECORD_NAME);
    }

    public getLastFailedTaskTime(): Promise<number> {
        return this.getLastTaskTime(FAILED_TASK_RECORD_NAME);
    }

    public async setLastFailedTaskTime(): Promise<void> {
        await this.setLastTaskTime(FAILED_TASK_RECORD_NAME);
    }

    public async getLastTaskTime(name: string): Promise<number> {
        const record = await this.db.collection<{timestamp: number}>(this._throttleCollectionName).findOne({name});
        return record ? record.timestamp : 0;
    }

    public async setLastTaskTime(name: string): Promise<void> {
        await this.db.collection(this._throttleCollectionName).findOneAndUpdate({name},
            {$set: {timestamp: Date.now()}}, {upsert: true});
    }
}
