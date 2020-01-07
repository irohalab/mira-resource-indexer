import { init, captureMessage as sentryCaptureMessage, captureException as sentryCaptureException } from '@sentry/node';
const DSN = process.env.SENTRY_DSN;
const RELEASE = process.env.RELEASE || process.env.npm_package_version;

if (DSN) {
    init({ dsn: DSN, release: `indexer@${RELEASE}` });
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
