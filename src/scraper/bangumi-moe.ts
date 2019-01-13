import Axios from 'axios';
import { inject, injectable } from 'inversify';
import { basename, extname } from 'path';
import { Item } from '../entity/Item';
import { ItemType } from '../entity/item-type';
import { MediaFile } from '../entity/media-file';
import { Publisher } from '../entity/publisher';
import { Team } from '../entity/Team';
import { PersistentStorage, Scraper, TYPES } from '../types';

@injectable()
export class BangumiMoe implements Scraper {
    private static _host = 'https://bangumi.moe';

    constructor(@inject(TYPES.PersistentStorage) private _store: PersistentStorage<string>) {}

    public async start(): Promise<any> {
        try {
            const resp = await Axios.get(`${BangumiMoe._host}/api/v2/torrent/page/1`);
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
            for (let item of items) {
                await this._getTorrentDetail(item);
                await this._store.putItem(item);
            }
            return Promise.resolve(items);
        } catch (e) {
            console.warn(e.stack);
        }
        return Promise.resolve(null);
    }

    public end(): Promise<any> {
        return undefined;
    }

    private async _getTorrentDetail(item: Item<string>): Promise<void> {
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

        } catch (e) {
            console.warn(e.stack);
        }
        return Promise.resolve();
    }
}
