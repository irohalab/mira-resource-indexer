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

import { ItemType } from './item-type';
import { MediaFile } from './media-file';
import { Publisher } from './publisher';
import { Team } from './Team';

export class Item<T> {
    [key: string]: any;
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
