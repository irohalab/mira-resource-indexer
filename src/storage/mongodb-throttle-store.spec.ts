/*
 * Copyright 2026 IROHA LAB
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

import { Expect, Setup, SetupFixture, Teardown, Test, TestFixture } from 'alsatian';
import { fail } from 'assert';
import { Container } from 'inversify';
import { MongoClient } from 'mongodb';
import { DatabaseService } from '../service/database-service';
import { MongoClientProvider } from '../service/mongo-client-provider';
import { FakeConfigManager } from '../test/fake-config';
import { ThrottleStore, TYPES_IDX } from '../TYPES_IDX';
import { MongodbThrottleStore } from './mongodb-throttle-store';
import { ConfigManager } from '../utils/config-manager';
import { Sentry, TYPES } from '@irohalab/mira-shared';
import { FakeSentry } from '../test/FakeSentry';

@TestFixture('MongodbThrottleStore test spec')
export class MongodbThrottleStoreSpec {
    private _store: MongodbThrottleStore;
    private _config: ConfigManager;
    private _container: Container;
    private _databaseService: DatabaseService;
    private _mongoClientProvider: MongoClientProvider;

    private _collectionName: string = 'throttle';
    private static readonly TEST_MODE = 'test';
    private dbName: string;

    @SetupFixture
    public setupFixture() {
        if (!process.env.DB_NAME) {
            fail('You must set the Environment Variable DB_NAME to avoid potential damage to default database');
        }
        this._container = new Container();
        this._container.bind<ConfigManager>(TYPES.ConfigManager).to(FakeConfigManager).inSingletonScope();
        this._container.bind<MongoClientProvider>(MongoClientProvider).toSelf().inSingletonScope();
        this._container.bind<string>(TYPES_IDX.DBName).toConstantValue(`${MongodbThrottleStoreSpec.TEST_MODE}_indexer`);
        this._container.bind<DatabaseService>(DatabaseService).toSelf().inSingletonScope();
        this._container.bind<ThrottleStore>(TYPES_IDX.ThrottleStore).to(MongodbThrottleStore).inTransientScope();
        this._container.bind<Sentry>(TYPES.Sentry).to(FakeSentry).inSingletonScope();
        this._config = this._container.get<ConfigManager>(TYPES.ConfigManager);
        this.dbName = this._container.get(TYPES_IDX.DBName);
        (this._config as FakeConfigManager).dbPort = 27017;
    }

    @Setup
    public async databaseInit(): Promise<void> {
        this._mongoClientProvider = this._container.get<MongoClientProvider>(MongoClientProvider);
        await this._mongoClientProvider.connect();
        this._databaseService = this._container.get<DatabaseService>(DatabaseService);
        await this._databaseService.onStart();
        this._store = this._container.get<ThrottleStore>(TYPES_IDX.ThrottleStore) as MongodbThrottleStore;
    }

    @Teardown
    public async databaseCleanUp(): Promise<void> {
        const client = await this._createClient();
        try {
            const cur = client.db(this.dbName).listCollections({}, { nameOnly: true });
            const existCollections = await cur.toArray();
            for (let collection of existCollections) {
                await client.db(this.dbName).collection(collection.name).drop();
            }
        } finally {
            await client.close();
        }
        await this._mongoClientProvider.close();
    }

    @Test('Should claim a fresh slot and reject an immediate re-claim')
    public async claimAndThrottle(): Promise<void> {
        Expect(await this._store.tryClaimTaskTime('MainTask_test', 10000)).toBe(true);
        Expect(await this._store.tryClaimTaskTime('MainTask_test', 10000)).toBe(false);
    }

    @Test('Should allow a re-claim after the interval has elapsed')
    public async reclaimAfterInterval(): Promise<void> {
        Expect(await this._store.tryClaimTaskTime('MainTask_test', 50)).toBe(true);
        await this.sleep(80);
        Expect(await this._store.tryClaimTaskTime('MainTask_test', 50)).toBe(true);
    }

    @Test('Distinct names should be claimed independently')
    public async independentNames(): Promise<void> {
        Expect(await this._store.tryClaimTaskTime('MainTask_test', 10000)).toBe(true);
        Expect(await this._store.tryClaimTaskTime('FailedTask_test', 10000)).toBe(true);
        Expect(await this._store.tryClaimTaskTime('MainTask_test', 10000)).toBe(false);
    }

    @Test('Should keep a single record per name across repeated claims')
    public async singleRecordPerName(): Promise<void> {
        Expect(await this._store.tryClaimTaskTime('MainTask_test', 50)).toBe(true);
        await this.sleep(80);
        Expect(await this._store.tryClaimTaskTime('MainTask_test', 50)).toBe(true);
        const client = await this._createClient();
        try {
            const docs = await client.db(this.dbName).collection(this._collectionName)
                .find({ name: 'MainTask_test' }).toArray();
            Expect(docs.length).toBe(1);
        } finally {
            await client.close();
        }
    }

    @Test('Should collapse legacy duplicate records and enforce a unique index')
    public async dedupeLegacyDuplicates(): Promise<void> {
        // Simulate duplicate records left by the previous non-atomic implementation.
        const seedClient = await this._createClient();
        try {
            await seedClient.db(this.dbName).collection(this._collectionName).insertMany([
                { name: 'MainTask_test', timestamp: 1 },
                { name: 'MainTask_test', timestamp: 2 },
                { name: 'MainTask_test', timestamp: 3 }
            ]);
        } finally {
            await seedClient.close();
        }

        // The first claim triggers the one-time dedup + unique index creation. The seeded
        // timestamps are ancient, so the claim should succeed.
        Expect(await this._store.tryClaimTaskTime('MainTask_test', 10000)).toBe(true);

        const client = await this._createClient();
        try {
            const docs = await client.db(this.dbName).collection(this._collectionName)
                .find({ name: 'MainTask_test' }).toArray();
            Expect(docs.length).toBe(1);
            const indexes = await client.db(this.dbName).collection(this._collectionName).indexes();
            const hasUniqueNameIndex = indexes.some((ix: any) => ix.unique === true && ix.key && ix.key.name === 1);
            Expect(hasUniqueNameIndex).toBe(true);
        } finally {
            await client.close();
        }
    }

    private async _createClient(): Promise<MongoClient> {
        const url = `mongodb://${this._config.getDbUser()}:${this._config.getDbPass()}@${
            this._config.getDbHost()
          }:${this._config.getDbPort()}?authSource=${this._config.getAuthSource()}`;
        return await MongoClient.connect(url);
    }

    private sleep(milliseconds: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }
}
