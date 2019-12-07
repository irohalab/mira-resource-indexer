import { Item } from '../entity/Item';
import { CommonTask, TaskType } from './task-types';

export class DmhyTask extends CommonTask {
    public pageNo: number = 1; // only used for main task

    constructor(type: TaskType,
                public item?: Item<number>) {
        super(type);
    }
}
