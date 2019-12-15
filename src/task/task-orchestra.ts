import { inject, injectable } from 'inversify';
import { ConfigLoader, Scraper, TYPES } from '../types';
import { CommonTask, Task, TaskType } from './task-types';
import Timeout = NodeJS.Timeout;

@injectable()
export class TaskOrchestra {
    private _taskQueue: Task[];
    private _timerId: Timeout;
    private _lastMainTaskExeTime  = 0;
    private _scraper: Scraper;

    constructor(@inject(TYPES.ConfigLoader) private _config: ConfigLoader) {
        this._taskQueue = [];
    }

    public start(scraper: Scraper) {
        this._scraper = scraper;
        this.pick();
    }

    public queue(task: Task) {
        this._taskQueue.push(task);
    }

    public stop() {
        clearTimeout(this._timerId);
        this.cleanTaskQueue();
    }

    private pick(): void {
        let actualInterval = Math.floor((this._config.minInterval + Math.random() * 10.0) * 1000);
        if (this._taskQueue.length === 0) {
            // no task in the queue. schedule a new task.
            this.queue(new CommonTask(TaskType.MAIN));
            let offset = Date.now() - this._lastMainTaskExeTime;
            this._timerId = setTimeout(() => {
                this.pick();
            }, Math.max(this._config.minCheckInterval * 1000 - offset, actualInterval));
        } else {
            // execute task from head of the queue
            let task = this._taskQueue.shift();
            this._scraper.executeTask(task)
                .then(() => {
                    if (task.type === TaskType.MAIN) {
                        this._lastMainTaskExeTime = Date.now();
                    }
                    this._timerId = setTimeout(() => {
                        this.pick();
                    }, actualInterval);
                });
        }
    }

    private cleanTaskQueue() {
        this._taskQueue.length = 0;
    }
}
