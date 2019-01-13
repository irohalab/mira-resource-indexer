export class MediaFile {
    id?: number; // serial type unique primary key
    item_id?: number;
    path: string; // relative in torrent
    name: string;
    ext: string;
    size: string;
}