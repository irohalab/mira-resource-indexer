import { Item } from './entity/Item';

export const TYPES = {
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
}

export interface Scraper {
    start(): Promise<any>;
    end(): Promise<any>;
}