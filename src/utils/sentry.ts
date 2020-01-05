import {init, captureMessage as sentryCaptureMessage, captureException as sentryCaptureException} from '@sentry/node';

const DSN = process.env.SENTRY_DSN;
if (DSN) {
    init({dsn: DSN});
}

export function captureException(err: any) {
    if (DSN) {
        sentryCaptureException(err);
    }
}

export function captureMessage(msg: any) {
    if (DSN) {
        sentryCaptureMessage(msg);
    }
}
