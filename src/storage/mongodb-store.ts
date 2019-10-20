import { inject, injectable } from 'inversify';
import { MongoClient, Db } from 'mongodb';
import { Item } from '../entity/Item';
import { ConfigLoader, PersistentStorage, TYPES } from '../types';

@injectable()
export class MongodbStore<T> implements PersistentStorage<T> {

    private _db: Db;
    private _client: MongoClient;

    private _collectionName: string = 'items';

    constructor(@inject(TYPES.ConfigLoader) private _config: ConfigLoader) {
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
        const cursor = this._db.collection(this._collectionName).find({
            id: {
                $in: ids
            }
        }).project({ id: 1, _id: 0 });
        const stored = (await cursor.toArray()).map(x => x.id);
        const notStored = ids.filter(x => !stored.includes(x));
        return notStored;
    }

    public async putItem(item: Item<T>): Promise<boolean> {
        await this._db.collection(this._collectionName).insertOne(item);
        return Promise.resolve(true);
    }

    public async onEnd(): Promise<void> {
        await this._client.close();
    }

    public async onStart(): Promise<void> {
        const url = `mongodb://${this._config.dbUser}:${this._config.dbPass}@${
            this._config.dbHost
          }:${this._config.dbPort}?authSource=admin`;
        this._client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
        this._db = this._client.db(this._config.dbName);
        return Promise.resolve();
    }
}
