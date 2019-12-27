import { Item } from './entity/Item';
import { Task } from './task/task-types';

export const TYPES = {
    ConfigLoader: Symbol.for('ConfigLoader'),
    PersistentStorage: Symbol.for('PersistentStorage'),
    Scraper: Symbol.for('Scraper'),
    TaskTimingFactory: Symbol.for('TaskTiming')
};

export interface PersistentStorage<T> {
    onStart(): Promise<void>;
    onEnd(): Promise<void>;
    deleteItem(id: T): Promise<boolean>;
    getItem(id: T): Promise<Item<T>|null>;
    hasItem(id: T): Promise<boolean>;
    filterItemNotStored(ids: T[]): Promise<T[]>;
    putItem(item: Item<T>): Promise<boolean>;
    searchItem(keyword: string): Promise<Array<Item<T>>>;
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
    load(): void;
}
