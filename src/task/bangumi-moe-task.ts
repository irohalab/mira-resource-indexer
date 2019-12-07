import { Item } from '../entity/Item';
import { CommonTask, TaskType } from './task-types';

export class BangumiMoeTask extends CommonTask {
    public pageNo: number = 1;

    constructor(public type: TaskType,
                public item?: Item<string>) {
        super(type);
    }
}
