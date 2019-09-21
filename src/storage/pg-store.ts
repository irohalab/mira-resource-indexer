import { injectable } from 'inversify';
import { Pool, PoolClient, QueryArrayConfig, QueryConfig } from 'pg';
import { ConfigManager } from '../config';
import { Item } from '../entity/Item';
import { ItemType } from '../entity/item-type';
import { Publisher } from '../entity/publisher';
import { Team } from '../entity/Team';
import { PersistentStorage } from '../types';
import { CREATE_TABLE_WITH_NUM_ID, CREATE_TABLE_WITH_STRING_ID } from './database-constant';

@injectable()
export class PostgresStore<T> implements PersistentStorage<T> {
    private _pool: Pool;
    private _tableNames = ['item', 'item_type', 'team', 'publisher', 'media_file'];

    public deleteItem(id: T): Promise<boolean> {
        return undefined;
    }

    public getItem(id: T): Promise<Item<T>|null> {
        return undefined;
    }

    public hasItem(id: T): Promise<boolean> {
        return undefined;
    }

    public async filterItemNotStored(ids: T[]): Promise<T[]> {
        let index = 1;
        const statementParam = ids.map(() => `($${index++})`).join(',');
        const queryConfig: QueryArrayConfig = {
            rowMode: 'array',
            text: `WITH tmp(id) AS (VALUES ${statementParam}) SELECT id FROM tmp WHERE id NOT IN (SELECT id FROM item)`,
            values: ids
        };
        const client = await this._pool.connect();
        try {
            const result = await client.query(queryConfig);
            return result.rows.map(row => row[0]);
        } catch (e) {
            console.warn(e.stack);
            return ids;
        } finally {
            await client.release();
        }
    }

    public async putItem(item: Item<T>): Promise<boolean> {
        console.log(item);
        const client = await this._pool.connect();
        try {
            let typeId;
            let teamId;
            let publisherId;
            if (item.type) {
                typeId = item.type.id;
                await this._putItemType(client, item.type);
            }
            if (item.team) {
                teamId = item.team.id;
                await this._putTeam(client, item.team);
            }
            if (item.publisher) {
                publisherId = item.publisher.id;
                await this._putPublisher(client, item.publisher);
            }
            const queryConfig: QueryConfig = {
                text: 'INSERT INTO item VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING',
                values: [
                    item.id,
                    item.title,
                    typeId,
                    teamId,
                    item.timestamp,
                    item.uri,
                    publisherId,
                    item.torrent_url,
                    item.magnet_uri
                ]
            };
            await client.query(queryConfig);
            if (item.files && item.files.length > 0) {
                let index = 1;
                let statementParameter = item.files
                    .map(() => `($${index++}, $${index++}, $${index++}, $${index++}, $${index++})`).join(',');
                let valuesArray: any[] = [];
                item.files.forEach(file => {
                    valuesArray.push(item.id);
                    valuesArray.push(file.path);
                    valuesArray.push(file.name);
                    valuesArray.push(file.ext);
                    valuesArray.push(file.size);
                });
                const mediaFilesQueryConfig: QueryConfig = {
                    text: 'INSERT INTO media_file (item_id, path, name, ext, size) VALUES ' + statementParameter,
                    values: valuesArray
                };
                await client.query(mediaFilesQueryConfig);
            }
            return true;
        } catch (e) {
            console.warn(e.stack);
            return false;
        } finally {
            client.release();
        }
    }

    public async onEnd(): Promise<void> {
        await this._pool.end();
    }

    public async onStart(): Promise<void> {
        const config = ConfigManager.getInstance();
        this._pool = new Pool({
            database: config.dbName,
            host: config.dbHost,
            password: config.dbPass,
            port: config.dbPort,
            user: config.dbUser
        });
        // this._pool.on('error', (err) => {
        //     console.error('Unexpected error on idle client', err);
        //     process.exit(-1);
        // });
        const allExists = await this._checkTables();
        if (allExists) {
            return Promise.resolve();
        }
        await this._createTables(config);
        return Promise.resolve();
    }

    /**
     * Check whether tables exists. Assume all table we created are all have the 'public' schema
     * @returns {Promise<boolean>} true if all exists, otherwise return false
     * @private
     */
    private async _checkTables(): Promise<boolean> {
        const client = await this._pool.connect();
        try {
            /* tslint:disable-next-line:max-line-length*/
            const result = await client.query('SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = \'public\'');
            return this._tableNames.every(name => {
                return result.rows.some(row => row.table_name === name);
            });
        } finally {
            client.release();
        }
    }

    /**
     * Create tables
     * @param {ConfigManager} config
     * @returns {Promise<any>}
     * @private
     */
    private async _createTables(config: ConfigManager): Promise<any> {
        const client = await this._pool.connect();
        let statement;
        if (config.mode === 'dmhy') {
            statement = CREATE_TABLE_WITH_NUM_ID;
        } else if (config.mode === 'bangumi_moe') {
            statement = CREATE_TABLE_WITH_STRING_ID;
        }
        try {
            await client.query(statement.ITEM);
            await client.query(statement.ITEM_TYPE);
            await client.query(statement.TEAM);
            await client.query(statement.PUBLISHER);
            await client.query(statement.MEDIA_FILE);
        } finally {
            client.release();
        }
    }

    private async _putItemType(client: PoolClient, itemType: ItemType<T>): Promise<void> {
        const queryConfig: QueryConfig = {
            text: 'INSERT INTO item_type VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
            values: [itemType.id, itemType.name]
        };
        await client.query(queryConfig);
    }

    private async _putTeam(client: PoolClient, team: Team<T>): Promise<void> {
        const queryConfig: QueryConfig = {
            text: 'INSERT INTO team VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
            values: [team.id, team.name]
        };
        await client.query(queryConfig);
    }

    private async _putPublisher(client: PoolClient, publisher: Publisher<T>): Promise<void> {
        const queryConfig: QueryConfig = {
            text: 'INSERT INTO publisher VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
            values: [publisher.id, publisher.name]
        };
        await client.query(queryConfig);
    }
}
