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

import { DatabaseService } from '../service/database-service';
import { inject, injectable } from 'inversify';
import { ThrottleStore } from '../TYPES_IDX';
import { Collection, Db, ObjectId } from 'mongodb';
import { TYPES } from '@irohalab/mira-shared';
import { ConfigManager } from '../utils/config-manager';

interface ThrottleRecord {
    name: string;
    timestamp: number;
}

@injectable()
export class MongodbThrottleStore implements ThrottleStore {

    private get db(): Db {
        return this._databaseService.db;
    }

    private _throttleCollectionName = 'throttle';
    private _indexReady: Promise<void> | null = null;

    constructor(private _databaseService: DatabaseService,
                @inject(TYPES.ConfigManager) private _config: ConfigManager) {
        this._databaseService.checkCollection([this._throttleCollectionName]);
    }

    /**
     * Atomically check if enough time has passed and claim the slot.
     * Returns true if this caller won the claim, false if a recent claim is still active.
     *
     * The whole decision is a single atomic `findOneAndUpdate` guarded by a unique index on
     * `name` (see ensureUniqueIndex):
     *  - record is stale (timestamp <= threshold) -> filter matches -> update -> claimed;
     *  - record is absent                          -> upsert inserts -> claimed;
     *  - record exists but is still recent         -> filter misses -> upsert attempts an
     *    insert that violates the unique index (E11000) -> not claimed.
     * Because everything happens in one operation, concurrent callers cannot both claim the
     * same slot: MongoDB serializes writes to the document, so the loser always hits E11000.
     */
    public async tryClaimTaskTime(name: string, minInterval: number): Promise<boolean> {
        await this.ensureUniqueIndex();
        const now = Date.now();
        const threshold = now - minInterval;
        try {
            const result = await this.db.collection<ThrottleRecord>(this._throttleCollectionName).findOneAndUpdate(
                { name, timestamp: { $lte: threshold } },
                { $set: { name, timestamp: now } },
                { upsert: true, returnDocument: 'after' }
            );
            return result != null;
        } catch (e: any) {
            if (e && (e.code === 11000 || e.codeName === 'DuplicateKey')) {
                // A record already exists and its timestamp is still recent:
                // another caller holds the claim.
                return false;
            }
            throw e;
        }
    }

    /**
     * Ensure the unique index on `name` exists, running the one-time setup at most once per
     * process. Memoized; on failure the memo is cleared so a later call can retry.
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
     * Collapse legacy duplicate throttle records (created by a previous non-atomic
     * implementation) into a single record per name, then create the unique index on `name`
     * that tryClaimTaskTime relies on for atomicity.
     *
     * This is safe to run concurrently from multiple processes/machines against the same
     * MongoDB:
     *  - createIndex is attempted first; if the index already exists it is a no-op, and once
     *    ANY process succeeds the unique constraint is enforced server-side for everyone,
     *    which stops further duplicates from being inserted;
     *  - if duplicates block index creation, they are removed with a DELETE-ONLY pass that
     *    keeps a deterministically-chosen record and deletes the extras by their specific
     *    _id. Deleting an already-deleted _id is a no-op, so concurrent runs cannot recreate
     *    duplicates or delete the surviving record.
     */
    private async doEnsureUniqueIndex(): Promise<void> {
        const collection = this.db.collection<ThrottleRecord>(this._throttleCollectionName);
        const maxAttempts = 5;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                await collection.createIndex({ name: 1 }, { unique: true });
                return;
            } catch (e: any) {
                if (!(e && (e.code === 11000 || e.codeName === 'DuplicateKey'))) {
                    throw e;
                }
                // Duplicates block the unique index (possibly re-created by a concurrent
                // claim while the index did not yet exist). Remove the extras and retry.
                await this.removeDuplicateRecords(collection);
            }
        }
        // Final attempt: surface the error if duplicates still somehow persist.
        await collection.createIndex({ name: 1 }, { unique: true });
    }

    /**
     * Delete-only de-duplication: for every name with more than one record, keep the record
     * with the newest timestamp (ties broken by _id so the choice is deterministic across
     * machines) and delete the others by their specific _id. Never inserts, so it is
     * idempotent and safe under concurrent execution.
     */
    private async removeDuplicateRecords(collection: Collection<ThrottleRecord>): Promise<void> {
        const groups = await collection.aggregate<{ _id: string, ids: ObjectId[] }>([
            { $sort: { timestamp: -1, _id: 1 } },
            { $group: { _id: '$name', ids: { $push: '$_id' } } },
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
