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

    private _db: Db;
    private _taskCollectionName = 'task';
    private _failedTaskCollectionName = 'failed_task';

    constructor(private _databaseService: DatabaseService) {
        this._db = this._databaseService.db;
        if (this._databaseService.isStarted) {
            this.createIndexIfNotExist()
                .then(() => {
                    console.log('index created');
                });
        } else {
            this._databaseService.addOnStartCallback(this, this.createIndexIfNotExist);
        }
    }

    public popFailedTask(): Promise<Task> {
        return this.pop(this._failedTaskCollectionName);
    }

    public popTask(): Promise<Task> {
        return this.pop(this._taskCollectionName);
    }

    public enqueueFailedTask(task: Task): Promise<boolean> {
        task.retryCount = task.retryCount ? task.retryCount++ : 1;
        return this.push(this._failedTaskCollectionName, task);
    }

    public enqueueTask(task: Task): Promise<boolean> {
        return this.push(this._taskCollectionName, task);
    }

    public async hasTask(): Promise<boolean> {
        let count = await this._db.collection(this._taskCollectionName).estimatedDocumentCount();
        return count === 0;
    }

    public async hasFailedTask(): Promise<boolean> {
        let count = await this._db.collection(this._failedTaskCollectionName).estimatedDocumentCount();
        return count === 0;
    }

    private async push(collection: string, task: Task): Promise<boolean> {
        await this._db.collection(collection).insertOne(Object.assign({updateTime: Date.now()}, task));
        return Promise.resolve(true);
    }

    private async pop(collection: string): Promise<Task> {
        const cursor = await this._db.collection(collection).findOneAndDelete({
            updateTime: {
                $lte: Date.now()
            }
        }, {
            sort: {
                updateTime: 1
            }
        });
        return cursor.value;
    }

    private async createIndexIfNotExist(): Promise<void> {
        if (await this._db.collection(this._taskCollectionName).indexExists('updateTime')) {
            await this._db.collection(this._taskCollectionName).createIndex('updateTime');
        }
        if (await this._db.collection(this._failedTaskCollectionName).indexExists('updateTime')) {
            await this._db.collection(this._failedTaskCollectionName).createIndex('updateTime');
        }
    }
}
