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

import { EventLog } from '../entity/EventLog';
import { AggregateEventLogsFilterOptions, EventLogStore, EventSummary, LogType } from '../TYPES_IDX';
import { Db, Filter } from 'mongodb';
import { DatabaseService } from '../service/database-service';
import { inject, injectable } from 'inversify';
import { Sentry, TYPES } from '@irohalab/mira-shared';
import { ConfigManager } from '../utils/config-manager';

@injectable()
export class MongodbEventLogStore implements EventLogStore {

    private get db(): Db {
        return this._databaseService.db;
    }

    private _eventLogCollectionName = 'event_log';

    constructor(private _databaseService: DatabaseService,
                @inject(TYPES.ConfigManager) private _config: ConfigManager,
                @inject(TYPES.Sentry) private _sentry: Sentry) {
        this._databaseService.checkCollection([this._eventLogCollectionName]);
    }

    public async putEventLog(eventName: string, eventType: LogType): Promise<void> {
        await this.db.collection(this._eventLogCollectionName).insertOne({
            eventName,
            eventType,
            timestamp: new Date().toISOString()
        });
    }
    public async getLogs(eventType?: LogType, eventName?: string): Promise<EventLog[]> {
        const filter: Filter<EventLog> = {};
        if (eventType) {
            filter.eventType = eventType;
        }
        if (eventName) {
            filter.eventName = eventName;
        }
        const records = this.db.collection<EventLog>(this._eventLogCollectionName).find({
            eventType,
            eventName
        });
        return await records.toArray();
    }
    public async aggregateLogsByInterval(interval: 'day' | 'hour', filterOptions: AggregateEventLogsFilterOptions): Promise<EventSummary[]> {
        const { eventType, eventName, startDate, endDate } = filterOptions;
        const pipeline: object[] = [];
        const eventLogCollection = this.db.collection<EventLog>(this._eventLogCollectionName);
        // Stage 1: Conditionally add a $match stage if a date range is provided.
        // This filters documents to the specified range before grouping.
        const matchFilter: any = {};
        if (startDate) {
            matchFilter.$gte = startDate;
        }
        if (endDate) {
            matchFilter.$lte = endDate;
        }
        if (eventName) {
            matchFilter.eventName = eventName;
        }
        if (eventType) {
            matchFilter.eventType = eventType;
        }

        if (Object.keys(matchFilter).length > 0) {
            pipeline.push({
                $match: matchFilter
            });
        }

        // Add the subsequent stages for grouping and sorting.
        pipeline.push(
            {
                // Stage 2: Group documents to calculate the count.
                // We group by eventType, eventName, and the specified time interval.
                $group: {
                    _id: {
                        // Extract date parts for grouping.
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' },
                        // Conditionally add the hour to the grouping key if the interval is 'hour'.
                        ...(interval === 'hour' && { hour: { $hour: '$timestamp' } })
                    },
                    // Count the number of documents in each group.
                    count: { $sum: 1 }
                }
            },
            {
                // Stage 3: Sort the results for a clean, ordered output.
                // Sorting by the components of the _id field.
                $sort: {
                    '_id.year': 1,
                    '_id.month': 1,
                    '_id.day': 1,
                    // Conditionally sort by hour if it exists in the _id.
                    ...('_id.hour' in { _id: {} } && { '_id.hour': 1 })
                }
            }
        );


        // Execute the aggregation pipeline and return the results as an array.
        return await eventLogCollection.aggregate<EventSummary>(pipeline).toArray();
    }
}
