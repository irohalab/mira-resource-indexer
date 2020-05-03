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
import { inspect } from 'util';
import { Item } from '../entity/Item';
import { ItemStorage } from '../types';

@injectable()
export class InMemoryStore<T> implements ItemStorage<T> {
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
