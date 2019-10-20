import { Container } from 'inversify';
import 'reflect-metadata';
import { Error } from 'tslint/lib/error';
import { ConfigManager } from './config';
import { BangumiMoe } from './scraper/bangumi-moe';
import { DmhyScraper } from './scraper/dmhy';
import { PostgresStore } from './storage/pg-store';
import { MongodbStore } from './storage/mongodb-store';
import { ConfigLoader, PersistentStorage, Scraper, TYPES } from './types';

const container = new Container();
container.bind<ConfigLoader>(TYPES.ConfigLoader).to(ConfigManager).inSingletonScope();
const config = container.get<ConfigLoader>(TYPES.ConfigLoader);
config.load();

let store: PersistentStorage<number|string>;
let dBStore: any;

switch (config.dbMode) {
    case ConfigManager.PG:
        dBStore = PostgresStore;
        break;
    case ConfigManager.MONGO:
        dBStore = MongodbStore;
        break;
    default:
        throw new Error('DB_MODE is not support yet');
}

switch (config.mode) {
    case ConfigManager.DMHY:
        container.bind<PersistentStorage<number>>(TYPES.PersistentStorage).to(dBStore).inSingletonScope();
        container.bind<Scraper>(TYPES.Scraper).to(DmhyScraper).inSingletonScope();
        store = container.get<PersistentStorage<number>>(TYPES.PersistentStorage);
        break;
    case ConfigManager.BANGUMI_MOE:
        container.bind<PersistentStorage<string>>(TYPES.PersistentStorage).to(dBStore).inSingletonScope();
        container.bind<Scraper>(TYPES.Scraper).to(BangumiMoe).inSingletonScope();
        store = container.get<PersistentStorage<string>>(TYPES.PersistentStorage);
        break;
    default:
        throw new Error('Mode is not supported yet');
}

const scraper = container.get<Scraper>(TYPES.Scraper);

// clean up
process.on('exit', async () => {
    await store.onEnd();
});

// catches Ctrl+C event
process.on('SIGINT', async () => {
    await scraper.end();
    process.exit();
});

(async () => {
    await store.onStart();
    await scraper.start();
    await scraper.end();
})().catch((e) => {
    console.error(e ? e.stack : 'unknown error');
});
