/**
 * The Compare tab's selection as it travels in the address:
 * `compare=d:1,p:3,b:12` — `d` department, `p` programme, `b` batch
 * (programme_admission_year). Kept apart from the tab component so the file
 * that exports components exports nothing else (Fast Refresh).
 */
export const MAX_COMPARE = 4

export type CompareEntity = { kind: 'd' | 'p' | 'b'; id: number }

export function parseCompare(raw: string): CompareEntity[] | undefined {
  if (!raw) return []
  const out: CompareEntity[] = []
  for (const part of raw.split(',')) {
    const m = /^([dpb]):(\d+)$/.exec(part)
    if (!m) return undefined
    out.push({ kind: m[1] as CompareEntity['kind'], id: Number(m[2]) })
  }
  return out.slice(0, MAX_COMPARE)
}

export function serialiseCompare(list: CompareEntity[]): string | undefined {
  return list.length ? list.map((e) => `${e.kind}:${e.id}`).join(',') : undefined
}
