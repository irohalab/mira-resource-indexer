import { CommonTask, TaskType } from '../task/task-types';

export class FakeTask extends CommonTask {
    public pageNo: number = 1;
    constructor(public type: TaskType,
                public payload?: any) {
        super(type);
    }
}
