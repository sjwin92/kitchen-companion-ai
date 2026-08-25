import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.user;
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.headers;
        delete event.request.query_string;
      }
      event.breadcrumbs = event.breadcrumbs?.map(breadcrumb => ({
        category: breadcrumb.category,
        level: breadcrumb.level,
        message: breadcrumb.message,
        timestamp: breadcrumb.timestamp,
        type: breadcrumb.type,
      }));
      return event;
    },
  });
}

export function captureException(error: unknown) {
  if (dsn) Sentry.captureException(error);
}
