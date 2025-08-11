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
import { TaskOrchestra } from '../task/task-orchestra';
import { TaskStatus } from '../task/task-status';
import { Task, TaskType } from '../task/task-types';
import { Scraper } from '../TYPES_IDX';
import { FakeTask } from './fake-task';

export const MIN_INTERVAL = 10;

export interface FakeResource {
    page: number;
    subResources: FakeSubResource[];
}

export interface FakeSubResource {
    id: number;
    willSuccess: boolean;
    retryCount: number;
}

@injectable()
export class FakeScraper implements Scraper {

    public resources: FakeResource[];
    public resolvedIds: Array<{id: number, timestamp: number}>;

    constructor(@inject(TaskOrchestra) private _taskOrchestra: TaskOrchestra) {
        this.resolvedIds = [];
    }

    public end(): Promise<any> {
        this._taskOrchestra.stop();
        return Promise.resolve(null);
    }

    public async executeTask(task: Task): Promise<TaskStatus> {
        if (task.type === TaskType.SUB) {
            return await this.doExecuteSubTask(task as FakeTask);
        } else {
            if (task instanceof FakeTask) {
                await this.doExecuteMainTask(task.pageNo);
            } else {
                await this.doExecuteMainTask(1);
            }
            return TaskStatus.Success;
        }
    }

    public async start(): Promise<any> {
        await this._taskOrchestra.queue(new FakeTask(TaskType.MAIN));
        this._taskOrchestra.start(this);
        return Promise.resolve(null);
    }

    private async doExecuteSubTask(task: FakeTask): Promise<TaskStatus> {
        let payload = task.payload as FakeSubResource;
        if (payload.willSuccess) {
            this.resolvedIds.push({id: payload.id, timestamp: Date.now()});
            return TaskStatus.Success;
        } else if (payload.retryCount === 0) {
            return TaskStatus.Fail;
        } else {
            return TaskStatus.NeedRetry;
        }
    }

    private async doExecuteMainTask(page: number): Promise<any> {
        let subResources = this.resources[page - 1].subResources;
        for (let subResource of subResources) {
            await this._taskOrchestra.queue(new FakeTask(TaskType.SUB, subResource));
        }
        if (this.resources.length > page - 1) {
            let newMainTask = new FakeTask(TaskType.MAIN);
            newMainTask.pageNo = page + 1;
            await this._taskOrchestra.queue(newMainTask);
        }
    }
}
