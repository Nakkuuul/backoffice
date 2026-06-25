/** Lifecycle states for an eSign request. */
export const ESIGN_STATUS = Object.freeze({
  PENDING: 'pending',
  SIGNING: 'signing',
  SIGNED: 'signed',
  SENT: 'sent',
  FAILED: 'failed',
});

/** Audit event names recorded in esign_audit_events. */
export const ESIGN_EVENT = Object.freeze({
  CREATED: 'created',
  SIGNING_STARTED: 'signing_started',
  SIGNED: 'signed',
  SEND_QUEUED: 'send_queued',
  SENT: 'sent',
  FAILED: 'failed',
});

/** Where the source document originated. */
export const SOURCE_MODULE = Object.freeze({
  INLINE: 'inline', // base64 supplied directly on the request (dev / ad-hoc)
  DOCUMENTS: 'documents', // pulled from the documents module via document_ref
});
