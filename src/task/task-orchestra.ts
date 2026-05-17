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

import { inject, injectable, optional } from 'inversify';
import {
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
import { ConfigManager } from '../utils/config-manager';
import { AsyncMutex } from '../utils/async-mutex';

const sleep = promisify(setTimeout) as (t: number) => Promise<unknown>;

@injectable()
export class TaskOrchestra {
    private _checkMainTaskTimerId: Timeout;
    private _checkFailedTaskTimerId: Timeout;
    private _lastMainTaskExeTime  = 0;
    private _scraper: Scraper;
    private _lastExeTime = 0;

    private readonly _exchangeName: string;
    private readonly _queueName: string;
    private readonly _taskRoutingKey: string;

    constructor(@inject(TYPES.ConfigManager) private _config: ConfigManager,
                @inject(TYPES_IDX.TaskTimingFactory) private _taskTimingFactory: (interval: number) => number,
                @inject(TYPES.RabbitMQService) private _mqService: RabbitMQService,
                @inject(TYPES_IDX.TaskStorage) private _taskStore: TaskQueue,
                @inject(TYPES_IDX.ThrottleStore) private _throttleStore: ThrottleStore,
                @inject(TYPES_IDX.Mode) private mode: string,
                @inject(TYPES_IDX.AsyncMutex) @optional() private _mutex: AsyncMutex | null) {
        this._exchangeName = `${TASK_EXCHANGE}_${this.mode}`;
        this._queueName = `${TASK_QUEUE}_${this.mode}`;
        this._taskRoutingKey = `${TASK_ROUTING_KEY}_${this.mode}`;
    }

    /**
     * Register exchanges, queues, and bindings with the message broker.
     * Must be called on ALL orchestras before any of them calls start(),
     * because RascalImpl creates the broker lazily on the first consume().
     */
    public async initMQ(): Promise<void> {
        if (this._mutex) {
            this._mutex.registerMode(this.mode);
        }
        await this._mqService.initPublisher(this._exchangeName, 'direct', this._taskRoutingKey);
        await this._mqService.initConsumer(this._exchangeName, 'direct', this._queueName, this._taskRoutingKey);
    }

    public async start(scraper: Scraper): Promise<void> {
        let actualInterval = this._taskTimingFactory(this._config.getMinInterval());
        this._scraper = scraper;
        await this._mqService.consume(this._queueName, async (msg: MQMessage) => {
            const task = msg as Task;
            const currentTime = Date.now();
            if (currentTime < this._lastExeTime + actualInterval) {
                await sleep(2000);
                return false;
            }
            const executeTask = async () => {
                this._lastExeTime = Date.now();
                let result = await this._scraper.executeTask(task);
                if (result === TaskStatus.NeedRetry) {
                    await this._taskStore.offerFailedTask(task);
                } else if (result === TaskStatus.Success && task.type === TaskType.MAIN) {
                    this._lastMainTaskExeTime = Date.now();
                }
            };
            if (this._mutex) {
                await this._mutex.runExclusive(this.mode, executeTask);
            } else {
                await executeTask();
            }
            return true;
        });
        await this.checkMainTask(actualInterval);
        await this.checkFailedTask();
    }

    public async queue(task: Task): Promise<void> {
        await this._mqService.publish(this._exchangeName, this._taskRoutingKey, task);
    }

    public stop() {
        clearTimeout(this._checkMainTaskTimerId);
        clearTimeout(this._checkFailedTaskTimerId);
    }

    private async checkMainTask(actualInterval: number): Promise<void> {
        const currentTime = Date.now();
        if (currentTime >= this._lastExeTime + actualInterval) {
            const claimed = await this._throttleStore.tryClaimTaskTime('MainTask', this._config.getMinCheckInterval());
            if (claimed) {
                const executeMainTask = async () => {
                    this._lastExeTime = Date.now();
                    await this._scraper.executeTask(new CommonTask(TaskType.MAIN));
                };
                if (this._mutex) {
                    await this._mutex.runExclusive(this.mode, executeMainTask);
                } else {
                    await executeMainTask();
                }
            }
        }
        this._checkMainTaskTimerId = setTimeout(() => {
            this.checkMainTask(actualInterval).catch((err) => {
                logger.error('check_main_task_error', { message: err.message, stack: err.stack });
            });
        }, actualInterval);
    }

    private async checkFailedTask(): Promise<void> {
        const claimed = await this._throttleStore.tryClaimTaskTime('FailedTask', this._config.getMinFailedTaskCheckInterval());
        if (claimed) {
            while (await this.pickFailedTask()) {
                await sleep(1000); // some small interval to queue task.
            }
        }
        const checkInterval = this._taskTimingFactory(this._config.getMinFailedTaskCheckInterval() / 2);
        this._checkFailedTaskTimerId = setTimeout(() => {
            this.checkFailedTask().catch((err) => {
                logger.error('check_failed_task_error', { message: err.message, stack: err.stack });
            });
        }, checkInterval);
    }

    /**
     * Pick a failed task from failed task queue
     * @returns {Promise<boolean>} true if a failed task is picked, false if the failed task queue is empty.
     */
    private async pickFailedTask(): Promise<boolean> {
        if (await this._taskStore.hasFailedTask()) {
            let task = await this._taskStore.pollFailedTask();
            if (task.retryCount > this._config.getMaxRetryCount()) {
                // drop task
                logger.warn('drop_task', {
                    task
                });
                return this.pickFailedTask();
            }
            await this.queue(task);
            return true;
        }
        return false;
    }
}
