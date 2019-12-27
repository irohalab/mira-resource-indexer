import { interfaces } from 'inversify';

export function MockTaskTiming(context: interfaces.Context) {
    return (interval: number) => {
        return Math.round(interval);
    };
}
