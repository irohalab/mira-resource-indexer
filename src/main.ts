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

import { Container, interfaces } from 'inversify';
import 'reflect-metadata';
import { ConfigManager } from './config';
import { BangumiMoe } from './scraper/bangumi-moe';
import { DmhyScraper } from './scraper/dmhy';
import { NyaaScraper } from './scraper/nyaa';
import { RESTServer } from './server';
import { MongodbStore } from './storage/mongodb-store';
import { TaskOrchestra } from './task/task-orchestra';
import { TaskTiming } from './task/task-timing';
import { ConfigLoader, PersistentStorage, Scraper, TYPES } from './types';
import './service/items-query';
import { captureMessage } from './utils/sentry';

/* Initialize container */
const container = new Container();
container.bind<ConfigLoader>(TYPES.ConfigLoader).to(ConfigManager).inSingletonScope();
const config = container.get<ConfigLoader>(TYPES.ConfigLoader);
config.load();
/* bind TaskOrchestra */
container.bind<interfaces.Factory<number>>(TYPES.TaskTimingFactory).toFactory<number>(TaskTiming);
container.bind<TaskOrchestra>(TaskOrchestra).toSelf().inTransientScope();

let store: PersistentStorage<number|string>;

switch (config.mode) {
    case ConfigManager.DMHY:
        container.bind<PersistentStorage<number>>(TYPES.PersistentStorage).to(MongodbStore).inSingletonScope();
        container.bind<Scraper>(TYPES.Scraper).to(DmhyScraper).inSingletonScope();
        store = container.get<PersistentStorage<number>>(TYPES.PersistentStorage);
        break;
    case ConfigManager.BANGUMI_MOE:
        container.bind<PersistentStorage<string>>(TYPES.PersistentStorage).to(MongodbStore).inSingletonScope();
        container.bind<Scraper>(TYPES.Scraper).to(BangumiMoe).inSingletonScope();
        store = container.get<PersistentStorage<string>>(TYPES.PersistentStorage);
        break;
    case ConfigManager.NYAA:
        container.bind<PersistentStorage<number>>(TYPES.PersistentStorage).to(MongodbStore).inSingletonScope();
        container.bind<Scraper>(TYPES.Scraper).to(NyaaScraper).inSingletonScope();
        store = container.get<PersistentStorage<number>>(TYPES.PersistentStorage);
        break;
    default:
        throw new Error('Mode is not supported yet');
}

const scraper = container.get<Scraper>(TYPES.Scraper);

// catches Ctrl+C event
process.on('SIGINT', async () => {
    console.log('stopping scrapper and store...');
    await scraper.end();
    await store.onEnd();
    process.exit();
});

(async () => {
    await store.onStart();
    await scraper.start();
})();

captureMessage(`starting ${config.mode} scraper, REST service listening ${config.serverHost}:${config.serverPort}`);

const server = new RESTServer(container, config);
server.start();
