import Axios from 'axios';
import { inject, injectable } from 'inversify';
import { basename, extname } from 'path';
import { Item } from '../entity/Item';
import { ItemType } from '../entity/item-type';
import { MediaFile } from '../entity/media-file';
import { Publisher } from '../entity/publisher';
import { Team } from '../entity/Team';
import { BangumiMoeTask } from '../task/bangumi-moe-task';
import { TaskOrchestra } from '../task/task-orchestra';
import { Task, TaskType } from '../task/task-types';
import { ConfigLoader, PersistentStorage, Scraper, TYPES } from '../types';

@injectable()
export class BangumiMoe implements Scraper {
    private static _host = 'https://bangumi.moe';

    constructor(@inject(TYPES.PersistentStorage) private _store: PersistentStorage<string>,
                @inject(TYPES.ConfigLoader) private _config: ConfigLoader,
                @inject(TaskOrchestra) private _taskOrchestra: TaskOrchestra) {}

    public async start(): Promise<any> {
        this._taskOrchestra.queue(new BangumiMoeTask(TaskType.MAIN));
        this._taskOrchestra.start(this);
    }

    public async executeTask(task: Task): Promise<any> {
        if (task.type === TaskType.SUB) {
            return this._getTorrentDetail((task as BangumiMoeTask).item);
        } else {
            let result;
            if (task instanceof BangumiMoeTask) {
                result = await this._getList((task as BangumiMoeTask).pageNo);
            } else {
                result = await this._getList();
            }
            for (let item of result.items) {
                this._taskOrchestra.queue(new BangumiMoeTask(TaskType.SUB, item));
            }
            if (result.hasNext && (task as BangumiMoeTask).pageNo < this._config.maxPageNo) {
                let newTask = new BangumiMoeTask(TaskType.MAIN);
                newTask.pageNo = (task as BangumiMoeTask).pageNo + 1;
                this._taskOrchestra.queue(newTask);
            }
        }
    }

    public end(): Promise<any> {
        return undefined;
    }

    private async _getList(pageNo: number = 1): Promise<{items: Array<Item<string>>, hasNext: boolean}> {
        console.log(`Scrapping ${BangumiMoe._host}/api/v2/torrent/page/${pageNo}`);
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
            console.warn(e.stack);
        }
        return Promise.resolve(null);
    }

    private async _getTorrentDetail(item: Item<string>): Promise<void> {
        console.log(`Scrapping ${BangumiMoe._host}/api/v2/torrent/${item.id}`);
        try {
            const resp = await Axios.get(`${BangumiMoe._host}/api/v2/torrent/${item.id}`);
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
            await this._store.putItem(item);
        } catch (e) {
            console.warn(e.stack);
        }
        return Promise.resolve();
    }
}
