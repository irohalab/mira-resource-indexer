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
import { ConfigLoader, Scraper, TaskStorage, TYPES } from '../types';
import { TaskStatus } from './task-status';
import { CommonTask, Task, TaskType } from './task-types';
import Timeout = NodeJS.Timeout;

@injectable()
export class TaskOrchestra {
    private _taskQueue: Task[];
    private _timerId: Timeout;
    private _lastMainTaskExeTime  = 0;
    private _scraper: Scraper;

    constructor(@inject(TYPES.ConfigLoader) private _config: ConfigLoader,
                @inject(TYPES.TaskTimingFactory) private _taskTimingFactory: (interval: number) => number,
                @inject(TYPES.TaskStorage) private _taskStore: TaskStorage) {
        this._taskQueue = [];
    }

    public start(scraper: Scraper) {
        this._scraper = scraper;
        this.pick();
    }

    public async queue(task: Task): Promise<void> {
        await this._taskStore.enqueueTask(task);
    }

    public async stop() {
        clearTimeout(this._timerId);
    }

    private pick(): void {
        let actualInterval = this._taskTimingFactory(this._config.minInterval);
        this.pickTask()
            .then((hasTask) => {
                /* if task queue is empty, try failed task */
                if (!hasTask) {
                    return this.pickFailedTask();
                }
                return true;
            })
            .then((hasSomeTaskExecuted) => {
                /* Either task or failed task has been executed, we will try to pick again */
                if (hasSomeTaskExecuted) {
                    this._timerId = setTimeout(() => {
                        this.pick();
                    }, actualInterval);
                } else {
                    this.queue(new CommonTask(TaskType.MAIN))
                        .then(() => {
                            let offset = Date.now() - this._lastMainTaskExeTime;
                            this._timerId = setTimeout(() => {
                                this.pick();
                            }, Math.max(this._config.minCheckInterval - offset, actualInterval));
                        });
                }
            });
        if (this._taskQueue.length === 0) {
            // no task in the queue. schedule a new task.
            this.queue(new CommonTask(TaskType.MAIN))
                .then(() => {
                    let offset = Date.now() - this._lastMainTaskExeTime;
                    this._timerId = setTimeout(() => {
                        this.pick();
                    }, Math.max(this._config.minCheckInterval - offset, actualInterval));
                });
        } else {
            // execute task from head of the queue
            let task = this._taskQueue.shift();
            this._scraper.executeTask(task)
                .then(() => {
                    if (task.type === TaskType.MAIN) {
                        this._lastMainTaskExeTime = Date.now();
                    }
                    this._timerId = setTimeout(() => {
                        this.pick();
                    }, actualInterval);
                });
        }
    }

    /**
     * Pick a task from task queue
     * @returns {Promise<boolean>} true if a task is picked, false if the task queue is empty.
     */
    private async pickTask(): Promise<boolean> {
        if (await this._taskStore.hasTask()) {
            let task = await this._taskStore.popTask();
            let result = await this._scraper.executeTask(task);
            if (result === TaskStatus.NeedRetry) {
                await this._taskStore.enqueueFailedTask(task);
            } else if (result === TaskStatus.Success && task.type === TaskType.MAIN) {
                this._lastMainTaskExeTime = Date.now();
            }
            return true;
        }
        return false;
    }

    /**
     * Pick a failed task from failed task queue
     * @returns {Promise<boolean>} true if a failed task is picked, false if the failed task queue is empty.
     */
    private async pickFailedTask(): Promise<boolean> {
        if (await this._taskStore.hasFailedTask()) {
            let task = await this._taskStore.popFailedTask();
            let result = await this._scraper.executeTask(task);
            if (result === TaskStatus.NeedRetry) {
                await this._taskStore.enqueueFailedTask(task);
            }
            return true;
        }
        return false;
    }
}
