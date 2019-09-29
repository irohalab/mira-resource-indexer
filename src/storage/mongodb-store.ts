import { injectable } from 'inversify';
import { ConfigManager } from '../config';
import mongoose from 'mongoose';
import { Item } from '../entity/Item';
import { ItemType } from '../entity/item-type';
import { Publisher } from '../entity/publisher';
import { Team } from '../entity/Team';
import { PersistentStorage } from '../types';

@injectable()
export class MongodbStore<T> implements PersistentStorage<T> {
    private _itemModel: mongoose.Model<mongoose.Document & Item<number>>;
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
        const checkIds = ids.map(id => this._findById(id));
        return Promise.all(checkIds).then(vals => {
            const notStoredIds: T[] = [];
            vals.forEach((val, index) => {
                if (!val) {
                    notStoredIds.push(ids[index])
                }
            })
            return notStoredIds;
        })
    }

    public async putItem(item: Item<T>): Promise<boolean> {
        const itemData = new this._itemModel(item);
        itemData.save(function (err) {
            if (!err) console.log('Success!');
        });
        return Promise.resolve(true);
    }

    public async onEnd(): Promise<void> { 
        await mongoose.disconnect();
    }

    public async onStart(): Promise<void> {
        const config = ConfigManager.getInstance();
        const itemSchema = new mongoose.Schema({
            id: Number,
            title: String,
            files: [{
                id: Number,
                item_id: Number,
                path: String,
                name: String,
                ext: String,
                size: String
            }],
            type: [{
                id: Number,
                name: String
            }],
            team: [{
                id: Number,
                name: String
            }],
            timestamp: Date,
            uri: String,
            publisher: [{
                id: Number,
                name: String
            }],
            torrent_url: String,
            magnet_uri: String
        });

        this._itemModel = mongoose.model('Item', itemSchema);
        return mongoose
            .connect(
                `mongodb://${config.dbUser}:${config.dbPass}@${config.dbHost}:${config.dbPort}/${config.dbName}?authSource=admin`,
                {
                    useNewUrlParser: true,
                    useCreateIndex: true,
                    useUnifiedTopology: true
                }
            ).then(() => { })
            .catch(err => {
                console.log("MongoDB connection error. Please make sure MongoDB is running. " + err);
                process.exit();
            });
    }

    private async _findById(id: T): Promise<boolean> {
        return new Promise((resolve) => {
            this._itemModel.find({ id }, function (err, item) {
                if (err) {
                    console.log(err);
                }
                if (item.length > 0) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            })
        });
    }
}
