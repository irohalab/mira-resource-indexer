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

/* tslint:disable */
export const CREATE_TABLE_WITH_NUM_ID = {
    ITEM: 'CREATE TABLE IF NOT EXISTS item (' +
    'id INTEGER PRIMARY KEY, ' +
    'title TEXT, ' +
    'type_id INTEGER, ' +
    'team_id INTEGER, ' +
    'timestamp TIMESTAMP, ' +
    'uri TEXT, ' +
    'publisher_id INTEGER, ' +
    'torrent_url TEXT, ' +
    'magnet_uri TEXT, ' +
    'sent BOOLEAN' +
    ')',
    ITEM_TYPE: 'CREATE TABLE IF NOT EXISTS item_type (' +
    'id INTEGER PRIMARY KEY, ' +
    'name TEXT' +
    ')',
    TEAM: 'CREATE TABLE IF NOT EXISTS team (' +
    'id INTEGER PRIMARY KEY, ' +
    'name TEXT' +
    ')',
    PUBLISHER: 'CREATE TABLE IF NOT EXISTS publisher (' +
    'id INTEGER PRIMARY KEY, ' +
    'name TEXT' +
    ')',
    MEDIA_FILE: 'CREATE TABLE IF NOT EXISTS media_file (' +
    'id SERIAL PRIMARY KEY, ' +
    'item_id INTEGER NOT NULL, ' +
    'path TEXT, ' +
    'name TEXT, ' +
    'ext VARCHAR(64), ' +
    'size VARCHAR(128), ' +
    'FOREIGN KEY (item_id) REFERENCES item ON DELETE CASCADE' +
    ')'
};

export const CREATE_TABLE_WITH_STRING_ID = {
    ITEM: 'CREATE TABLE IF NOT EXISTS item (' +
    'id VARCHAR(128) PRIMARY KEY, ' +
    'title TEXT, ' +
    'type_id VARCHAR(128), ' +
    'team_id VARCHAR(128), ' +
    'timestamp TIMESTAMP, ' +
    'uri TEXT, ' +
    'publisher_id VARCHAR(128), ' +
    'torrent_url TEXT, ' +
    'magnet_uri TEXT, ' +
    'sent BOOLEAN' +
    ')',
    ITEM_TYPE: 'CREATE TABLE IF NOT EXISTS item_type (' +
    'id VARCHAR(128) PRIMARY KEY, ' +
    'name TEXT' +
    ')',
    TEAM: 'CREATE TABLE IF NOT EXISTS team (' +
    'id VARCHAR(128) PRIMARY KEY, ' +
    'name TEXT' +
    ')',
    PUBLISHER: 'CREATE TABLE IF NOT EXISTS publisher (' +
    'id VARCHAR(128) PRIMARY KEY, ' +
    'name TEXT' +
    ')',
    MEDIA_FILE: 'CREATE TABLE IF NOT EXISTS media_file (' +
    'id SERIAL PRIMARY KEY, ' +
    'item_id VARCHAR(128) NOT NULL, ' +
    'path TEXT, ' +
    'name TEXT, ' +
    'ext VARCHAR(64), ' +
    'size VARCHAR(128), ' +
    'FOREIGN KEY (item_id) REFERENCES item ON DELETE CASCADE' +
    ')',
};
