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
import {
    ConfigLoader,
    Scraper,
    TASK_EXCHANGE,
    TASK_QUEUE,
    TASK_ROUTING_KEY,
    TaskQueue,
    ThrottleStore,
    TYPES_IDX
} from '../TYPES_IDX';
import { TaskStatus } from './task-status';
import { CommonTask, Task, TaskType } from './task-types';
import { logger } from '../utils/logger-factory';
import { MQMessage, RabbitMQService, TYPES } from '@irohalab/mira-shared';
import { promisify } from 'util';
import Timeout = NodeJS.Timeout;

const sleep = promisify(setTimeout) as (t: number) => Promise<unknown>;

@injectable()
export class TaskOrchestra {
    private _timerId: Timeout;
    private _lastMainTaskExeTime  = 0;
    private _scraper: Scraper;
    private _lastExeTime = 0;

    private readonly _exchangeName: string;

    constructor(@inject(TYPES_IDX.ConfigLoader) private _config: ConfigLoader,
                @inject(TYPES_IDX.TaskTimingFactory) private _taskTimingFactory: (interval: number) => number,
                @inject(TYPES.RabbitMQService) private _mqService: RabbitMQService,
                @inject(TYPES_IDX.TaskStorage) private _taskStore: TaskQueue,
                @inject(TYPES_IDX.ThrottleStore) private _throttleStore: ThrottleStore) {
        this._exchangeName = `${TASK_EXCHANGE}_${this._config.mode}`;
    }

    public async start(scraper: Scraper): Promise<void> {
        let actualInterval = this._taskTimingFactory(this._config.minInterval);
        this._scraper = scraper;
        await this.checkMainTask(actualInterval);
        await this._mqService.initPublisher(this._exchangeName, 'direct', TASK_ROUTING_KEY);
        await this._mqService.initConsumer(this._exchangeName, 'direct', TASK_QUEUE, TASK_ROUTING_KEY);
        await this._mqService.consume(TASK_QUEUE, async (msg: MQMessage) => {
            const task = msg as Task;
            const currentTime = Date.now();
            if (currentTime < this._lastExeTime + actualInterval) {
                await sleep(2000);
                return false;
            }
            let result = await this._scraper.executeTask(task);
            this._lastExeTime = Date.now();
            if (result === TaskStatus.NeedRetry) {
                return false;
            } else if (result === TaskStatus.Success && task.type === TaskType.MAIN) {
                this._lastMainTaskExeTime = Date.now();
            }
            return true;
        });
    }

    public async queue(task: Task): Promise<void> {
        await this._mqService.publish(this._exchangeName, TASK_ROUTING_KEY, task);
    }

    public stop() {
        clearTimeout(this._timerId);
    }

    private async checkMainTask(actualInterval: number): Promise<void> {
        const lastMainTaskTime = this._throttleStore.getLastMainTaskTime();
        const currentTime = Date.now();
        const delta = currentTime - lastMainTaskTime;
        if (delta >= this._config.minCheckInterval && currentTime >= this._lastExeTime + actualInterval) {
            this._lastExeTime = currentTime;
            await this._throttleStore.setLastMainTaskTime();
            await this._scraper.executeTask(new CommonTask(TaskType.MAIN));
        }
        this._timerId = setTimeout(async () => {
            await this.checkMainTask(actualInterval);
        }, actualInterval);
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
                /* Need to ensure the list page is checked regularly */
                if (Date.now() - this._lastMainTaskExeTime > this._config.minCheckInterval) {
                    // force queue a MainTask
                    logger.info('force_queue', {
                        last_main_task_execute_time: this._lastMainTaskExeTime,
                        min_check_interval: this._config.minCheckInterval
                    });
                    this.queue(new CommonTask(TaskType.MAIN))
                        .then(() => {
                            this._timerId = setTimeout(() => {
                                this.pick();
                            }, actualInterval);
                        });
                    return;
                }
                /* Either task or failed task has been executed, we will try to pick again */
                if (hasSomeTaskExecuted) {
                    this._timerId = setTimeout(() => {
                        this.pick();
                    }, actualInterval);
                } else {
                    logger.info('no task in queue, queue a main task');
                    this.queue(new CommonTask(TaskType.MAIN))
                        .then(() => {
                            let offset = Date.now() - this._lastMainTaskExeTime;
                            this._timerId = setTimeout(() => {
                                this.pick();
                            }, Math.max(this._config.minCheckInterval - offset, actualInterval));
                        });
                }
            });
    }

    /**
     * Pick a task from task queue
     * @returns {Promise<boolean>} true if a task is picked, false if the task queue is empty.
     */
    private async pickTask(): Promise<boolean> {
        if (await this._taskStore.hasTask()) {
            let task = await this._taskStore.pollTask();
            let result = await this._scraper.executeTask(task);
            if (result === TaskStatus.NeedRetry) {
                await this._taskStore.offerFailedTask(task);
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
            let task = await this._taskStore.pollFailedTask();
            if (task.retryCount > this._config.maxRetryCount) {
                // drop task
                logger.warn('drop_task', {
                    task
                });
                return false;
            }
            let result = await this._scraper.executeTask(task);
            if (result === TaskStatus.NeedRetry) {
                await this._taskStore.offerFailedTask(task);
            }
            return true;
        }
        return false;
    }
}
