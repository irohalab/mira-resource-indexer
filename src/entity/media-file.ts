export class MediaFile {
    public id?: number; // serial type unique primary key
    public item_id?: number;
    public path: string; // relative in torrent
    public name: string;
    public ext: string;
    public size: string;
}
