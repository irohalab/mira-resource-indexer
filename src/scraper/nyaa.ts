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

import Axios from 'axios';
import cheerio = require('cheerio');
import { inject, injectable } from 'inversify';
import { basename, extname } from 'path';
import { Item } from '../entity/Item';
import { ItemType } from '../entity/item-type';
import { MediaFile } from '../entity/media-file';
import { Publisher } from '../entity/publisher';
import { NyaaTask } from '../task/nyaa-task';
import { TaskOrchestra } from '../task/task-orchestra';
import { Task, TaskType } from '../task/task-types';
import { ConfigLoader, PersistentStorage, Scraper, TYPES } from '../types';
import { captureException, captureMessage } from '../utils/sentry';

const MAX_TASK_RETRIED_TIMES = 10;

@injectable()
export class NyaaScraper implements Scraper {
    private static _host = 'https://nyaa.si';
    private _taskRetriedTimes: Map<number, number>;

    constructor(
        @inject(TYPES.PersistentStorage)
        private _store: PersistentStorage<number>,
        @inject(TaskOrchestra) private _taskOrchestra: TaskOrchestra,
        @inject(TYPES.ConfigLoader) private _config: ConfigLoader
    ) {
        this._taskRetriedTimes = new Map<number, number>();
    }

    public async start(): Promise<any> {
        this._taskOrchestra.queue(new NyaaTask(TaskType.MAIN));
        this._taskOrchestra.start(this);
    }

    public async executeTask(task: Task): Promise<any> {
        if (task.type === TaskType.MAIN) {
            let result;
            if (task instanceof NyaaTask) {
                result = await this.scrapListPage((task as NyaaTask).pageNo);
            } else {
                result = await this.scrapListPage();
            }
            if (!result) {
                this.retryTask(task);
                return;
            } else if (this._taskRetriedTimes.has(task.id)) {
                this._taskRetriedTimes.delete(task.id);
            }
            for (let item of result.items) {
                this._taskOrchestra.queue(new NyaaTask(TaskType.SUB, item));
            }
            if (
                result.hasNext &&
                (task as NyaaTask).pageNo < this._config.maxPageNo
            ) {
                let newTask = new NyaaTask(TaskType.MAIN);
                let previousPageNo = (task as NyaaTask).pageNo;
                if (previousPageNo) {
                    newTask.pageNo = previousPageNo + 1;
                } else {
                    newTask.pageNo = 2;
                }
                this._taskOrchestra.queue(newTask);
            }
        } else {
            let item = await this.scrapDetailPage((task as NyaaTask).item);
            if (!item) {
                this.retryTask(task);
                return;
            } else if (this._taskRetriedTimes.has(task.id)) {
                this._taskRetriedTimes.delete(task.id);
            }
            return await this._store.putItem(item);
        }
    }

    public async scrapListPage(pageNo?: number): Promise<{ items: Array<Item<number>>, hasNext: boolean }> {
        try {
            let listPageUrl = NyaaScraper._host;
            if (pageNo) {
                listPageUrl += '/?p=' + pageNo;
            }
            const resp = await Axios.get(listPageUrl);
            console.log(`Scrapping ${listPageUrl}`);
            const $ = cheerio.load(resp.data);
            const trList = Array.from($('table > tbody > tr'));
            let items: Array<Item<number>> = [];
            trList.forEach(tr => {
                let item = new Item<number>();

                // type
                item.type = new ItemType<number>();
                let uri = $('a', tr).eq(0).attr('href').trim();
                item.type.id = this.getTypeIdFromUri(uri);
                item.type.name = $('a', tr).eq(0).attr('title').trim();

                item.uri = $('td:nth-child(2) > a', tr).last().attr('href').trim();
                item.id = this.getIdFromUri(item.uri);

                items.push(item);
            });
            let newIds = await this._store.filterItemNotStored(items.map(item => item.id));
            let newItems = items.filter(item => {
                return newIds.includes(item.id);
            });
            return { hasNext: newIds.length === items.length && newIds.length > 0, items: newItems };

        } catch (e) {
            captureException(e);
            console.error(e.stack);
            return null;
        }
    }

