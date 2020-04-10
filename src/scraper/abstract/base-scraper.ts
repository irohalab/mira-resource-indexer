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
import { Task, TaskType } from '../../task/task-types';
import { ConfigLoader, PersistentStorage, Scraper } from '../../types';
import { captureMessage } from '../../utils/sentry';

const MAX_TASK_RETRIED_TIMES = 10;

@injectable()
export abstract class BaseScraper<T> implements Scraper {
    protected _taskRetriedTimes: Map<number, number>;

    protected constructor(protected _taskOrchestra: TaskOrchestra,
                          protected _config: ConfigLoader,
                          protected _store: PersistentStorage<T>) {
    }

    public abstract executeMainTask(pageNo?: number): Promise<{items: Array<Item<T>>, hasNext: boolean}>;
    public abstract executeSubTask(item: Item<T>): Promise<number>;
    public async executeTask(task: Task): Promise<any> {
        if (task.type === TaskType.MAIN) {
            let result;
            if (task instanceof MainTask) {
                result = await this.executeMainTask(task.pageNo);
            } else {
                result = await this.executeMainTask();
            }
            if (!result) {
                this.retryTask(task);
                return;
            } else if (this._taskRetriedTimes.has(task.id)) {
                this._taskRetriedTimes.delete(task.id);
            }
            for (let item of result.items) {
                this._taskOrchestra.queue(new SubTask<T>(TaskType.SUB, item));
            }
            if (result.hasNext && (task as MainTask).pageNo < this._config.maxPageNo) {
                let newTask = new MainTask(TaskType.MAIN);
                let previousPageNo = (task as MainTask).pageNo;
                if (previousPageNo) {
                    newTask.pageNo = previousPageNo + 1;
                } else {
                    newTask.pageNo = 2;
                }
                this._taskOrchestra.queue(newTask);
            }
        } else {
            let item = (task as SubTask<T>).item;
            let httpStatusCode = await this.executeSubTask(item);
            if (httpStatusCode !== 404) {
                this.retryTask(task);
                return;
            } else if (this._taskRetriedTimes.has(task.id)) {
                this._taskRetriedTimes.delete(task.id);
            }
            return await this._store.putItem(item);
        }
    }

    public async start(): Promise<any> {
        this._taskOrchestra.queue(new MainTask(TaskType.MAIN));
        this._taskOrchestra.start(this);
    }

    public async end(): Promise<any> {
        this._taskOrchestra.stop();
        this._taskRetriedTimes.clear();
    }

    private checkMaxRetriedTime(task: Task): boolean {
        if (this._taskRetriedTimes.has(task.id)) {
            if (this._taskRetriedTimes.get(task.id) > MAX_TASK_RETRIED_TIMES) {
                return true;
            }
            this._taskRetriedTimes.set(task.id, this._taskRetriedTimes.get(task.id) + 1);
        } else {
            this._taskRetriedTimes.set(task.id, 1);
        }
        return false;
    }

    private retryTask(task: Task): void {
        // retry this task
        if (this.checkMaxRetriedTime(task)) {
            if (task instanceof MainTask && task.type === TaskType.MAIN) {
                captureMessage(`DmhyScaper, maximum retries reached, Main Task (${task.pageNo})`);
            } else if (task instanceof SubTask && task.type === TaskType.SUB) {
                captureMessage(`DmhyScaper, maximum retries reached, Sub Task (${JSON.stringify(task.item)})`);
            } else {
                captureMessage('DmhyScraper, maximum retries reached, Common Task');
            }
            return;
        }
        this._taskOrchestra.queue(task);
    }
}
