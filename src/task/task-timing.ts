import { interfaces } from 'inversify';

export function TaskTiming(context: interfaces.Context) {
    return (interval: number) => {
        return Math.round(interval + Math.random() * interval);
    };
}