    public async scrapDetailPage(item: Item<number>): Promise<Item<number>> {
        try {
            const resp = await Axios.get(`${NyaaScraper._host}${item.uri}`);
            console.log(`Scrapping ${NyaaScraper._host}${item.uri}`);
            const $ = cheerio.load(resp.data);
            const panels = $('.container > .panel');
            item.title = panels.eq(0).find('.panel-title').text().trim();
            item.publisher = new Publisher<number>();
            item.publisher.name = panels.eq(0).find('.panel-body > .row:nth-child(2) > div:nth-child(2) > a').text();
            item.timestamp = new Date(
                Number(
                    panels
                        .eq(0)
                        .find(
                            '.panel-body > .row:nth-child(1) > div:nth-child(4)'
                        )
                        .attr('data-timestamp')
                ) * 1000
            );
            item.magnet_uri = panels.eq(0).find('.panel-footer > a:nth-child(2)').attr('href');
            item.torrent_url = NyaaScraper._host + panels.eq(0).find('.panel-footer > a:nth-child(1)').attr('href');
            item.files = [];
            let list = panels.eq(2).find('.torrent-file-list > ul > li > .folder');
            if (list.length === 1) {
                let files = Array.from(panels.eq(2).find('.torrent-file-list > ul > li > ul > li'));
                files.forEach(file => {
                let mediaFile = new MediaFile();
                mediaFile.size = $('.file-size', file).text().slice(1, -1);
                $('.file-size', file).remove();
                mediaFile.path = $(file).text().trim();
                mediaFile.ext = extname(mediaFile.path);
                mediaFile.name = basename(mediaFile.path, mediaFile.ext);
                item.files.push(mediaFile);
                });
            } else {
                let mediaFile = new MediaFile();
                let file = panels.eq(2).find('.torrent-file-list > ul > li');
                mediaFile.size = file.find('.file-size').text().slice(1, -1);
                file.find('.file-size').remove();
                mediaFile.path = file.text().trim();
                mediaFile.ext = extname(mediaFile.path);
                mediaFile.name = basename(mediaFile.path, mediaFile.ext);
                item.files.push(mediaFile);
            }
            return item;
        } catch (e) {
            captureException(e);
            console.error(e.stack);
            return null;
        }
    }

    public async end(): Promise<any> {
        return Promise.resolve();
    }

    private getIdFromUri(uri: string, regex: RegExp = /\/view\/(\d+)/): number {
        const match = uri.match(regex);
        if (match) {
            return parseInt(match[1], 10);
        }
        return 0;
    }

    private getTypeIdFromUri(uri: string, regex: RegExp = /\/?c=(\d+)_(\d+)/): number {
        const match = uri.match(regex);
        if (match) {
            let type = parseInt(match[1], 10) * 100 + parseInt(match[2], 10);
            return type;
        }
        return 0;
    }

    private checkMaxRetriedTime(task: Task): boolean {
        if (this._taskRetriedTimes.has(task.id)) {
            if (this._taskRetriedTimes.get(task.id) > MAX_TASK_RETRIED_TIMES) {
                return true;
            }
            this._taskRetriedTimes.set(task.id, this._taskRetriedTimes.get(task.id) + 1);
        } else {
            this._taskRetriedTimes.set(task.id, 1);
        }
        return false;
    }

    private retryTask(task: Task): void {
        // retry this task
        if (this.checkMaxRetriedTime(task)) {
            if (task instanceof NyaaTask) {
                if (task.type === TaskType.MAIN) {
                    captureMessage(`NyaaScaper, maximum retries reached, Main Task (${(task as NyaaTask).pageNo})`);
                } else {
                    captureMessage(`NyaaScaper, maximum retries reached, Sub Task (${JSON.stringify((task as NyaaTask).item)})`);
                }
            } else {
                captureMessage('NyaaScraper, maximum retries reached, Common Task');
            }
            return;
        }
        this._taskOrchestra.queue(task);
    }
}
