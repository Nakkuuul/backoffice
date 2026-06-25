/** Report job lifecycle. */
export const REPORT_STATUS = Object.freeze({
  PENDING: 'pending', // queued (bulk) or just created
  GENERATING: 'generating', // claimed by a worker / being rendered
  READY: 'ready', // generated and stored
  FAILED: 'failed', // generation failed / attempts exhausted
});

/** Output formats and their MIME types / extensions. */
export const FORMATS = Object.freeze({
  pdf: { contentType: 'application/pdf', ext: 'pdf' },
  csv: { contentType: 'text/csv', ext: 'csv' },
  xlsx: {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
  },
  html: { contentType: 'text/html', ext: 'html' },
});

export const SUPPORTED_FORMATS = Object.keys(FORMATS);
