import { injectable } from 'inversify';
import { inspect } from 'util';
import { Item } from '../entity/Item';
import { PersistentStorage } from '../types';

@injectable()
export class InMemoryStore<T> implements PersistentStorage<T> {
    private _itemTable = new Map<T, Item<T>>();
    public deleteItem(id: T): Promise<boolean> {
        this._itemTable.delete(id);
        return Promise.resolve(true);
    }

    public getItem(id: T): Promise<Item<T>|null> {
        return Promise.resolve(this._itemTable.get(id));
    }

    public hasItem(id: T): Promise<boolean> {
        return Promise.resolve(this._itemTable.has(id));
    }

    public filterItemNotStored(ids: T[]): Promise<T[]> {
        return Promise.resolve(ids.filter(id => {
            return !this._itemTable.has(id);
        }));
    }

    public putItem(item: Item<T>): Promise<boolean> {
        this._itemTable.set(item.id, item);
        console.log(inspect(item, {depth: null}));
        return Promise.resolve(true);
    }

    public searchItem(keyword: string): Promise<Array<Item<T>>> {
        return undefined;
    }

    public onEnd(): Promise<void> {
        console.log('instance end');
        return Promise.resolve();
    }

    public onStart(): Promise<void> {
        console.log('instance start');
        return Promise.resolve();
    }

}
