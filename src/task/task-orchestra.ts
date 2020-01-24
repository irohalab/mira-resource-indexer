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
import { ConfigLoader, Scraper, TYPES } from '../types';
import { CommonTask, Task, TaskType } from './task-types';
import Timeout = NodeJS.Timeout;

@injectable()
export class TaskOrchestra {
    private _taskQueue: Task[];
    private _timerId: Timeout;
    private _lastMainTaskExeTime  = 0;
    private _scraper: Scraper;

    constructor(@inject(TYPES.ConfigLoader) private _config: ConfigLoader,
                @inject(TYPES.TaskTimingFactory) private _taskTimingFactory: (interval: number) => number) {
        this._taskQueue = [];
    }

    public start(scraper: Scraper) {
        this._scraper = scraper;
        this.pick();
    }

    public queue(task: Task) {
        this._taskQueue.push(task);
    }

    public stop() {
        clearTimeout(this._timerId);
        this.cleanTaskQueue();
    }

    private pick(): void {
        let actualInterval = this._taskTimingFactory(this._config.minInterval);
        if (this._taskQueue.length === 0) {
            // no task in the queue. schedule a new task.
            this.queue(new CommonTask(TaskType.MAIN));
            let offset = Date.now() - this._lastMainTaskExeTime;
            this._timerId = setTimeout(() => {
                this.pick();
            }, Math.max(this._config.minCheckInterval - offset, actualInterval));
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

    private cleanTaskQueue() {
        this._taskQueue.length = 0;
    }
}
