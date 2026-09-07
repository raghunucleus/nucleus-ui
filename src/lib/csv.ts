/**
 * Client-side CSV download — no server round-trip, so the file always matches
 * exactly what the user is looking at, including any filter or sort they
 * applied in the browser.
 *
 * Use this for screen-sized exports (a class roster, a defaulter list). Large
 * or long-running exports belong in the async exports framework instead.
 */

export type CsvCell = string | number | boolean | null | undefined

/**
 * RFC 4180 escaping. A field is quoted when it contains a comma, a quote or a
 * newline, and embedded quotes are doubled. Without this, a student name with a
 * comma silently shifts every later column by one.
 */
function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  const raw = String(value)
  if (!/[",\r\n]/.test(raw)) return raw
  return `"${raw.replace(/"/g, '""')}"`
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','))
  // CRLF is what Excel expects; a lone \n leaves the whole file on one row in
  // some Windows builds.
  return lines.join('\r\n')
}

/**
 * Trigger a download of `rows` as a CSV file.
 *
 * The UTF-8 BOM is not optional here: without it Excel on Windows decodes the
 * file as the system codepage, which mangles every non-ASCII name in the
 * roster. Browsers and Sheets ignore it.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CsvCell[][],
): void {
  const blob = new Blob(['﻿', toCsv(headers, rows)], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick — revoking synchronously can cancel the download
  // in Safari before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
