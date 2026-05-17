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
import { unlink } from 'fs/promises';
import { downloadFile } from '../utils/download';
import { getTorrentInfo } from '../utils/torrent-utils';
import { Item } from '../entity/Item';
import { Publisher } from '../entity/publisher';
import { Team } from '../entity/Team';
import { TaskOrchestra } from '../task/task-orchestra';
import { EventLogStore, ItemStorage, TYPES_IDX } from '../TYPES_IDX';
import { toUTCDate } from '../utils/normalize';
import { BaseScraper } from './abstract/base-scraper';
import { logger } from '../utils/logger-factory';
import { Sentry, TYPES } from '@irohalab/mira-shared';
import { ConfigManager } from '../utils/config-manager';
import cheerio = require('cheerio');

@injectable()
export class MikananiMeLight extends BaseScraper<string> {
    private static _host = 'https://mikanani.me';

    constructor(
        @inject(TYPES_IDX.ItemStorage) store: ItemStorage<string>,
        @inject(TYPES_IDX.EventLogStore) eventLogStore: EventLogStore,
        @inject(TaskOrchestra) taskOrchestra: TaskOrchestra,
        @inject(TYPES.Sentry) sentry: Sentry,
        @inject(TYPES.ConfigManager) config: ConfigManager
    ) {
        super(taskOrchestra, config, store, eventLogStore, sentry);
    }

    public async executeMainTask(pageNo?: number): Promise<{ items: Item<string>[], hasNext: boolean }> {
        try {
            let listPageUrl = MikananiMeLight._host + '/Home/Classic';
            if (pageNo) {
                listPageUrl += '/' + pageNo;
            }
            logger.info('execute_main_task', {
                pageNo
            });
            const resp = await Axios.get(listPageUrl);
            const $ = cheerio.load(resp.data);
            const trList = Array.from($('#sk-body > .table tbody > tr'));
            let items: Item<string>[] = [];
            for (const tr of trList) {
                const item = new Item<string>();
                const titleLink = $('td:nth-child(3) > a.magnet-link-wrap', tr);
                const href = titleLink.attr('href');
                item.uri = href ? href.trim() : null;
                item.id = this.getIdFromUri(item.uri);
                items.push(item);
            }
            let newIds = await this._store.filterItemNotStored(items.map(item => item.id));
            let newItems: Item<string>[] = [];
            let newIdx = items.map((item) => {
                return newIds.includes(item.id);
            });

            for (let i = 0; i < trList.length; i++) {
                if (!newIdx[i]) {
                    continue;
                }
                const tr = trList[i];
                const item = new Item<string>();

                // datetime
                const dateTextTd = $('td:first-child', tr);
                let dateText = dateTextTd.length ? dateTextTd.text() : '';
                if (dateText) {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    const todayDateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
                    const yesterdayDateStr = `${yesterday.getFullYear()}/${yesterday.getMonth() + 1}/${yesterday.getDate()}`;
                    dateText = dateText.replace('今天', todayDateStr).replace('昨天', yesterdayDateStr);
                }
                item.timestamp = toUTCDate(dateText, 8);

                // team
                item.team = new Team();
                const teamLink = $('td:nth-child(2) > a.magnet-link-wrap', tr);
                const teamHref = teamLink.attr('href');
                if (teamHref) {
                    const teamMatch = teamHref.trim().match(/\/Home\/PublishGroup\/(\d+)/);
                    if (teamMatch) {
                        item.team.id = teamMatch[1];
                    }
                }
                item.team.name = teamLink.length ? teamLink.text().trim() : null;

                // publisher
                item.publisher = new Publisher();
                item.publisher.id = item.team.id;
                item.publisher.name = item.team.name;

                // title
                const titleLink = $('td:nth-child(3) > a.magnet-link-wrap', tr);
                item.title = titleLink.length ? titleLink.text().trim() : '';

                // magnet
                const magnetLink = $('td:nth-child(3) > a.js-magnet.magnet-link', tr);
                item.magnet_uri = magnetLink.attr('data-clipboard-text')
                    ? magnetLink.attr('data-clipboard-text').trim()
                    : null;

                // torrent
                const torrentLink = $('td:nth-child(5) > a', tr);
                const torrentHref = torrentLink.attr('href');
                if (torrentHref) {
                    const urlObj = new URL(torrentHref.trim(), MikananiMeLight._host);
                    item.torrent_url = urlObj.toString();
                } else {
                    item.torrent_url = null;
                }

                item.id = items[i].id;
                item.uri = items[i].uri;
                newItems.push(item);
            }
            return { hasNext: newIds.length === items.length && newIds.length > 0, items: newItems };
        } catch (e: any) {
            await this.handleTimeout(e as unknown as Error);
            logger.warn('execute_main_task_exception', {
                code: e.code,
                error_message: e.message,
                line: '157',
                page_no: pageNo,
                stack: e.stack
            });
            return null;
        }
    }

    public async executeSubTask(item: Item<string>): Promise<number> {
        try {
            logger.info('start to get torrent info for item#' + item.id);
            const torrentPath = await downloadFile(item.torrent_url);
            const info = await getTorrentInfo(torrentPath);
            item.files = info.files;
            // console.log(info.files);
            await unlink(torrentPath);
        } catch (e: any) {
            let statusCode = -1;
            if (e.response) {
                statusCode = e.response.status;
            }
            if (statusCode === 404) {
                // ignore 404 torrent url.
                return 200;
            }
            await this.handleTimeout(e as unknown as Error);
            logger.warn('execute_sub_task_exception', {
                code: e.code,
                error_message: e.message,
                item,
                line: '236',
                stack: e.stack
            });
            return statusCode;
        }
        return 200;
    }

    private getIdFromUri(uri: string): string {
        const match = uri.match(/\/Home\/Episode\/([a-f0-9]+)/);
        if (match) {
            return match[1];
        }
        return null;
    }
}
