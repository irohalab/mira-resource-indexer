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
import { TaskQueue } from '../TYPES_IDX';
import { TYPES } from '@irohalab/mira-shared';
import { ConfigManager } from '../utils/config-manager';

@injectable()
export class MongodbTaskStore implements TaskQueue {

    private get db(): Db {
        return this._databaseService.db;
    }

    private _taskCollectionName = 'task';
    private _failedTaskCollectionName = 'failed_task';

    constructor(private _databaseService: DatabaseService,
                @inject(TYPES.ConfigManager) private _config: ConfigManager) {
        this._databaseService.checkCollection([this._taskCollectionName, this._failedTaskCollectionName]);
    }

    public async pollFailedTask(): Promise<Task> {
        let task = await this.poll(this._failedTaskCollectionName);
        task.retryCount = task.retryCount ? task.retryCount + 1 : 1;
        return task;
    }

    public async pollTask(): Promise<Task> {
        return await this.poll(this._taskCollectionName);
    }

    public offerFailedTask(task: Task): Promise<boolean> {
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
        await this._databaseService.transaction(async (client) => {
            const taskCollection = client.db(this._config.getDbName()).collection(collection);
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
        return Promise.resolve(true);
    }

    private async poll(collection: string): Promise<Task> {
        return await this.db.collection<Task>(collection).findOneAndDelete({}, {
            sort: {
                updateTime: 1
            }
        });
    }
}
