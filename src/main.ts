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
import { AcgRipScraper } from './scraper/acg-rip';
import { RESTServer } from './server';
import { DatabaseService } from './service/database-service';
import { MongodbItemStore } from './storage/mongodb-item-store';
import { MongodbTaskStore } from './storage/mongodb-task-store';
import { TaskOrchestra } from './task/task-orchestra';
import { TaskTiming } from './task/task-timing';
import { ConfigLoader, ItemStorage, Scraper, TaskQueue, TYPES_IDX } from './TYPES_IDX';
import './rest-api/items-query';
import { captureMessage } from './utils/sentry';
import { logger } from './utils/logger-factory';

/* Initialize container */
const container = new Container();
container.bind<ConfigLoader>(TYPES_IDX.ConfigLoader).to(ConfigManager).inSingletonScope();
const config = container.get<ConfigLoader>(TYPES_IDX.ConfigLoader);
config.load();

/* bind TaskStorage */
container.bind<DatabaseService>(DatabaseService).toSelf().inSingletonScope();
container.bind<TaskQueue>(TYPES_IDX.TaskStorage).to(MongodbTaskStore).inSingletonScope();

/* bind TaskOrchestra */
container.bind<interfaces.Factory<number>>(TYPES_IDX.TaskTimingFactory).toFactory<number>(TaskTiming);
container.bind<TaskOrchestra>(TaskOrchestra).toSelf().inTransientScope();

switch (config.mode) {
    case ConfigManager.DMHY:
        container.bind<ItemStorage<number>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
        container.bind<Scraper>(TYPES_IDX.Scraper).to(DmhyScraper).inSingletonScope();
        break;
    case ConfigManager.BANGUMI_MOE:
        container.bind<ItemStorage<string>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
        container.bind<Scraper>(TYPES_IDX.Scraper).to(BangumiMoe).inSingletonScope();
        break;
    case ConfigManager.NYAA:
        container.bind<ItemStorage<number>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
        container.bind<Scraper>(TYPES_IDX.Scraper).to(NyaaScraper).inSingletonScope();
        break;
    case ConfigManager.ACG_RIP:
        container.bind<ItemStorage<number>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
        container.bind<Scraper>(TYPES_IDX.Scraper).to(AcgRipScraper).inSingletonScope();
        break;
    default:
        throw new Error('Mode is not supported yet');
}

const scraper = container.get<Scraper>(TYPES_IDX.Scraper);
const databaseService = container.get<DatabaseService>(DatabaseService);

// catches Ctrl+C event
process.on('SIGINT', async () => {
    logger.info('stopping scrapper and store...');
    await scraper.end();
    await databaseService.onEnd();
    process.exit();
});

(async () => {
    await databaseService.onStart();
    await scraper.start();
})();

captureMessage(`starting ${config.mode} scraper, REST service listening ${config.serverHost}:${config.serverPort}`);

const server = new RESTServer(container, config);
server.start();
