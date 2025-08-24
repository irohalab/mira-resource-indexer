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
import { Db } from 'mongodb';
import { Item } from '../entity/Item';
import { DatabaseService } from '../service/database-service';
import { ItemStorage } from '../TYPES_IDX';
import { escapeRegExp } from '../utils/normalize';
import { TYPES } from '@irohalab/mira-shared';
import { ConfigManager } from '../utils/config-manager';

@injectable()
export class MongodbItemStore<T> implements ItemStorage<T> {

    private get db(): Db {
        return this._databaseService.db;
    }

    private _collectionName: string = 'items';

    constructor(@inject(TYPES.ConfigManager) private _config: ConfigManager,
                private _databaseService: DatabaseService) {
        this._databaseService.checkCollection([this._collectionName]);
    }

    public deleteItem(id: T): Promise<boolean> {
        return undefined;
    }

    public getItem(id: T): Promise<Item<T> | null> {
        return undefined;
    }

    public hasItem(id: T): Promise<boolean> {
        return undefined;
    }

    public async filterItemNotStored(ids: T[]): Promise<T[]> {
        const cursor = this.db.collection(this._collectionName).find({
            id: {
                $in: ids
            }
        }).project({ id: 1, _id: 0 });
        const stored = (await cursor.toArray()).map(x => x.id);
        const notStored = ids.filter(x => !stored.includes(x));
        return notStored;
    }

    public async putItem(item: Item<T>): Promise<boolean> {
        await this.db.collection(this._collectionName).insertOne(Object.assign({}, item));
        return Promise.resolve(true);
    }

    public searchItem(keyword: string): Promise<Item<T>[]> {
        let rgxArr = keyword.trim().split(/\s+/);
        if (rgxArr.length === 0) {
            return Promise.resolve([]);
        }
        let rgx = rgxArr.map(s => escapeRegExp(s)).join('.*?');
        const cursor = this.db.collection<Item<T>>(this._collectionName).find({
            title: {
                $options: 'i',
                $regex: rgx
            }
        }).sort({ timestamp: -1 }).limit(this._config.getMaxSearchCount());
        return Promise.resolve(cursor.toArray());
    }
}
