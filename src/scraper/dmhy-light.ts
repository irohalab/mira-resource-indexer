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
import { inject, injectable } from 'inversify';
import { resolve } from 'url';
import { unlink } from 'fs/promises';
import { downloadFile } from '../utils/download';
import { getTorrentInfo } from '../utils/torrent-utils';
import { Item } from '../entity/Item';
import { ItemType } from '../entity/item-type';
import { Publisher } from '../entity/publisher';
import { Team } from '../entity/Team';
import { TaskOrchestra } from '../task/task-orchestra';
import { EventLogStore, ItemStorage, TYPES_IDX } from '../TYPES_IDX';
import { toUTCDate, trimDomain } from '../utils/normalize';
import { BaseScraper } from './abstract/base-scraper';
import { logger } from '../utils/logger-factory';
import { Sentry, TYPES } from '@irohalab/mira-shared';
import { ConfigManager } from '../utils/config-manager';
import cheerio = require('cheerio');

@injectable()
export class DmhyLightScraper extends BaseScraper<number> {
    private static _host = 'https://share.dmhy.org';

    constructor(
        @inject(TYPES_IDX.ItemStorage) store: ItemStorage<number>,
        @inject(TaskOrchestra) taskOrchestra: TaskOrchestra,
        @inject(TYPES_IDX.EventLogStore) eventLogStore: EventLogStore,
        @inject(TYPES.Sentry) sentry: Sentry,
        @inject(TYPES.ConfigManager) config: ConfigManager
    ) {
        super(taskOrchestra, config, store, eventLogStore, sentry);
    }

    public async executeMainTask(pageNo?: number): Promise<{ items: Item<number>[], hasNext: boolean }> {
        try {
            let listPageUrl = DmhyLightScraper._host;
            if (pageNo) {
                listPageUrl += '/topics/list/page/' + pageNo;
            }
            logger.info('execute_main_task', {
                pageNo
            });
            const resp = await Axios.get(listPageUrl);
            const $ = cheerio.load(resp.data);
            const trList = Array.from($('#topic_list tbody > tr'));
            let items: Item<number>[] = [];
            for (const tr of trList) {
                let item = new Item<number>();
                const titleLink = $('td.title > a', tr);
                const href = titleLink.attr('href');
                item.uri = trimDomain(href ? href.trim() : null);
                item.id = this.getIdFromUri(item.uri);

                // type
                item.type = new ItemType<number>();
                const typeLink = $('td:nth-child(2) > a', tr);
                item.type.id = this.getIdFromUri(
                    typeLink.attr('href'),
                    /\/topics\/list\/sort_id\/(\d+)/
                );
                item.type.name = $('font', typeLink).text().trim();

                items.push(item);
            }
            let newIds = await this._store.filterItemNotStored(items.map(item => item.id));
            let newItems = items.filter(item => {
                return newIds.includes(item.id);
            });
            return { hasNext: newIds.length === items.length && newIds.length > 0, items: newItems };
        } catch (e: any) {
            await this.handleTimeout(e as unknown as Error);
            logger.warn('execute_main_task_exception', {
                code: e.code,
                error_message: e.message,
                line: '95',
                page_no: pageNo,
                stack: e.stack
            });
            return null;
        }
    }

    public async executeSubTask(item: Item<number>): Promise<number> {
        let statusCode = -1;
        try {
            const subTaskUrl = DmhyLightScraper._host + item.uri;
            logger.info('execute_sub_task', {
                item
            });
            const resp = await Axios.get(subTaskUrl);
            statusCode = resp.status;
            const $ = cheerio.load(resp.data);
            const mainArea = $('.main .topics_bk');
            if (mainArea.length === 0) {
                return 404;
            }

            item.title = mainArea.find('.topic-main > .topic-title > h3').text().trim();

            const publisherElement = mainArea.find('.user-sidebar > .avatar.box:nth-child(1) > p:nth-child(2) > a');
            item.publisher = new Publisher<number>();
            item.publisher.id = this.getIdFromUri(
                publisherElement.attr('href'),
                /\/topics\/list\/user_id\/(\d+)/
            );
            item.publisher.name = publisherElement.text().trim();

            const teamElement = mainArea.find('.user-sidebar > .avatar.box:nth-child(2) > p:nth-child(2) > a');
            if (teamElement.length > 0) {
                item.team = new Team<number>();
                item.team.id = this.getIdFromUri(
                    teamElement.attr('href'),
                    /\/topics\/list\/team_id\/(\d+)/
                );
                item.team.name = teamElement.text().trim();
            }

            const resourceInfoElement = mainArea.find('.info.resource-info.right > ul');
            const timeStr = resourceInfoElement.find('li:nth-child(2) > span').text().trim();
            item.timestamp = toUTCDate(timeStr || new Date().toISOString(), 8);

            const btResourceElement = mainArea.find('#tabs-1');
            item.torrent_url = resolve(
                'https://',
                btResourceElement.find('p:nth-child(1) > a').attr('href')
            );
            item.magnet_uri = btResourceElement.find('#a_magnet').attr('href');

            const torrentPath = await downloadFile(item.torrent_url);
            const info = await getTorrentInfo(torrentPath);
            item.files = info.files;
            await unlink(torrentPath);
        } catch (e: any) {
            await this.handleTimeout(e as unknown as Error);
            if (e.response) {
                statusCode = e.response.status;
            } else {
                statusCode = -1;
            }
            logger.warn('execute_sub_task_exception', {
                code: e.code,
                error_message: e.message,
                item,
                line: '163',
                stack: e.stack
            });
        }
        return statusCode;
    }

    private getIdFromUri(uri: string, regex: RegExp = /\/topics\/view\/(\d+)_.+/): number {
        const match = uri.match(regex);
        if (match) {
            return parseInt(match[1], 10);
        }
        return 0;
    }
}
