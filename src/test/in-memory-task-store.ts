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
import { Task } from '../task/task-types';
import { TaskQueue } from '../TYPES_IDX';

@injectable()
export class InMemoryTaskStore implements TaskQueue {
    private _taskQueue: Task[];
    private _failedTaskQueue: Task[];

    constructor() {
        this._taskQueue = [];
        this._failedTaskQueue = [];
    }

    public offerFailedTask(task: Task): Promise<boolean> {
        this._failedTaskQueue.push(task);
        return Promise.resolve(true);
    }

    public offerTask(task: Task): Promise<boolean> {
        this._taskQueue.push(task);
        return Promise.resolve(true);
    }

    public hasFailedTask(): Promise<boolean> {
        return Promise.resolve(this._failedTaskQueue.length !== 0);
    }

    public hasTask(): Promise<boolean> {
        return Promise.resolve(this._taskQueue.length !== 0);
    }

    public pollFailedTask(): Promise<Task> {
        return Promise.resolve(this._failedTaskQueue.shift());
    }

    public pollTask(): Promise<Task> {
        return Promise.resolve(this._taskQueue.shift());
    }

}
