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

import { Browser, launch, Page } from 'puppeteer';
import { inject } from 'inversify';
import { TaskOrchestra } from '../task/task-orchestra';
import { Item } from '../entity/Item';
import { logger } from '../utils/logger-factory';
import { toUTCDate} from '../utils/normalize';
import { Publisher } from '../entity/publisher';
import { Team } from '../entity/Team';
import { downloadFile } from '../utils/download';
import { getTorrentInfo } from '../utils/torrent-utils';
import { BaseScraper } from './abstract/base-scraper';
import { promises } from 'fs';
import { EventLogStore, ItemStorage, TYPES_IDX } from '../TYPES_IDX';
import { ConfigManager } from '../utils/config-manager';
import { Sentry, TYPES } from '@irohalab/mira-shared';

const { unlink } = promises;

const PROXY = process.env.HTTP_PROXY; // a http proxy for this
const IS_DEBUG = process.env.NODE_ENV === 'debug';
const BLOCKED_RESOURCE_TYPES = [
    'image',
    'media',
    'font',
    'texttrack',
    'object',
    'beacon',
    'csp_report',
    'imageset'
];
const SKIPPED_RESOURCES = [
    'quantserve',
    'adzerk',
    'doubleclick',
    'adition',
    'exelator',
    'sharethrough',
    'cdn.api.twitter',
    'google-analytics',
    'googletagmanager',
    'google',
    'fontawesome',
    'facebook',
    'analytics',
    'optimizely',
    'clicktale',
    'mixpanel',
    'zedo',
    'clicksor',
    'tiqcdn',
    'js.kiwihk.net',
    'hm.baidu.com',
    'st.beibi.com',
    'histats.com',
    'e.dtscout.com'
];

export class MikananiMe extends BaseScraper<string> {
    private static _host = 'https://mikanani.me';
    private _browser: Browser;

    constructor(@inject(TYPES_IDX.ItemStorage) store: ItemStorage<string>,
                @inject(TYPES_IDX.EventLogStore) eventLogStore: EventLogStore,
                @inject(TaskOrchestra) taskOrchestra: TaskOrchestra,
                @inject(TYPES.Sentry) sentry: Sentry,
                @inject(TYPES.ConfigManager) config: ConfigManager) {
        super(taskOrchestra, config, store, eventLogStore, sentry);
    }

    public async start(): Promise<any> {
        let launchArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080'
        ];
        if (PROXY) {
            launchArgs.push('--proxy-server=' + PROXY);
        }
        this._browser = await launch({
            args: launchArgs,
            headless: !IS_DEBUG
        });

        return super.start();
    }

    public async end(): Promise<any> {
        await super.end();
        if (this._browser) {
            await this._browser.close();
        }
    }

    public async executeMainTask(pageNo?: number): Promise<{items: Item<string>[], hasNext: boolean}> {
        const page = await this._browser.newPage();
        // page.setUserAgent('Mozilla/5.5 (X11; Linux x86_64) ' +
        //     'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36');
        try {
            await page.setRequestInterception(true);
            this.blockResources(page);
            let listPageUrl = MikananiMe._host + '/Home/Classic';
            if (pageNo) {
                listPageUrl += '/' + pageNo;
            }
            logger.info('execute_main_task', {
                pageNo
            });
            await page.goto(listPageUrl, {
                waitUntil: 'domcontentloaded'
            });
            let tableElement = await page.$('#sk-body > .table');
            let trList = await tableElement.$$('tbody>tr');
            let items = [];
            for (const tr of trList) {
                const item = new Item<string>();

                item.uri = await page.evaluate(el => {
                    let titleLink = el.querySelector('td:nth-child(3)>a.magnet-link-wrap');
                    if (titleLink && titleLink.getAttribute('href')) {
                        return titleLink.getAttribute('href').trim();
                    }
                    return null;
                }, tr);
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
                item.timestamp = toUTCDate(await page.evaluate(el => {
                    let dateTextTd = el.querySelector('td:first-child');
                    let dateText = '';
                    if (dateTextTd) {
                        dateText = dateTextTd.textContent;
                    }
                    if (dateText) {
                        const today = new Date();
                        const yesterday = new Date(today);
                        yesterday.setDate(today.getDate() - 1);
                        const todayDateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
                        const yesterdayDateStr = `${yesterday.getFullYear()}/${yesterday.getMonth() + 1}/${yesterday.getDate()}`;
                        dateText = dateText.replace('今天', todayDateStr).replace('昨天', yesterdayDateStr);
                    }
                    return dateText;
                }, tr), 8);

                item.team = new Team();
                item.team.id = await page.evaluate((el) => {
                    const teamLink = el.querySelector('td:nth-child(2) > a.magnet-link-wrap');
                    if (teamLink && teamLink.getAttribute('href')) {
                        const teamLinkUri = teamLink.getAttribute('href').trim();
                        const match = teamLinkUri.match(/\/Home\/PublishGroup\/(\d+)/);
                        if (match) {
                            return match[1];
                        }
                    }
                    return null;
                }, tr);

                item.team.name = await page.evaluate(el => {
                    const teamLink = el.querySelector('td:nth-child(2) > a.magnet-link-wrap');
                    if (teamLink) {
                        return teamLink.textContent.trim();
                    }
                    return null;
                }, tr);

                item.publisher = new Publisher();
                item.publisher.id = item.team.id;
                item.publisher.name = item.team.name;

                item.magnet_uri = await page.evaluate(el => {
                    let magnetLink = el.querySelector('td:nth-child(3) > a.js-magnet.magnet-link');
                    if (magnetLink && magnetLink.getAttribute('data-clipboard-text')) {
                        return magnetLink.getAttribute('data-clipboard-text').trim();
                    }
                    return null;
                }, tr);

                item.torrent_url = await page.evaluate(el => {
                    let torrentLink = el.querySelector('td:nth-child(5) > a');
                    if (torrentLink && torrentLink.getAttribute('href')) {
                        return torrentLink.getAttribute('href').trim();
                    }
                    return null;
                }, tr);
                if (item.torrent_url) {
                    const urlObj = new URL(item.torrent_url, MikananiMe._host);
                    item.torrent_url = urlObj.toString();
                }

                item.id = items[i].id;
                item.uri = items[i].uri;
                newItems.push(item);
            }
            return {hasNext: newIds.length === items.length && newIds.length > 0, items: newItems};
        } catch (e) {
            await this.handleTimeout(e);
            logger.warn('execute_main_task_exception', {
                code: e.code,
                error_message: e.message,
                line: '157',
                page_no: pageNo,
                stack: e.stack
            });
            return null;
        } finally {
            await page.close();
        }
    }

    public async executeSubTask(item: Item<string>): Promise<number> {
        try {
            logger.info('start to get torrent info for item#' + item.id);
            const torrentPath = await downloadFile(item.torrent_url);
            const info = await getTorrentInfo(torrentPath);
            item.files = info.files;
            console.log(info.files);
            await unlink(torrentPath);
        } catch (e) {
            let statusCode = -1;
            if (e.response) {
                statusCode = e.response.status;
            }
            if (statusCode === 404) {
                // ignore 404 torrent url.
                return 200;
            }
            await this.handleTimeout(e);
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

    private blockResources(page: Page): void {
        page.on('request', (request: any) => {
            const requestUrl = request._url.split('?')[0].split('#')[0];
            if (BLOCKED_RESOURCE_TYPES.indexOf(request.resourceType()) !== -1 ||
                SKIPPED_RESOURCES.some(resource => requestUrl.indexOf(resource)  !== -1)) {
                request.abort();
            } else {
                request.continue();
            }
        });
    }
}
