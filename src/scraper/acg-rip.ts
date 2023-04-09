/*
 * Copyright 2023 IROHA LAB
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
import { promises } from 'fs';
import { inject, injectable } from 'inversify';
import { Item } from '../entity/Item';
import { Team } from '../entity/Team';
import { ItemType } from '../entity/item-type';
import { Publisher } from '../entity/publisher';
import { TaskOrchestra } from '../task/task-orchestra';
import { ConfigLoader, ItemStorage, TYPES } from '../types';
import { downloadFile } from '../utils/download';
import { logger } from '../utils/logger-factory';
import { captureException } from '../utils/sentry';
import { getTorrentInfo } from '../utils/torrent-utils';
import { BaseScraper } from './abstract/base-scraper';
import cheerio = require('cheerio');

const { unlink }  = promises;

@injectable()
export class AcgRipScraper extends BaseScraper<number> {
    private static _host = 'https://acg.rip';
        
    constructor(
        @inject(TYPES.ItemStorage) store: ItemStorage<number>,
        @inject(TaskOrchestra) taskOrchestra: TaskOrchestra,
        @inject(TYPES.ConfigLoader) config: ConfigLoader
    ) {
        super(taskOrchestra, config, store);
    }

    public async executeMainTask(pageNo?: number): Promise<{ items: Array<Item<number>>; hasNext: boolean; }> {
        try {
            let listPageUrl = AcgRipScraper._host;
            if (pageNo) {
                listPageUrl += `/page/${pageNo}`;
            }
            logger.info('execute_main_task', { pageNo });
            const resp = await Axios.get(listPageUrl);

            const $ = cheerio.load(resp.data);
            const trList = Array.from($('table.post-index > tbody > tr'));
            let items: Array<Item<number>> = [];
            trList.forEach(tr => {
                const item = new Item<number>();

                // type
                item.type = new ItemType<number>();
                item.type.id = 1;  // hard coded type 1 as anime
                item.type.name = '动画';

                item.uri = $('td.title a', tr).last().attr('href').trim();
                item.id = this.getIdFromUri(item.uri);

                items.push(item);
            });
            let newIds = await this._store.filterItemNotStored(items.map(item => item.id));
            let newItems = items.filter(item => {
                return newIds.includes(item.id);
            });
            return { hasNext: newIds.length === items.length && newIds.length > 1, items: newItems };
        } catch (e) {
            if (e.code !== 'ETIMEDOUT') {
                captureException(e);
            }
            logger.warn('execute_main_task_exception', {
                code: e.code,
                error_message: e.message,
                line: '80',
                page_no: pageNo,
                stack: e.stack
            });
            return null;
        }
    }
    public async executeSubTask(item: Item<number>): Promise<number> {
        let statusCode = -1;
        try {
            const subTaskUrl = `${AcgRipScraper._host}${item.uri}`;
            logger.info('execute_sub_task', { item });
            const resp = await Axios.get(subTaskUrl);
            statusCode = resp.status;

            const $ = cheerio.load(resp.data);
            const panels = $('.container .panel.post-show-content');
            const sidePanel = $('.container .side-panel');
            item.title = panels.eq(0).find('.panel-heading').text().trim();
            item.publisher = new Publisher<number>();
            const pub = sidePanel.eq(0).find('.panel-body dd > a[href]');
            const pubId = pub.attr('href');
            item.publisher.name = pub.text().trim();
            item.publisher.id = this.getPublisherIdFromUri(pubId);
            item.timestamp = new Date(Number(sidePanel.eq(0).find('time').attr('datetime')) * 1000);
            item.torrent_url = AcgRipScraper._host + panels.eq(0).find('.panel-body a.btn').attr('href');
 
            const torrentPath = await downloadFile(item.torrent_url);
            const info = await getTorrentInfo(torrentPath, true);
            item.magnet_uri = info.magnet_uri;
            item.files = info.files;
            await unlink(torrentPath);

            const team$ = sidePanel.eq(0).find('.panel-title-right a').last();
            if (team$.text()) {
                const team = new Team<number>();
                const teamUri = team$.attr('href');
                team.id = this.getTeamIdFromUri(teamUri);
                team.name = team$.text();
                item.team = team;
            }
        } catch (e) {
            if (e.response) {
                statusCode = e.response.status;
            } else {
                statusCode = -1;
            }
            logger.warn('execute_sub_task_exception', {
                code: e.code,
                error_message: e.message,
                item,
                line: '149',
                stack: e.stack
            });
            if (statusCode !== 404 && e.code !== 'ETIMEDOUT') {
                captureException(e);
            }
        }
        return statusCode;
    }
    
    private getIdFromUri(uri: string, regex: RegExp = /\/t\/(\d+)/): number {
        const match = uri.match(regex);
        if (match) {
            return parseInt(match[1], 10);
        }
        return 0;
    }

    private getPublisherIdFromUri(uri: string, regex: RegExp = /\/user\/(\d+)/): number {
        const match = uri.match(regex);
        if (match) {
            return parseInt(match[1], 10);
        }
        return 0;
    }

    private getTeamIdFromUri(uri: string, regex: RegExp = /\/team\/(\d+)/): number {
        const match = uri.match(regex);
        return match ? parseInt(match[1], 10) : 0;
    }
}
