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
import { basename, extname } from 'path';
import { Item } from '../entity/Item';
import { ItemType } from '../entity/item-type';
import { MediaFile } from '../entity/media-file';
import { Publisher } from '../entity/publisher';
import { TaskOrchestra } from '../task/task-orchestra';
import { ConfigLoader, ItemStorage, TYPES } from '../types';
import { AzureLogger } from '../utils/azure-logger';
import { captureException } from '../utils/sentry';
import { BaseScraper } from './abstract/base-scraper';
import cheerio = require('cheerio');

// tslint:disable-next-line:variable-name no-var-requires
const HttpsProxyAgent = require('https-proxy-agent');

const logger = AzureLogger.getInstance();

@injectable()
export class NyaaScraper extends BaseScraper<number> {
    private static _host = 'https://nyaa.si';

    constructor(
        @inject(TYPES.ItemStorage) store: ItemStorage<number>,
        @inject(TaskOrchestra) taskOrchestra: TaskOrchestra,
        @inject(TYPES.ConfigLoader) config: ConfigLoader
    ) {
        super(taskOrchestra, config, store);
    }

    public async executeMainTask(pageNo?: number): Promise<{ items: Array<Item<number>>, hasNext: boolean }> {
        try {
            let listPageUrl = NyaaScraper._host;
            if (pageNo) {
                listPageUrl += '/?p=' + pageNo;
            }
            console.log(`Scrapping ${listPageUrl}`);
            const agent = new HttpsProxyAgent('http://127.0.0.1:8118');
            const resp = await Axios.get(listPageUrl, {
                httpsAgent: agent,
                proxy: false
            });
            console.log(`Get ${listPageUrl} data successful`);

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

    public async executeSubTask(item: Item<number>): Promise<number> {
        let statusCode = -1;
        try {
            const subTaskUrl = `${NyaaScraper._host}${item.uri}`;
            console.log(`Scrapping ${subTaskUrl}`);
            const agent = new HttpsProxyAgent('http://127.0.0.1:8118');
            const resp = await Axios.get(subTaskUrl, {
                httpsAgent: agent,
                proxy: false
            });
            console.log(`Get ${subTaskUrl} data successful`);
            statusCode = resp.status;

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
        } catch (e) {
            if (e.response) {
                statusCode = e.response.status;
            } else {
                statusCode = -1;
            }
            logger.log('exception', e.stack, AzureLogger.ERROR, {line: '135'});
            captureException(e);
            console.error(e.stack);
        }
        return statusCode;
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
            return parseInt(match[1], 10) * 100 + parseInt(match[2], 10);
        }
        return 0;
    }
}
