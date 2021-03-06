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

let taskCount = 0;

export enum TaskType {
    SUB = 0,
    MAIN = 1
}

export interface Task {
    id: number;
    type: TaskType;
    timestamp: number;
    retryCount?: number;
    updateTime?: number;
    equals(task: Task): boolean;
}

export class CommonTask implements Task {
    public id: number;
    public timestamp: number;
    public retryCount?: number;
    constructor(public type: TaskType) {
        this.id = taskCount++;
        this.timestamp = Date.now();
    }

    public equals(task: Task): boolean {
        return task.type === this.type && this.type === TaskType.MAIN;
    }
}
