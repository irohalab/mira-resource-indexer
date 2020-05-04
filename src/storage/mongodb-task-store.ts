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
import { Db } from 'mongodb';
import { DatabaseService } from '../service/database-service';
import { Task } from '../task/task-types';
import { TaskStorage } from '../types';

@injectable()
export class MongodbTaskStore implements TaskStorage {

    private get db(): Db {
        return this._databaseService.db;
    }

    private _taskCollectionName = 'task';
    private _failedTaskCollectionName = 'failed_task';

    constructor(private _databaseService: DatabaseService) {
    }

    public pollFailedTask(): Promise<Task> {
        return this.poll(this._failedTaskCollectionName);
    }

    public pollTask(): Promise<Task> {
        return this.poll(this._taskCollectionName);
    }

    public offerFailedTask(task: Task): Promise<boolean> {
        task.retryCount = task.retryCount ? task.retryCount++ : 1;
        return this.push(this._failedTaskCollectionName, task);
    }

    public offerTask(task: Task): Promise<boolean> {
        return this.push(this._taskCollectionName, task);
    }

    public async hasTask(): Promise<boolean> {
        let count = await this.db.collection(this._taskCollectionName).estimatedDocumentCount();
        return count > 0;
    }

    public async hasFailedTask(): Promise<boolean> {
        let count = await this.db.collection(this._failedTaskCollectionName).estimatedDocumentCount();
        return count > 0;
    }

    private async push(collection: string, task: Task): Promise<boolean> {
        await this.db.collection(collection).insertOne(Object.assign({}, task, {updateTime: Date.now()}));
        return Promise.resolve(true);
    }

    private async poll(collection: string): Promise<Task> {
        const cursor = await this.db.collection(collection).findOneAndDelete({}, {
            sort: {
                updateTime: 1
            }
        });
        return cursor.value;
    }
}
