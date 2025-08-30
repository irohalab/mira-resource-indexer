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

import { Expect, Setup, SetupFixture, Teardown, Test, TestCase, TestFixture } from 'alsatian';
import { fail } from 'assert';
import { Container } from 'inversify';
import { MongoClient } from 'mongodb';
import { DatabaseService } from '../service/database-service';
import { FakeConfigManager } from '../test/fake-config';
import { items } from '../test/test-samples';
import { ItemStorage, TYPES_IDX } from '../TYPES_IDX';
import { MongodbItemStore } from './mongodb-item-store';
import { ConfigManager } from '../utils/config-manager';
import { Sentry, TYPES } from '@irohalab/mira-shared';
import { FakeSentry } from '../test/FakeSentry';

@TestFixture('MongodbStore test spec')
export class MongodbItemStoreSpec {
    private _store: MongodbItemStore<number>;
    private _config: ConfigManager;
    private _container: Container;
    private _databaseService: DatabaseService;

    private _collectionName: string = 'items';

    @SetupFixture
    public setupFixture() {
        if (!process.env.DB_NAME) {
            fail('You must set the Environment Variable DB_NAME to avoid potential damage to default database');
        }
        this._container = new Container();
        this._container.bind<ConfigManager>(TYPES.ConfigManager).to(FakeConfigManager).inSingletonScope();
        this._container.bind<DatabaseService>(DatabaseService).toSelf().inSingletonScope();
        this._container.bind<ItemStorage<number>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inTransientScope();
        this._container.bind<Sentry>(TYPES.Sentry).to(FakeSentry).inSingletonScope();
        this._config = this._container.get<ConfigManager>(TYPES.ConfigManager);
        this._config.prepare();
        // this._config.dbHost = 'mongo';
        (this._config as FakeConfigManager).dbPort = 27017;
    }

    @Setup
    public async databaseInit(): Promise<void> {
        // Cast to PostgresStore<number>
        this._databaseService = await this._container.get<DatabaseService>(DatabaseService);
        await this._databaseService.onStart();
        this._store = this._container.get<ItemStorage<number>>(TYPES_IDX.ItemStorage) as MongodbItemStore<number>;
    }

    @Teardown
    public async databaseCleanUp(): Promise<void> {
        await this._databaseService.onEnd();
        const client = await this._createClient();
        await client.db(this._config.getDbName()).collection(this._collectionName).drop();
    }

    @TestCase(0)
    @Test('Should able to put item and its properties')
    public async putItem(index: number): Promise<void> {
        // putItem will change item, so we need copy it
        const isSuccess = await this._store.putItem(Object.assign({}, items[index]));
        Expect(isSuccess).toBeTruthy();
        const client = await this._createClient();
        const result = await client
        .db(this._config.getDbName())
        .collection(this._collectionName)
        .find({})
        .project({ _id: 0 })
        .toArray();
        Expect(result.length).toBe(1);
        Object.keys(items[index]).forEach((k: string) => {
            Expect(items[index][k]).toEqual(result[0][k]);
        });
    }

    @TestCase('Dr. Stone', [0, 1])
    @Test('Should able to search item via keyword')
    public async searchItem(keyword: string, resultIndexes: number[]): Promise<void> {
        for (let item of items) {
            await this._store.putItem(Object.assign({}, item));
        }
        const result = await this._store.searchItem(keyword);
        Expect(result.length).toBe(resultIndexes.length);
        result.forEach((row, i) => {
            Expect(row.title).toBe(items[resultIndexes[i]].title);
        });
    }

    private async _createClient(): Promise<MongoClient> {
        const url = `mongodb://${this._config.getDbUser()}:${this._config.getDbPass()}@${
            this._config.getDbHost()
          }:${this._config.getDbPort()}?authSource=${this._config.getAuthSource()}`;
        return await MongoClient.connect(url);
    }
}
