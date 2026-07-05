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
import { Collection, Db, ObjectId } from 'mongodb';
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
    private _indexReady: Promise<void> | null = null;

    constructor(@inject(TYPES.ConfigManager) private _config: ConfigManager,
                private _databaseService: DatabaseService) {
        this._databaseService.checkCollection([this._collectionName]);
    }

    public async deleteItem(id: T): Promise<boolean> {
        const result = await this.db.collection(this._collectionName).deleteMany({ id });
        return result.deletedCount > 0;
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

    /**
     * Atomically reserve an item at discovery time before a sub task is queued for it.
     * Inserts a stub record (complete: false) keyed by the business `id`. Returns true only if
     * this call created the reservation, so a concurrent or later main task that rediscovers
     * the same item will NOT queue a duplicate sub task. The unique index on `id` makes the
     * upsert race-safe (a losing concurrent insert throws E11000, which we treat as "already
     * reserved").
     */
    public async reserveItem(item: Item<T>): Promise<boolean> {
        await this.ensureUniqueIndex();
        const payload: any = Object.assign({}, item);
        delete payload._id;
        delete payload.id;
        try {
            const result = await this.db.collection(this._collectionName).updateOne(
                { id: item.id },
                { $setOnInsert: Object.assign(payload, { complete: false }) },
                { upsert: true }
            );
            return result.upsertedCount === 1;
        } catch (e: any) {
            if (e && (e.code === 11000 || e.codeName === 'DuplicateKey')) {
                return false;
            }
            throw e;
        }
    }

    /**
     * Store the fully-scraped item, filling in the reservation stub and marking it complete.
     * Upserts (rather than inserts) so it is idempotent and works even if the reservation is
     * missing.
     */
    public async putItem(item: Item<T>): Promise<boolean> {
        await this.ensureUniqueIndex();
        const payload: any = Object.assign({}, item);
        delete payload._id;
        delete payload.id;
        await this.db.collection(this._collectionName).updateOne(
            { id: item.id },
            { $set: Object.assign(payload, { complete: true }) },
            { upsert: true }
        );
        return true;
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
            },
            $or: [{ complete: true }, { complete: { $exists: false } }]
        }).sort({ timestamp: -1 }).limit(this._config.getMaxSearchCount());
        return Promise.resolve(cursor.toArray());
    }

    /**
     * Ensure the unique index on `id` exists, running the one-time setup at most once per
     * process. Memoized; the memo is cleared on failure so a later call can retry.
     */
    private ensureUniqueIndex(): Promise<void> {
        if (!this._indexReady) {
            this._indexReady = this.doEnsureUniqueIndex().catch((e) => {
                this._indexReady = null;
                throw e;
            });
        }
        return this._indexReady;
    }

    /**
     * Create the unique index on `id`. If legacy duplicate item documents (from the previous
     * insertOne-based putItem) block it, collapse them with a delete-only pass and retry. Once
     * the index exists it is enforced server-side, preventing any further duplicates.
     */
    private async doEnsureUniqueIndex(): Promise<void> {
        const collection = this.db.collection<Item<T>>(this._collectionName);
        const maxAttempts = 5;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                await collection.createIndex({ id: 1 }, { unique: true });
                return;
            } catch (e: any) {
                if (!(e && (e.code === 11000 || e.codeName === 'DuplicateKey'))) {
                    throw e;
                }
                await this.removeDuplicateItems(collection);
            }
        }
        await collection.createIndex({ id: 1 }, { unique: true });
    }

    /**
     * Delete-only de-duplication: for every business `id` with more than one document, keep the
     * most complete / newest one (complete desc, then timestamp desc, ties broken by _id for a
     * deterministic choice) and delete the rest by their specific _id. Never inserts, so it is
     * idempotent and safe to run repeatedly.
     */
    private async removeDuplicateItems(collection: Collection<Item<T>>): Promise<void> {
        const groups = await collection.aggregate<{ _id: T, ids: ObjectId[] }>([
            { $sort: { complete: -1, timestamp: -1, _id: 1 } },
            { $group: { _id: '$id', ids: { $push: '$_id' } } },
            { $match: { 'ids.1': { $exists: true } } }
        ]).toArray();
        for (const group of groups) {
            const extraIds = group.ids.slice(1);
            if (extraIds.length > 0) {
                await collection.deleteMany({ _id: { $in: extraIds } });
            }
        }
    }
}
