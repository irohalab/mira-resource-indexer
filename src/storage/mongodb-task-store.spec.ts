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

import { Expect, Setup, SetupFixture, Teardown, Test, TestFixture } from 'alsatian';
import { fail } from 'assert';
import { Container } from 'inversify';
import { MongoClient } from 'mongodb';
import { Item } from '../entity/Item';
import { DatabaseService } from '../service/database-service';
import { SubTask } from '../task/sub-task';
import { TaskType } from '../task/task-types';
import { FakeConfigManager } from '../test/fake-config';
import { TaskQueue, TYPES_IDX } from '../TYPES_IDX';
import { MongodbTaskStore } from './mongodb-task-store';
import { ConfigManager } from '../utils/config-manager';
import { TYPES } from '@irohalab/mira-shared';

// noinspection DuplicatedCode
@TestFixture('MongodbStore test spec')
export class MongodbItemStoreSpec {
    private _store: MongodbTaskStore;
    private _config: ConfigManager;
    private _container: Container;
    private _databaseService: DatabaseService;

    private _taskCollectionName = 'task';
    private _failedTaskCollectionName = 'failed_task';

    @SetupFixture
    public setupFixture() {
        if (!process.env.DB_NAME) {
            fail('You must set the Environment Variable DB_NAME to avoid potential damage to default database');
        }
        this._container = new Container();
        this._container.bind<ConfigManager>(TYPES.ConfigManager).to(FakeConfigManager).inSingletonScope();
        this._container.bind<DatabaseService>(DatabaseService).toSelf().inSingletonScope();
        this._container.bind<TaskQueue>(TYPES_IDX.TaskStorage).to(MongodbTaskStore).inTransientScope();
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
        this._store = this._container.get<TaskQueue>(TYPES_IDX.TaskStorage) as MongodbTaskStore;
    }

    @Teardown
    public async databaseCleanUp(): Promise<void> {
        const client = await this._createClient();
        const cur = client.db(this._config.getDbName()).listCollections({}, {nameOnly: true});
        const existCollections = await cur.toArray();
        if (existCollections) {
            for (let collectionName of existCollections) {
                await client.db(this._config.getDbName()).collection(collectionName.name).drop();
            }
        }
        await this._databaseService.onEnd();
    }

    @Test('Task Queue Operation')
    public async taskQueueOperation(): Promise<void> {
        const tasks = [];
        for (let i = 0; i < 10; i++) {
            let item = new Item<number>();
            item.id = i;
            item.uri = `/item/${i}`;
            tasks.push(new SubTask(TaskType.SUB, item));
        }

        /* make a duplicate task */
        let dupItem = new Item();
        dupItem.id = 0;
        dupItem.uri = `/item/0`;
        tasks.push(new SubTask(TaskType.SUB, dupItem));
        /* --- */

        for (let task of tasks) {
            await this._store.offerTask(task);
        }

        let idx = 1;
        let dupCount = 0;
        while (await this._store.hasTask()) {
            let task = await this._store.pollTask();
            if ((task as SubTask<number>).item.uri === '/item/0') {
                Expect(task.id).toBe(tasks[tasks.length - 1].id);
                Expect(dupCount).toBe(0);
                dupCount++;
            } else {
                Expect(task.id).toBe(tasks[idx].id);
            }
            let sleepTime = Math.round(Math.random() * 20);
            await this.sleep(sleepTime);
            idx++;
        }
        Expect(await this._store.hasTask()).toBe(false);
    }

    @Test('Failed Task Queue Operation')
    public async failedTaskQueueOperation(): Promise<void> {
        const tasks = [];
        for (let i = 0; i < 10; i++) {
            let item = new Item<number>();
            item.id = i;
            item.uri = `/item/${i}`;
            tasks.push(new SubTask(TaskType.SUB, item));
        }

        /* make a duplicate task */
        let dupItem = new Item();
        dupItem.id = 0;
        dupItem.uri = `/item/0`;
        tasks.push(new SubTask(TaskType.SUB, dupItem));
        /* --- */

        for (let task of tasks) {
            await this._store.offerFailedTask(task);
        }

        let idx = 1;
        let dupCount = 0;
        while (await this._store.hasFailedTask()) {
            let task = await this._store.pollFailedTask();
            if ((task as SubTask<number>).item.uri === '/item/0') {
                Expect(task.id).toBe(tasks[tasks.length - 1].id);
                Expect(dupCount).toBe(0);
                dupCount++;
            } else {
                Expect(task.id).toBe(tasks[idx].id);
            }
            Expect(task.retryCount).toBeGreaterThan(0);
            let sleepTime = Math.round(Math.random() * 20);
            await this.sleep(sleepTime);
            idx++;
        }
        Expect(await this._store.hasFailedTask()).toBe(false);

    }

    @Test('Test retry count')
    public async retryCont() {
        let retryCount = 0;
        let item = new Item();
        item.id = 0;
        item.uri = '/item/0';
        let failedTask = new SubTask(TaskType.SUB, item);
        for (let i = 0; i < 10; i++) {
            await this._store.offerFailedTask(failedTask);
            Expect(await this._store.hasFailedTask()).toBe(true);
            failedTask = await this._store.pollFailedTask();
            retryCount++;
            Expect(failedTask).not.toBeNull();
            Expect(failedTask.retryCount).toEqual(retryCount);
        }
    }

    private async _createClient(): Promise<MongoClient> {
        const url = `mongodb://${this._config.getDbUser()}:${this._config.getDbPass()}@${
            this._config.getDbHost()
            }:${this._config.getDbPort()}?authSource=${this._config.getAuthSource()}`;
        return await MongoClient.connect(url);
    }

    private sleep(milliseconds: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, milliseconds);
        });
    }
}
