let taskCount = 0;

export enum TaskType {
    SUB = 0,
    MAIN = 1
}

export interface Task {
    id: number;
    type: TaskType;
}

export class CommonTask implements Task {
    public id: number;
    constructor(public type: TaskType) {
        this.id = taskCount++;
    }
}
