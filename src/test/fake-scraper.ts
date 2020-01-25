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
import { Task, TaskType } from '../task/task-types';
import { Scraper } from '../types';
import { FakeTask } from './fake-task';

export const MIN_INTERVAL = 10;

export interface FakeResource {
    page: number;
    ids: number[];
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

    public executeTask(task: Task): Promise<any> {
        if (task.type === TaskType.SUB) {
            return this.doExecuteSubTask((task as FakeTask).payload);
        } else {
            if (task instanceof FakeTask) {
                return this.doExecuteMainTask(task.pageNo);
            } else {
                return this.doExecuteMainTask(1);
            }
        }
    }

    public start(): Promise<any> {
        this._taskOrchestra.queue(new FakeTask(TaskType.MAIN));
        this._taskOrchestra.start(this);
        return Promise.resolve(null);
    }

    private async doExecuteSubTask(payload: any): Promise<any> {
        this.resolvedIds.push({id: payload as number, timestamp: Date.now()});
    }

    private async doExecuteMainTask(page: number): Promise<any> {
        let ids = this.resources[page - 1].ids;
        for (let id of ids) {
            this._taskOrchestra.queue(new FakeTask(TaskType.SUB, id));
        }
        if (this.resources.length > page - 1) {
            let newMainTask = new FakeTask(TaskType.MAIN);
            newMainTask.pageNo = page + 1;
            this._taskOrchestra.queue(newMainTask);
        }
    }
}
