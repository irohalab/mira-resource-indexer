import { ItemType } from './item-type';
import { MediaFile } from './media-file';
import { Publisher } from './publisher';
import { Team } from './Team';

export class Item<T> {
    public id: T; // this id is unique identifier for all types of entries. And for database primary key too.
    public title: string;
    public files: MediaFile[]; // file contains in the torrent
    public type: ItemType<T>;
    public team?: Team<T>;
    public timestamp: Date;
    public uri?: string; // uri related to this resource.
    public publisher: Publisher<T>;
    public torrent_url?: string;
    public magnet_uri?: string;
}
