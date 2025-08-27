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

import 'reflect-metadata';
import { Container, interfaces } from 'inversify';
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
import { EventLogStore, ItemStorage, Scraper, TaskQueue, ThrottleStore, TYPES_IDX } from './TYPES_IDX';
import './rest-api/items-query';
import { logger } from './utils/logger-factory';
import { MongodbThrottleStore } from './storage/mongodb-throttle-store';
import { RabbitMQService, Sentry, SentryImpl, TYPES } from '@irohalab/mira-shared';
import { RascalImpl } from '@irohalab/mira-shared/services/RascalImpl';
import { ConfigManagerImpl } from './utils/config-manager-impl';
import { ACG_RIP, BANGUMI_MOE, ConfigManager, DMHY, MIKANANI_ME, NYAA } from './utils/config-manager';
import { hostname } from 'os';
import { MongodbEventLogStore } from './storage/mongodb-event-log-store';
import { MikananiMe } from './scraper/mikanani-me';

/* Initialize container */
const container = new Container();
container.bind<ConfigManager>(TYPES.ConfigManager).to(ConfigManagerImpl).inSingletonScope();

const config = container.get<ConfigManager>(TYPES.ConfigManager);
config.prepare();

// tslint:disable-next-line
const { version } = require('../package.json');
container.bind<Sentry>(TYPES.Sentry).to(SentryImpl).inSingletonScope();
const sentry = container.get<Sentry>(TYPES.Sentry);

sentry.setup(`${config.getMode()}_${hostname()}`, 'indexer', version);

/* bind TaskStorage */
container.bind<DatabaseService>(DatabaseService).toSelf().inSingletonScope();
container.bind<TaskQueue>(TYPES_IDX.TaskStorage).to(MongodbTaskStore).inSingletonScope();
container.bind<ThrottleStore>(TYPES_IDX.ThrottleStore).to(MongodbThrottleStore).inSingletonScope();
container.bind<EventLogStore>(TYPES_IDX.EventLogStore).to(MongodbEventLogStore).inSingletonScope();

/* bind message queue */
container.bind<RabbitMQService>(TYPES.RabbitMQService).to(RascalImpl).inSingletonScope();

/* bind TaskOrchestra */
container.bind<interfaces.Factory<number>>(TYPES_IDX.TaskTimingFactory).toFactory<number>(TaskTiming);
container.bind<TaskOrchestra>(TaskOrchestra).toSelf().inTransientScope();

switch (config.getMode()) {
    case DMHY:
        container.bind<ItemStorage<number>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
        container.bind<Scraper>(TYPES_IDX.Scraper).to(DmhyScraper).inSingletonScope();
        break;
    case BANGUMI_MOE:
        container.bind<ItemStorage<string>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
        container.bind<Scraper>(TYPES_IDX.Scraper).to(BangumiMoe).inSingletonScope();
        break;
    case NYAA:
        container.bind<ItemStorage<number>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
        container.bind<Scraper>(TYPES_IDX.Scraper).to(NyaaScraper).inSingletonScope();
        break;
    case ACG_RIP:
        container.bind<ItemStorage<number>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
        container.bind<Scraper>(TYPES_IDX.Scraper).to(AcgRipScraper).inSingletonScope();
        break;
    case MIKANANI_ME:
        container.bind<ItemStorage<string>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
        container.bind<Scraper>(TYPES_IDX.Scraper).to(MikananiMe).inSingletonScope();
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

sentry.capture(`starting ${config.getMode()} scraper, REST service listening ${config.getServerHost()}:${config.getServerPort()}`);

const server = new RESTServer(container, config);
server.start();
