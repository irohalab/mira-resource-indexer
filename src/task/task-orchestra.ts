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
import { Task, TaskType } from './task-types';
import { MainTask } from './main-task';
import { logger } from '../utils/logger-factory';
import { MQMessage, RabbitMQService, TYPES } from '@irohalab/mira-shared';
import { promisify } from 'util';
import Timeout = NodeJS.Timeout;
import { ConfigManager } from '../utils/config-manager';
import { AsyncMutex } from '../utils/async-mutex';
import { MQControlAPIClient } from '../utils/mq-control-api-client';

const sleep = promisify(setTimeout) as (t: number) => Promise<unknown>;

@injectable()
export class TaskOrchestra {
    private _checkMainTaskTimerId: Timeout;
    private _checkFailedTaskTimerId: Timeout;
    private _lastMainTaskExeTime  = 0;
    private _scraper: Scraper;
    private _lastMainExeTime = 0;
    private _lastSubExeTime = 0;
    private _vhost = '/';

    private readonly _exchangeName: string;
    private readonly _mainQueueName: string;
    private readonly _subQueueName: string;
    private readonly _mainRoutingKey: string;
    private readonly _subRoutingKey: string;

    constructor(@inject(TYPES.ConfigManager) private _config: ConfigManager,
                @inject(TYPES_IDX.TaskTimingFactory) private _taskTimingFactory: (interval: number) => number,
                @inject(TYPES.RabbitMQService) private _mqService: RabbitMQService,
                @inject(TYPES_IDX.TaskStorage) private _taskStore: TaskQueue,
                @inject(TYPES_IDX.ThrottleStore) private _throttleStore: ThrottleStore,
                @inject(TYPES_IDX.Mode) private mode: string,
                @inject(TYPES_IDX.MainTaskMutex) @optional() private _mainMutex: AsyncMutex | null,
                @inject(TYPES_IDX.SubTaskMutex) @optional() private _subMutex: AsyncMutex | null,
                @inject(TYPES_IDX.MQControlAPIClient) private _mqControlAPI: MQControlAPIClient) {
        this._exchangeName = `${TASK_EXCHANGE}_${this.mode}`;
        this._mainQueueName = `${TASK_QUEUE}_main_${this.mode}`;
        this._subQueueName = `${TASK_QUEUE}_sub_${this.mode}`;
        this._mainRoutingKey = `${TASK_ROUTING_KEY}_main_${this.mode}`;
        this._subRoutingKey = `${TASK_ROUTING_KEY}_sub_${this.mode}`;
        if (this._config.amqpServerUrl()) {
            const urlObj = new URL(this._config.amqpServerUrl());
            this._vhost = urlObj.pathname.substring(1);
        }
    }

    /**
     * Register exchanges, queues, and bindings with the message broker.
     * Must be called on ALL orchestras before any of them calls start(),
     * because RascalImpl creates the broker lazily on the first consume().
     */
    public async initMQ(): Promise<void> {
        if (this._mainMutex) {
            this._mainMutex.registerMode(this.mode);
        }
        if (this._subMutex) {
            this._subMutex.registerMode(this.mode);
        }
        await this._mqService.initPublisher(this._exchangeName, 'direct', this._mainRoutingKey);
        await this._mqService.initPublisher(this._exchangeName, 'direct', this._subRoutingKey);
        await this._mqService.initConsumer(this._exchangeName, 'direct', this._mainQueueName, this._mainRoutingKey);
        await this._mqService.initConsumer(this._exchangeName, 'direct', this._subQueueName, this._subRoutingKey);
    }

    public async start(scraper: Scraper): Promise<void> {
        const actualInterval = this._taskTimingFactory(this._config.getMinInterval());
        this._scraper = scraper;
        await this._mqService.consume(this._mainQueueName, this.makeConsumer(true, actualInterval));
        await this._mqService.consume(this._subQueueName, this.makeConsumer(false, actualInterval));
        await this.checkMainTask(actualInterval);
        await this.checkFailedTask();
    }

