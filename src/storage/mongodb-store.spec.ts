import { Expect, Ignore, Setup, SetupFixture, Teardown, TeardownFixture, Test, TestCase, TestFixture } from 'alsatian';
import { fail } from 'assert';
import { Container } from 'inversify';
import { FakeConfigManager } from '../test/fake-config';
import { Item } from '../entity/Item';
import { ConfigLoader, PersistentStorage, TYPES } from '../types';
import { items } from '../utils/test-samples';
import { MongoClient } from 'mongodb';
import { MongodbStore } from './mongodb-store';

@TestFixture('MongodbStore test spec')
export class MongodbStoreSpec {
    private _store: MongodbStore<number>;
    private _config: ConfigLoader;
    private _container: Container;

    private _collectionName: string = 'items';

    @SetupFixture
    public setupFixture() {
        if (!process.env.DB_NAME) {
            fail('You must set the Environment Variable DB_NAME to avoid potential damage to default database');
        }
        this._container = new Container();
        this._container.bind<ConfigLoader>(TYPES.ConfigLoader).to(FakeConfigManager).inSingletonScope();
        this._container.bind<PersistentStorage<number>>(TYPES.PersistentStorage).to(MongodbStore).inTransientScope();
        this._config = this._container.get<ConfigLoader>(TYPES.ConfigLoader);
        this._config.load();
        this._config.dbHost = 'mongo';
        this._config.dbPort = 27017;
    }

    @Setup
    public async databaseInit(): Promise<void> {
        // Cast to PostgresStore<number>
        this._store = this._container.get<PersistentStorage<number>>(TYPES.PersistentStorage) as MongodbStore<number>;
        await this._store.onStart();
    }

    @Teardown
    public async databaseCleanUp(): Promise<void> {
        await this._store.onEnd();
        const client = await this._createClient();
        await client.db(this._config.dbName).collection(this._collectionName).drop();
    }

    @TestCase(items[0])
    @Test('Should able to put item and its properties')
    public async putItem(item: Item<number>): Promise<void> {
        // putItem will change item, so we need copy it
        const isSuccess = await this._store.putItem(Object.assign({}, item));
        Expect(isSuccess).toBeTruthy();
        const client = await this._createClient();
        const result = await client
        .db(this._config.dbName)
        .collection(this._collectionName)
        .find({})
        .project({ _id: 0 })
        .toArray();
        Expect(result.length).toBe(1);
        Object.keys(item).forEach((k: string) => {
            Expect(item[k]).toEqual(result[0][k]);
        });
    }

    private async _createClient(): Promise<MongoClient> {
        const url = `mongodb://${this._config.dbUser}:${this._config.dbPass}@${
            this._config.dbHost
          }:${this._config.dbPort}?authSource=admin`;
        return await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    }
}
