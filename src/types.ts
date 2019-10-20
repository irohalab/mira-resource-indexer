import { Item } from './entity/Item';

export const TYPES = {
    ConfigLoader: Symbol.for('ConfigLoader'),
    PersistentStorage: Symbol.for('PersistentStorage'),
    Scraper: Symbol.for('Scraper')
};

export interface PersistentStorage<T> {
    onStart(): Promise<void>;
    onEnd(): Promise<void>;
    deleteItem(id: T): Promise<boolean>;
    getItem(id: T): Promise<Item<T>|null>;
    hasItem(id: T): Promise<boolean>;
    filterItemNotStored(ids: T[]): Promise<T[]>;
    putItem(item: Item<T>): Promise<boolean>;
    getItemsByKeyword(keyword: string): Promise<T[]>; // only top 100 should be returned
}

export interface Scraper {
    start(): Promise<any>;
    end(): Promise<any>;
}

export interface ConfigLoader {
    mode: string;
    dbMode: string;
    dbHost: string;
    dbPort: number;
    dbUser: string;
    dbName: string;
    dbPass: string;
    rpcHost: string;
    rpcPort: number;
    load(): void;
}
