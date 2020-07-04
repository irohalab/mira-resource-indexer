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
import { Container, interfaces } from 'inversify';
import { FakeConfigManager } from '../test/fake-config';
import { FakeResource, FakeScraper, MIN_INTERVAL } from '../test/fake-scraper';
import { InMemoryTaskStore } from '../test/in-memory-task-store';
import { MockTaskTiming } from '../test/mock-task-timing';
import { ConfigLoader, Scraper, TaskStorage, TYPES } from '../types';
import { TaskOrchestra } from './task-orchestra';

@TestFixture('TaskOrchestra test spec')
export class TaskOrchestraSpec {
    private _container: Container;
    private _config: ConfigLoader;
    private _scraper: FakeScraper;

    @SetupFixture
    public setupFixture() {
        this._container = new Container();
        this._container.bind<ConfigLoader>(TYPES.ConfigLoader).to(FakeConfigManager).inSingletonScope();
        this._container.bind<interfaces.Factory<number>>(TYPES.TaskTimingFactory).toFactory<number>(MockTaskTiming);
        this._container.bind<TaskStorage>(TYPES.TaskStorage).to(InMemoryTaskStore).inSingletonScope();
        this._container.bind<TaskOrchestra>(TaskOrchestra).toSelf();
        this._container.bind<Scraper>(TYPES.Scraper).to(FakeScraper).inTransientScope();
        this._config = this._container.get<ConfigLoader>(TYPES.ConfigLoader);
        this._config.load();
        this._config.minCheckInterval = MIN_INTERVAL * 3;
        this._config.minInterval = MIN_INTERVAL;
    }

    @Setup
    public async initTest() {
        this._scraper = this._container.get<FakeScraper>(TYPES.Scraper);

        let fakeResources: FakeResource[] = [];
        for (let i = 1; i <= 5; i++) {
            let res = {
                page: i,
                subResources: []
            } as FakeResource;

            for (let j = 1; j <= 10; j++) {
                res.subResources.push({
                    id: i * 100 + j,
                    retryCount: Math.round(Math.random() * 5),
                    willSuccess: !!Math.round(Math.random() * 1)
                });
            }
            fakeResources.push(res);
        }
        this._scraper.resources = fakeResources;
        await this._scraper.start();
    }

    @Teardown
    public async cleanUp() {
        await this._scraper.end();
    }

    @Test('Should schedule task and respect the timing setting')
    public async schedule(): Promise<void> {
        let n = 100 * 2;
        return new Promise((resolve) => {
            setTimeout(() => {
                let resolvedIds = this._scraper.resolvedIds;
                let lastTimestamp;
                let lastId;
                for (let {id, timestamp} of resolvedIds) {
                    if (lastTimestamp && lastId) {
                        Expect(id).toBeGreaterThan(lastId);
                        Expect(timestamp - lastTimestamp).not.toBeLessThan(MIN_INTERVAL - 1);
                    }
                    lastTimestamp = timestamp;
                    lastId = id;
                }
                resolve();
            }, n);
        });
    }
}
