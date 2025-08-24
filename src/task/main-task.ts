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

import { CommonTask, Task, TaskType } from './task-types';

export class MainTask extends CommonTask {
    public pageNo: number = 1;
    constructor(type: TaskType) {
        super(type);
    }

    public equals(task: Task): boolean {
        return task.type === this.type && (task as MainTask).pageNo === (task as MainTask).pageNo;
    }
}
