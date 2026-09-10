import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'
import type {
  ExportFormat,
  FkOption,
  ParsedNql,
  SearchMeta,
  StudentSearchApi,
  StudentSearchBody,
  StudentSearchResult,
} from './student-search'

/**
 * Data layer for Students > Student directory (`students.directory.view`).
 * Scope is applied server-side from the employee's RBAC assignment
 * (departments / programmes / admission years / sections), so the adapter
 * sends nothing but the query itself.
 */

const ROOT = '/employee/students'

/**
 * The registry-driven student search bound to the directory endpoints. Takes
 * no arguments, so a single module-level instance gives the panel the stable
 * adapter identity it boots on.
 */
export function studentsDirectorySearchApi(): StudentSearchApi {
  return {
    meta: () =>
      withEmployeeAuth((token) =>
        apiFetch<SearchMeta>(`${ROOT}/search/meta`, { token }),
      ),
    search: (body: StudentSearchBody) =>
      withEmployeeAuth((token) =>
        apiFetch<StudentSearchResult>(`${ROOT}/search`, {
          method: 'POST',
          body,
          token,
        }),
      ),
    options: (lookup: string, q?: string) => {
      const qs = new URLSearchParams({ lookup })
      if (q) qs.set('q', q)
      return withEmployeeAuth((token) =>
        apiFetch<FkOption[]>(`${ROOT}/search/options?${qs}`, { token }),
      )
    },
    parseNql: (nql: string) =>
      withEmployeeAuth((token) =>
        apiFetch<ParsedNql>(`${ROOT}/search/parse-nql`, {
          method: 'POST',
          body: { nql },
          token,
        }),
      ),
    createExport: (body: StudentSearchBody, format: ExportFormat) =>
      withEmployeeAuth((token) =>
        apiFetch<{ job_id: number }>(`${ROOT}/export`, {
          method: 'POST',
          body: { ...body, format },
          token,
        }),
      ),
  }
}
