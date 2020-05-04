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
import { DatabaseService } from '../service/database-service';
import { CommonTask, TaskType } from '../task/task-types';
import { FakeConfigManager } from '../test/fake-config';
import { ConfigLoader, TaskStorage, TYPES } from '../types';
import { MongodbTaskStore } from './mongodb-task-store';

@TestFixture('MongodbStore test spec')
export class MongodbItemStoreSpec {
    private _store: MongodbTaskStore;
    private _config: ConfigLoader;
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
        this._container.bind<ConfigLoader>(TYPES.ConfigLoader).to(FakeConfigManager).inSingletonScope();
        this._container.bind<DatabaseService>(DatabaseService).toSelf().inSingletonScope();
        this._container.bind<TaskStorage>(TYPES.TaskStorage).to(MongodbTaskStore).inTransientScope();
        this._config = this._container.get<ConfigLoader>(TYPES.ConfigLoader);
        this._config.load();
        // this._config.dbHost = 'mongo';
        this._config.dbPort = 27017;
    }

    @Setup
    public async databaseInit(): Promise<void> {
        // Cast to PostgresStore<number>
        this._databaseService = await this._container.get<DatabaseService>(DatabaseService);
        await this._databaseService.onStart();
        this._store = this._container.get<TaskStorage>(TYPES.TaskStorage) as MongodbTaskStore;
    }

    @Teardown
    public async databaseCleanUp(): Promise<void> {
        await this._databaseService.onEnd();
    }

    @Test('Task Queue Operation')
    public async taskQueueOperation(): Promise<void> {
        const tasks = [];
        for (let i = 0; i < 10; i++) {
            tasks.push(new CommonTask(TaskType.SUB));
        }

        const promises = [];
        for (let task of tasks) {
            promises.push(this._store.offerTask(task));
        }
        await Promise.all(promises);
        let idx = 0;
        while (await this._store.hasTask()) {
            let task = await this._store.pollTask();
            Expect(task.id).toBe(tasks[idx].id);
            let sleepTime = Math.round(Math.random() * 5000);
            await this.sleep(sleepTime);
            idx++;
        }
        Expect(await this._store.hasTask()).toBe(false);

        const client = await this._createClient();
        await client.db(this._config.dbName).collection(this._taskCollectionName).drop();
    }

    @Test('Failed Task Queue Operation')
    public async failedTaskQueueOperation(): Promise<void> {
        const tasks = [];
        for (let i = 0; i < 10; i++) {
            tasks.push(new CommonTask(TaskType.SUB));
        }

        const promises = [];
        for (let task of tasks) {
            promises.push(this._store.offerFailedTask(task));
        }
        await Promise.all(promises);
        let idx = 0;
        while (await this._store.hasFailedTask()) {
            let task = await this._store.pollFailedTask();
            Expect(task.id).toBe(tasks[idx].id);
            Expect(task.retryCount).toBeGreaterThan(0);
            let sleepTime = Math.round(Math.random() * 5000);
            await this.sleep(sleepTime);
            idx++;
        }
        Expect(await this._store.hasFailedTask()).toBe(false);

        const client = await this._createClient();
        await client.db(this._config.dbName).collection(this._failedTaskCollectionName).drop();
    }

    private async _createClient(): Promise<MongoClient> {
        const url = `mongodb://${this._config.dbUser}:${this._config.dbPass}@${
            this._config.dbHost
            }:${this._config.dbPort}?authSource=${this._config.authSource}`;
        return await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    }

    private sleep(milliseconds: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, milliseconds);
        });
    }
}
