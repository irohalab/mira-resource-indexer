import { Expect, Ignore, Setup, SetupFixture, Teardown, TeardownFixture, Test, TestCase, TestFixture } from 'alsatian';
import { Container } from 'inversify';
import { Client } from 'pg';
import { FakeConfigManager } from '../test/fake-config';
import { Item } from '../entity/Item';
import { ConfigLoader, PersistentStorage, TYPES } from '../types';
import { items } from '../utils/test-samples';
import { PostgresStore } from './pg-store';

const tableNames = ['item', 'item_type', 'team', 'publisher', 'media_file'];

@TestFixture('PgStore test spec')
export class PgStoreSpec {
    private _store: PostgresStore<number>;
    private _config: ConfigLoader;
    private _container: Container;

    @SetupFixture
    public setupFixture() {
        this._container = new Container();
        this._container.bind<ConfigLoader>(TYPES.ConfigLoader).to(FakeConfigManager).inSingletonScope();
        this._container.bind<PersistentStorage<number>>(TYPES.PersistentStorage).to(PostgresStore).inTransientScope();
        this._config = this._container.get<ConfigLoader>(TYPES.ConfigLoader);
        this._config.load();
        this._config.dbHost = 'pg';
        this._config.dbPort = 5432;
    }

    @Setup
    public async databaseInit(): Promise<void> {
        // Cast to PostgresStore<number>
        this._store = this._container.get<PersistentStorage<number>>(TYPES.PersistentStorage) as PostgresStore<number>;
        await this._store.onStart();
    }

    @Teardown
    public async databaseCleanUp(): Promise<void> {
        await this._store.onEnd();
        const client = this._createClient();
        await client.connect();
        await client.query('DROP TABLE ' + tableNames.join(', '));
        await client.end();
    }

    @Test('Should create tables')
    public async shouldCreateTables(): Promise<void> {
        const client = this._createClient();
        await client.connect();
        const result = await client.query(
            'SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = \'public\'');
        Expect(tableNames.every(name => {
            return result.rows.some(row => row.table_name === name);
        })).toBeTruthy();
        console.log('should create tables');
        await client.end();
    }

    @TestCase(items[0])
    @Test('Should able to put item and its properties')
    public async putItem(item: Item<number>): Promise<void> {
        const isSuccess = await this._store.putItem(item);
        Expect(isSuccess).toBeTruthy();
        const client = this._createClient();
        await client.connect();
        const result = await client.query('SELECT * from item');
        Expect(result.rows.length).toBe(1);
        Object.keys(item).forEach((k: string) => {
            if (k === 'type' || k === 'team' || k === 'publisher' || k === 'files') {
                return;
            }
            if (k === 'timestamp') {
                Expect(item.timestamp.valueOf()).toBe((result.rows[0][k] as Date).valueOf());
            } else {
                Expect(item[k]).toBe(result.rows[0][k]);
            }
        });

        const typeResult = await client.query('SELECT * from item_type');
        Expect(typeResult.rows.length).toBe(1);
        Expect(typeResult.rows[0].id).toBe(item.type.id);
        Expect(typeResult.rows[0].name).toBe(item.type.name);

        const teamResult = await client.query('SELECT * from team');
        Expect(teamResult.rows.length).toBe(1);
        Expect(teamResult.rows[0].id).toBe(item.team.id);
        Expect(teamResult.rows[0].name).toBe(item.team.name);

        const publisherResult = await client.query('SELECT * from publisher');
        Expect(publisherResult.rows.length).toBe(1);
        Expect(publisherResult.rows[0].id).toBe(item.publisher.id);
        Expect(publisherResult.rows[0].name).toBe(item.publisher.name);

        const mediaFilesResult = await client.query('SELECT * from media_file');
        Expect(mediaFilesResult.rows.length).toBe(1);
        Expect(mediaFilesResult.rows[0].id).toBeDefined();
        Expect(mediaFilesResult.rows[0].item_id).toBe(item.id);
        Expect(mediaFilesResult.rows[0].path).toBe(item.files[0].path);
        Expect(mediaFilesResult.rows[0].name).toBe(item.files[0].name);
        Expect(mediaFilesResult.rows[0].ext).toBe(item.files[0].ext);
        Expect(mediaFilesResult.rows[0].size).toBe(item.files[0].size);

        await client.end();
    }

    private _createClient(): Client {
        return new Client({
            database: this._config.dbName,
            host: this._config.dbHost,
            password: this._config.dbPass,
            port: this._config.dbPort,
            user: this._config.dbUser
        });
    }
}
