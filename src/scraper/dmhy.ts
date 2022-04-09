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

import { inject, injectable } from 'inversify';
import { basename, extname } from 'path';
import { Browser, launch, Page } from 'puppeteer';
import { resolve } from 'url';
import { unlinkSync } from 'fs';
import { downloadFile } from '../utils/download';
import { getTorrentFiles } from '../utils/torrent-utils';
import { Item } from '../entity/Item';
import { ItemType } from '../entity/item-type';
import { MediaFile } from '../entity/media-file';
import { Publisher } from '../entity/publisher';
import { Team } from '../entity/Team';
import { TaskOrchestra } from '../task/task-orchestra';
import { ConfigLoader, ItemStorage, TYPES } from '../types';
import { toUTCDate, trimDomain } from '../utils/normalize';
import { captureException } from '../utils/sentry';
import { BaseScraper } from './abstract/base-scraper';
import { logger } from '../utils/logger-factory';

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

@injectable()
export class DmhyScraper extends BaseScraper<number> {
    private static _host = 'https://share.dmhy.org';
    private _browser: Browser;

    constructor(@inject(TYPES.ItemStorage) store: ItemStorage<number>,
                @inject(TaskOrchestra) taskOrchestra: TaskOrchestra,
                @inject(TYPES.ConfigLoader) config: ConfigLoader) {
        super(taskOrchestra, config, store);
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
        await this._browser.close();
    }

    public async executeMainTask(pageNo?: number): Promise<{items: Array<Item<number>>, hasNext: boolean}> {
        const page = await this._browser.newPage();
        // page.setUserAgent('Mozilla/5.5 (X11; Linux x86_64) ' +
        //     'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36');
        try {
            await page.setRequestInterception(true);
            this.blockResources(page);
            let listPageUrl = DmhyScraper._host;
            if (pageNo) {
                listPageUrl += '/topics/list/page/' + pageNo;
            }
            logger.info('execute_main_task', {
                pageNo
            });
            await page.goto(listPageUrl, {
                waitUntil: 'domcontentloaded'
            });
            let tableElement = await page.$('#topic_list');
            let trList = await tableElement.$$('tbody>tr');
            let items = [];
            for (let tr of trList) {
                let item = new Item<number>();
                item.uri = trimDomain(await page.evaluate(el => {
                    let titleLink = el.querySelector('td.title>a');
                    if (titleLink && titleLink.getAttribute('href')) {
                        return titleLink.getAttribute('href').trim();
                    }
                    return null;
                }, tr));
                item.id = this.getIdFromUri(item.uri);
                items.push(item);

                // type
                item.type = new ItemType<number>();
                item.type.id = this.getIdFromUri(
                    await page.evaluate(
                        el => el.querySelector('td:nth-child(2) > a').getAttribute('href'), tr),
                    /\/topics\/list\/sort_id\/(\d+)/);
                item.type.name = await page.evaluate(
                    el => el.querySelector('td:nth-child(2) > a font').textContent.trim(), tr);
            }
            let newIds = await this._store.filterItemNotStored(items.map(item => item.id));
            let newItems = items.filter(item => {
                return newIds.includes(item.id);
            });
            return {hasNext: newIds.length === items.length && newIds.length > 0, items: newItems};
        } catch (e) {
            captureException(e);
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

    public async executeSubTask(item: Item<number>): Promise<number> {
        const page = await this._browser.newPage();
        let statusCode = -1;
        let bodyStr = null;
        try {
            await page.setRequestInterception(true);
            this.blockResources(page);
            logger.info('execute_sub_task', {
                item
            });
            const response = await page.goto(DmhyScraper._host + item.uri, {
                waitUntil: 'domcontentloaded'
            });
            statusCode = response.status();
            bodyStr = await response.text();
            let mainArea = await page.$('.main .topics_bk');
            if (!mainArea) {
                return 404;
            }

            item.title = await page.evaluate(el => {
                const h3El = el.querySelector('.topic-main > .topic-title > h3');
                return h3El.textContent.trim();
            }, mainArea);
            // console.log(item.title);
            let publisherElement = await mainArea.$('.user-sidebar > .avatar.box:nth-child(1) > p:nth-child(2) > a');
            // console.log(publisherElement.toString());
            item.publisher = new Publisher<number>();
            item.publisher.id = this.getIdFromUri(await page.evaluate(el => el.getAttribute('href'), publisherElement),
                /\/topics\/list\/user_id\/(\d+)/);
            // console.log(item.publisher);
            item.publisher.name = await page.evaluate(el => {
                let name = el.textContent;
                if (name) {
                    name = name.trim();
                }
                return name;
            }, publisherElement);

            let teamElement = await mainArea.$('.user-sidebar > .avatar.box:nth-child(2) > p:nth-child(2) > a');
            if (teamElement) {
                item.team = new Team<number>();
                item.team.id = this.getIdFromUri(await page.evaluate(el => el.getAttribute('href'), teamElement),
                    /\/topics\/list\/team_id\/(\d+)/);
                item.team.name = await page.evaluate(el => {
                    let name = el.textContent;
                    if (name) {
                        name = name.trim();
                    }
                    return name;
                }, teamElement);
                // console.log(item.team);
            }
            let resourceInfoElement = await mainArea.$('.info.resource-info.right > ul');
            item.timestamp = toUTCDate(await page.evaluate(el => {
                const spanEl = el.querySelector('li:nth-child(2) > span');
                let timeStr = spanEl.textContent;
                if (timeStr) {
                    return timeStr.trim();
                }
                return Date.now();
            }, resourceInfoElement), 8);
            // console.log(item.timestamp);
            let btResourceElement = await mainArea.$('#tabs-1');
            item.torrent_url = resolve('https://', await page.evaluate(el => {
                const anchor = el.querySelector('p:nth-child(1) > a');
                return anchor.getAttribute('href');
            }, btResourceElement));
            item.magnet_uri = await page.evaluate(el => {
                const anchor = el.querySelector('#a_magnet');
                return anchor.getAttribute('href');
            }, btResourceElement);

            item.files = [];
            const filePath = await downloadFile(item.torrent_url);
            const files = await getTorrentFiles(filePath);
            files.forEach(file => {
                let mediaFile = new MediaFile();
                mediaFile.size = file.length.toString();
                mediaFile.path = file.path;
                mediaFile.ext = extname(mediaFile.path);
                mediaFile.name = basename(mediaFile.path, mediaFile.ext);
                item.files.push(mediaFile);
            });
            unlinkSync(filePath);
        } catch (e) {
            console.info(bodyStr);
            if (e.response) {
                statusCode = e.response.status;
            } else {
                statusCode = -1;
            }
            captureException(e);
            logger.warn('execute_sub_task_exception', {
                code: e.code,
                error_message: e.message,
                item,
                line: '265',
                stack: e.stack
            });
        } finally {
            await page.close();
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
