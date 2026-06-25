/** Outbox message lifecycle states. */
export const EMAIL_STATUS = Object.freeze({
  QUEUED: 'queued', // waiting for a worker
  SENDING: 'sending', // claimed by a worker, in flight
  SENT: 'sent', // accepted by the relay
  DEFERRED: 'deferred', // transient failure, awaiting retry
  FAILED: 'failed', // permanent failure / attempts exhausted (dead-letter)
  SUPPRESSED: 'suppressed', // recipient on suppression list, not sent
});

/** Audit/observability event names. */
export const EMAIL_EVENT = Object.freeze({
  QUEUED: 'queued',
  SENDING: 'sending',
  SENT: 'sent',
  DEFERRED: 'deferred',
  FAILED: 'failed',
  SUPPRESSED: 'suppressed',
  BOUNCED: 'bounced',
  COMPLAINED: 'complained',
});

/** Suppression reasons. */
export const SUPPRESSION_REASON = Object.freeze({
  BOUNCE: 'bounce',
  COMPLAINT: 'complaint',
  UNSUBSCRIBE: 'unsubscribe',
  MANUAL: 'manual',
});
