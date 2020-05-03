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

import { Item } from './entity/Item';
import { Task } from './task/task-types';

export const TYPES = {
    ConfigLoader: Symbol.for('ConfigLoader'),
    ItemStorage: Symbol.for('ItemStorage'),
    Scraper: Symbol.for('Scraper'),
    TaskStorage: Symbol.for('TaskStorage'),
    TaskTimingFactory: Symbol.for('TaskTiming')
};

export interface ItemStorage<T> {
    deleteItem(id: T): Promise<boolean>;
    getItem(id: T): Promise<Item<T>|null>;
    hasItem(id: T): Promise<boolean>;
    filterItemNotStored(ids: T[]): Promise<T[]>;
    putItem(item: Item<T>): Promise<boolean>;
    searchItem(keyword: string): Promise<Array<Item<T>>>;
}

export interface TaskStorage {
    enqueueTask(task: Task): Promise<boolean>;
    getTask(task: Task): Promise<Task>;
    enqueueFailedTask(task: Task): Promise<boolean>;
    getFailedTask(task: Task): Promise<Task>;
    cleanTask(): Promise<boolean>;
    cleanFailedTask(): Promise<boolean>;
    hasTask(): Promise<boolean>;
    hasFailedTask(): Promise<boolean>;
}

export interface Scraper {
    start(): Promise<any>;
    end(): Promise<any>;
    executeTask(task: Task): Promise<any>;
}

export interface ConfigLoader {
    mode: string;
    dbMode: string;
    dbHost: string;
    dbPort: number;
    dbUser: string;
    dbName: string;
    dbPass: string;
    authSource: string; // see: https://docs.mongodb.com/manual/core/security-users/#user-authentication-database
    serverHost: string;
    serverPort: number;
    minInterval: number; // for task, unit is millisecond
    minCheckInterval: number; // for main task, unit is millisecond
    maxPageNo: number; // max page number for scrapping
    maxSearchCount: number; // max search result count
    load(): void;
}
