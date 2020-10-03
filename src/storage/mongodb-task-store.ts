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
import { Db } from 'mongodb';
import { DatabaseService } from '../service/database-service';
import { MainTask } from '../task/main-task';
import { SubTask } from '../task/sub-task';
import { Task, TaskType } from '../task/task-types';
import { ConfigLoader, TaskStorage, TYPES } from '../types';
import { AzureLogger } from '../utils/azure-logger';

@injectable()
export class MongodbTaskStore implements TaskStorage {

    private get db(): Db {
        return this._databaseService.db;
    }

    private _taskCollectionName = 'task';
    private _failedTaskCollectionName = 'failed_task';
    private _logger: AzureLogger;

    constructor(private _databaseService: DatabaseService,
                @inject(TYPES.ConfigLoader) private _config: ConfigLoader) {
        this._logger = AzureLogger.getInstance();
        this._databaseService.checkCollection([this._taskCollectionName, this._failedTaskCollectionName]);
    }

    public async pollFailedTask(): Promise<Task> {
        let task = await this.poll(this._failedTaskCollectionName);
        task.retryCount = task.retryCount ? task.retryCount++ : 1;
        this._logger.log('pollFailedTask', `task#${task.id} has been polled from queue`,
            AzureLogger.INFO, {task: JSON.stringify(task)});
        return task;
    }

    public async pollTask(): Promise<Task> {
        const task = await this.poll(this._taskCollectionName);
        console.log(`poll task#${task.id}`);
        return task;
    }

    public offerFailedTask(task: Task): Promise<boolean> {
        this._logger.log('offerFailedTask', `task#${task.id} has been offered into queue`,
            AzureLogger.INFO, {task: JSON.stringify(task)});
        return this.push(this._failedTaskCollectionName, task);
    }

    public offerTask(task: Task): Promise<boolean> {
        console.log(`push task#${task.id}, type ${task.type.toString()}`);
        return this.push(this._taskCollectionName, task);
    }

    public async hasTask(): Promise<boolean> {
        let count = await this.db.collection(this._taskCollectionName).estimatedDocumentCount();
        console.log('hasTask ', count);
        return count > 0;
    }

    public async hasFailedTask(): Promise<boolean> {
        let count = await this.db.collection(this._failedTaskCollectionName).estimatedDocumentCount();
        console.log('hasFailedTask', count);
        return count > 0;
    }

    private async push(collection: string, task: Task): Promise<boolean> {
        await this._databaseService.transaction(async (client) => {
            const taskCollection = client.db(this._config.dbName).collection(collection);
            let filterObj: any = {type: task.type};
            if (task.type === TaskType.MAIN) {
                if (task instanceof MainTask) {
                    filterObj.pageNo = task.pageNo;
                }
            } else {
                filterObj['item.uri'] = (task as SubTask<any>).item.uri;
            }
            await taskCollection.deleteMany(filterObj);
            await taskCollection.insertOne(Object.assign({}, task, {updateTime: Date.now()}));
        });
        console.log(`push task#${task.id}`, `task type ${task.type}`);
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
