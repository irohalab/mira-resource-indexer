import { Expect, Setup, SetupFixture, Teardown, Test, TestFixture } from 'alsatian';
import { Container, interfaces } from 'inversify';
import { FakeConfigManager } from '../test/fake-config';
import { FakeResource, FakeScraper, MIN_INTERVAL } from '../test/fake-scraper';
import { MockTaskTiming } from '../test/mock-task-timing';
import { ConfigLoader, Scraper, TYPES } from '../types';
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
                ids: [],
                page: i
            } as FakeResource;

            for (let j = 1; j <= 10; j++) {
                res.ids.push(i * 100 + j);
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
