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
import { Team } from '../entity/Team';
import { TaskOrchestra } from '../task/task-orchestra';
import { ConfigLoader, ItemStorage, TYPES } from '../types';
import { captureException } from '../utils/sentry';
import { BaseScraper } from './abstract/base-scraper';
import { logger } from '../utils/logger-factory';

@injectable()
export class BangumiMoe extends BaseScraper<string> {
    private static _host = 'https://bangumi.moe';

    constructor(@inject(TYPES.ItemStorage) store: ItemStorage<string>,
                @inject(TYPES.ConfigLoader) config: ConfigLoader,
                @inject(TaskOrchestra) taskOrchestra: TaskOrchestra) {
        super(taskOrchestra, config, store);
    }

    public async executeMainTask(pageNo: number = 1): Promise<{items: Array<Item<string>>, hasNext: boolean}> {
        logger.info('execute_main_task', {
            pageNo
        });
        try {
            const resp = await Axios.get(`${BangumiMoe._host}/api/v2/torrent/page/${pageNo}`);
            const listData = resp.data as any;
            const newIds = await this._store.filterItemNotStored(listData.torrents.map((t: any) => t._id));
            let items = listData.torrents.filter((t: any) => {
                return newIds.includes(t._id);
            }).map((t: any) => {
                let item = new Item<string>();
                item.id = t._id;
                item.title = t.title;
                item.magnet_uri = t.magnet;
                item.torrent_url = `${BangumiMoe._host}/download/torrent/${t._id}/${t._id}.torrent`;
                item.timestamp = new Date(t.publish_time);
                return item;
            });
            return {hasNext: newIds.length === listData.torrents.length && newIds.length > 0, items};
        } catch (e) {
            logger.warn('execute_main_task_exception', {
                code: e.code,
                error_message: e.message,
                line: '80',
                page_no: pageNo,
                stack: e.stack
            });
            captureException(e);
        }
        return Promise.resolve(null);
    }

    public async executeSubTask(item: Item<string>): Promise<number> {
        logger.info('execute_sub_task', {
            item
        });
        let statusCode = -1;
        try {
            const resp = await Axios.get(`${BangumiMoe._host}/api/v2/torrent/${item.id}`);
            statusCode = resp.status;
            const detailData = resp.data as any;
            if (detailData.category_tag) {
                item.type = new ItemType<string>();
                item.type.id = detailData.category_tag._id;
                item.type.name = detailData.category_tag.name;
            }
            if (detailData.uploader) {
                item.publisher = new Publisher<string>();
                item.publisher.id = detailData.uploader._id;
                item.publisher.name = detailData.uploader.username;
            }
            if (detailData.team) {
                item.team = new Team<string>();
                item.team.id = detailData.team._id;
                item.team.name = detailData.team._id;
            }
            if (detailData.content && detailData.content.length > 0) {
                item.files = detailData.content.map((f: string[]) => {
                    let mediaFile = new MediaFile();
                    mediaFile.path = f[0];
                    mediaFile.ext = extname(mediaFile.path);
                    mediaFile.name = basename(mediaFile.path, mediaFile.ext);
                    mediaFile.size = f[1];
                    return mediaFile;
                });
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
                line: '115',
                stack: e.stack
            });
            captureException(e);
        }
        return statusCode;
    }
}
