import { Expect, Setup, SetupFixture, Teardown, Test, TestFixture } from 'alsatian';
import { Container, inject, injectable, interfaces } from 'inversify';
import { FakeConfigManager } from '../test/fake-config';
import { MockTaskTiming } from '../test/mock-task-timing';
import { ConfigLoader, Scraper, TYPES } from '../types';
import { TaskOrchestra } from './task-orchestra';
import { CommonTask, Task, TaskType } from './task-types';

const MIN_INTERVAL = 10;

class FakeTask extends CommonTask {
    public pageNo: number = 1;
    constructor(public type: TaskType,
                public payload?: any) {
        super(type);
    }
}

interface FakeResource {
    page: number;
    ids: number[];
}

@injectable()
class FakeScraper implements Scraper {

    public resources: FakeResource[];
    public resolvedIds: Array<{id: number, timestamp: number}>;

    constructor(@inject(TaskOrchestra) private _taskOrchestra: TaskOrchestra) {
        this.resolvedIds = [];
    }

    public end(): Promise<any> {
        this._taskOrchestra.stop();
        return Promise.resolve(null);
    }

    public executeTask(task: Task): Promise<any> {
        if (task.type === TaskType.SUB) {
            return this.doExecuteSubTask((task as FakeTask).payload);
        } else {
            if (task instanceof FakeTask) {
                return this.doExecuteMainTask(task.pageNo);
            } else {
                return this.doExecuteMainTask(1);
            }
        }
    }

    public start(): Promise<any> {
        this._taskOrchestra.queue(new FakeTask(TaskType.MAIN));
        this._taskOrchestra.start(this);
        return Promise.resolve(null);
    }

    private async doExecuteSubTask(payload: any): Promise<any> {
        this.resolvedIds.push({id: payload as number, timestamp: Date.now()});
    }

    private async doExecuteMainTask(page: number): Promise<any> {
        let ids = this.resources[page - 1].ids;
        for (let id of ids) {
            this._taskOrchestra.queue(new FakeTask(TaskType.SUB, id));
        }
        if (this.resources.length > page - 1) {
            let newMainTask = new FakeTask(TaskType.MAIN);
            newMainTask.pageNo = page + 1;
            this._taskOrchestra.queue(newMainTask);
        }
    }
}

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
                        Expect(timestamp - lastTimestamp).not.toBeLessThan(MIN_INTERVAL);
                    }
                    lastTimestamp = timestamp;
                    lastId = id;
                }
                resolve();
            }, n);
        });
    }
}
