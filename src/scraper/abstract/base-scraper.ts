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
import { Item } from '../../entity/Item';
import { MainTask } from '../../task/main-task';
import { SubTask } from '../../task/sub-task';
import { TaskOrchestra } from '../../task/task-orchestra';
import { TaskStatus } from '../../task/task-status';
import { Task, TaskType } from '../../task/task-types';
import { ConfigLoader, ItemStorage, Scraper } from '../../types';

@injectable()
export abstract class BaseScraper<T> implements Scraper {
    protected className: string;
    protected _taskRetriedTimes: Map<number, number>;

    protected constructor(protected _taskOrchestra: TaskOrchestra,
                          protected _config: ConfigLoader,
                          protected _store: ItemStorage<T>) {
        this.className = this.constructor.name;
    }

    public abstract executeMainTask(pageNo?: number): Promise<{items: Array<Item<T>>, hasNext: boolean}>;
    public abstract executeSubTask(item: Item<T>): Promise<number>;
    public async executeTask(task: Task): Promise<TaskStatus> {
        if (task.type === TaskType.MAIN) {
            let result;
            if (task instanceof MainTask) {
                result = await this.executeMainTask(task.pageNo);
            } else {
                result = await this.executeMainTask();
            }
            if (!result) {
                return TaskStatus.NeedRetry;
            }
            for (let item of result.items) {
                await this._taskOrchestra.queue(new SubTask<T>(TaskType.SUB, item));
            }
            if (result.hasNext && (task as MainTask).pageNo < this._config.maxPageNo) {
                let newTask = new MainTask(TaskType.MAIN);
                let previousPageNo = (task as MainTask).pageNo;
                if (previousPageNo) {
                    newTask.pageNo = previousPageNo + 1;
                } else {
                    newTask.pageNo = 2;
                }
                await this._taskOrchestra.queue(newTask);
            }
            return TaskStatus.Success;
        } else {
            let item = (task as SubTask<T>).item;
            let httpStatusCode = await this.executeSubTask(item);
            if (httpStatusCode === 200) {
                await this._store.putItem(item);
                return TaskStatus.Success;
            } else if (httpStatusCode !== 404) {
                return TaskStatus.NeedRetry;
            }
            return TaskStatus.Fail;
        }
    }

    public async start(): Promise<any> {
        await this._taskOrchestra.queue(new MainTask(TaskType.MAIN));
        this._taskOrchestra.start(this);
    }

    public async end(): Promise<any> {
        this._taskOrchestra.stop();
    }
}
