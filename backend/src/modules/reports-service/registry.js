/**
 * Registry of report definitions. Each report is a self-contained definition;
 * adding a new broker report = adding one file under definitions/ and
 * registering it here. The rest of the service (queue, renderers, storage,
 * delivery) is generic and never changes.
 *
 * A report definition shape:
 * {
 *   key: 'client-ledger',                 // stable id (report_type)
 *   title: 'Client Ledger Statement',
 *   formats: ['pdf','csv','xlsx','html'], // which outputs it supports
 *   async resolveData(params) {           // pull from Postgres → tabular data
 *     return {
 *       title,                            // display title (may include client/date)
 *       meta: { label: value, ... },      // header key/values shown on the report
 *       columns: [{ key, header, align?, money? }],
 *       rows: [{ ... }],
 *       footer?: [{ key, header }],        // optional totals row config
 *     };
 *   },
 *   renderHtml?(data) { return '<html>…' } // optional custom HTML; else generic table
 * }
 */
const registry = new Map();

export function registerReport(def) {
  if (!def?.key) throw new Error('report definition needs a key');
  registry.set(def.key, def);
}

export function getReport(key) {
  return registry.get(key) ?? null;
}

export function listReports() {
  return [...registry.values()].map((d) => ({
    key: d.key,
    title: d.title,
    formats: d.formats,
  }));
}