    /**
     * Build a consumer callback bound to a lane (main or sub). Each lane has its own mutex and
     * its own execution throttle, so at most one main task and one sub task run at any time
     * across all modes.
     */
    private makeConsumer(isMain: boolean, actualInterval: number): (msg: MQMessage) => Promise<boolean> {
        const mutex = isMain ? this._mainMutex : this._subMutex;
        return async (msg: MQMessage) => {
            const task = msg as Task;
            const executeTask = async () => {
                const currentTime = Date.now();
                const lastExeTime = isMain ? this._lastMainExeTime : this._lastSubExeTime;
                if (currentTime < lastExeTime + actualInterval) {
                    await sleep(2000);
                    return false;
                }
                if (isMain) {
                    this._lastMainExeTime = Date.now();
                } else {
                    this._lastSubExeTime = Date.now();
                }
                const result = await this._scraper.executeTask(task);
                if (result === TaskStatus.NeedRetry) {
                    await this._taskStore.offerFailedTask(task);
                } else if (result === TaskStatus.Success && task.type === TaskType.MAIN) {
                    this._lastMainTaskExeTime = Date.now();
                }
                return true;
            };
            try {
                if (mutex) {
                    return await mutex.runExclusive(this.mode, executeTask);
                } else {
                    return await executeTask();
                }
            } catch (err: any) {
                // An unexpected error escaped task execution (e.g. a storage failure).
                // We must settle the message; otherwise, with prefetch=1, the unacked message
                // permanently stalls this queue's consumer. We don't know how to handle it,
                // so drop it by acking (return true). Undiscovered items will be re-queued by
                // the next main task run.
                logger.error('consumer_task_error', {
                    mode: this.mode,
                    taskType: task.type,
                    message: err.message,
                    stack: err.stack
                });
                return true;
            }
        };
    }

    public async queue(task: Task): Promise<void> {
        const routingKey = task.type === TaskType.MAIN ? this._mainRoutingKey : this._subRoutingKey;
        await this._mqService.publish(this._exchangeName, routingKey, task);
    }

    public stop() {
        clearTimeout(this._checkMainTaskTimerId);
        clearTimeout(this._checkFailedTaskTimerId);
    }

    private async checkMainTask(actualInterval: number): Promise<void> {
        try {
            // The main queue only ever holds a few pagination tasks, so this guard just avoids
            // stacking a new discovery while pagination is still in flight; it can never be
            // starved by the (separate) sub-task backlog.
            const queueInfo = await this._mqControlAPI.getQueueInfo(this._vhost, this._mainQueueName);
            if (queueInfo.len > 0) {
                logger.info('skip_main_task_seed', { mode: this.mode, queueLen: queueInfo.len });
            } else {
                const claimed = await this._throttleStore.tryClaimTaskTime(`MainTask_${this.mode}`, this._config.getMinCheckInterval());
                if (claimed) {
                    // Seed a page-1 main task; the main consumer executes it (and pagination)
                    // under the main lane.
                    await this.queue(new MainTask(TaskType.MAIN));
                }
            }
        } catch (err: any) {
            logger.warn('check_main_task_queue_info_error', { mode: this.mode, message: err.message });
        }
        this._checkMainTaskTimerId = setTimeout(() => {
            this.checkMainTask(actualInterval).catch((err) => {
                logger.error('check_main_task_error', { mode: this.mode, message: err.message, stack: err.stack });
            });
        }, actualInterval);
    }

    private async checkFailedTask(): Promise<void> {
        try {
            const claimed = await this._throttleStore.tryClaimTaskTime(`FailedTask_${this.mode}`, this._config.getMinFailedTaskCheckInterval());
            if (claimed) {
                while (await this.pickFailedTask()) {
                    await sleep(1000);
                }
            }
        } catch (err: any) {
            // Never let an error skip the reschedule below, otherwise the retry loop dies.
            logger.warn('check_failed_task_iteration_error', { mode: this.mode, message: err.message, stack: err.stack });
        }
        const checkInterval = this._taskTimingFactory(this._config.getMinFailedTaskCheckInterval() / 2);
        this._checkFailedTaskTimerId = setTimeout(() => {
            this.checkFailedTask().catch((err) => {
                logger.error('check_failed_task_error', { mode: this.mode, message: err.message, stack: err.stack });
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
                // drop task; release any reservation so the item can be rediscovered later.
                if (this._scraper.handleDroppedTask) {
                    await this._scraper.handleDroppedTask(task);
                }
                logger.warn('drop_task', {
                    mode: this.mode,
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
