/**
 * SheetJS is ~400 KB minified and only two upload flows use it. Load it on
 * demand at the call site (`const XLSX = await loadXlsx()`) instead of a static
 * `import * as XLSX from 'xlsx'`, which would pull it into whichever page chunk
 * imports it — and, before route splitting, into the login page.
 */
export function loadXlsx() {
  return import('xlsx')
}
