import {
  BookPlus,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Plus,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ApiError } from '@/lib/api'
import {
  createInchargeCourse,
  fetchInchargeEmployees,
  removeInchargeCourse,
  setInchargeCourseFaculty,
  type IncharqeTimetable,
  type LookupEmployee,
  type TimetableCourse,
} from '@/lib/incharge-schedule'
import { cn } from '@/lib/utils'

export interface CoursesManagerProps {
  timetable: IncharqeTimetable
  canEdit: boolean
  onChange: (next: IncharqeTimetable) => void
}

/**
 * Manages this timetable's exclusive courses (subjects that aren't part of
 * the programme_semester_subjects list — added per template only). Each
 * course carries its own faculty list. Used when the grid needs a class
 * that's not on the master subject list (lab tutorials, club-led sessions,
 * special workshops, etc.).
 */
export function CoursesManager({
  timetable,
  canEdit,
  onChange,
}: CoursesManagerProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [facultyEditing, setFacultyEditing] = useState<TimetableCourse | null>(
    null,
  )
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  async function removeCourse(course: TimetableCourse) {
    if (!confirm(`Remove "${courseLabel(course)}"? Cells using it will be deleted.`))
      return
    setRemovingId(course.id)
    setRemoveError(null)
    try {
      const next = await removeInchargeCourse(course.id)
      onChange(next)
    } catch (err) {
      setRemoveError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't remove the course.",
      )
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
        <BookPlus className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Timetable-exclusive courses
        </h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {timetable.courses?.length ?? 0} added
        </span>
        {canEdit ? (
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus />
            Add course
          </Button>
        ) : null}
      </header>

      <div className="p-4">
        {removeError ? (
          <p className="mb-3 flex items-center gap-1.5 text-sm text-destructive">
            <CircleAlert className="size-4" />
            {removeError}
          </p>
        ) : null}

        {!timetable.courses || timetable.courses.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
            No exclusive courses. Add one for activities that aren't part of
            the programme semester's master subject list — labs, club
            sessions, workshops.
          </p>
        ) : (
          <ul className="divide-y">
            {timetable.courses.map((course) => (
              <CourseRow
                key={course.id}
                course={course}
                canEdit={canEdit}
                onEditFaculty={() => setFacultyEditing(course)}
                onRemove={() => void removeCourse(course)}
                removing={removingId === course.id}
              />
            ))}
          </ul>
        )}
      </div>

      <AddCourseSheet
        open={addOpen}
        timetable={timetable}
        onClose={() => setAddOpen(false)}
        onCreated={(next) => {
          setAddOpen(false)
          onChange(next)
        }}
      />

      <EditFacultySheet
        course={facultyEditing}
        onClose={() => setFacultyEditing(null)}
        onSaved={(next) => {
          setFacultyEditing(null)
          onChange(next)
        }}
      />
    </Card>
  )
}

function CourseRow({
  course,
  canEdit,
  onEditFaculty,
  onRemove,
  removing,
}: {
  course: TimetableCourse
  canEdit: boolean
  onEditFaculty: () => void
  onRemove: () => void
  removing: boolean
}) {
  const facultyList = course.faculty ?? []
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-semibold">{courseLabel(course)}</p>
        <p className="text-xs text-muted-foreground">
          {course.subject ? `Master subject · ${course.subject.code}` : 'Custom activity'}
        </p>
        {facultyList.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {facultyList.map((f) => (
              <Badge key={f.id} variant="secondary">
                <UserIcon className="size-3" />
                {f.employee?.emp_display_name ?? `#${f.employee_id}`}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-warning">
            No faculty allocated — cells using this course won't have a
            teacher.
          </p>
        )}
      </div>
      {canEdit ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" onClick={onEditFaculty}>
            Faculty
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRemove}
            disabled={removing}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {removing ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Remove
          </Button>
        </div>
      ) : null}
    </li>
  )
}

function courseLabel(course: TimetableCourse): string {
  if (course.subject) return `${course.subject.code} · ${course.subject.name}`
  return course.custom_label ?? `Course #${course.id}`
}

// ---------------------------------------------------------------------------
// Add course sheet
// ---------------------------------------------------------------------------

function AddCourseSheet({
  open,
  timetable,
  onClose,
  onCreated,
}: {
  open: boolean
  timetable: IncharqeTimetable
  onClose: () => void
  onCreated: (next: IncharqeTimetable) => void
}) {
  const [label, setLabel] = useState('')
  const [employees, setEmployees] = useState<LookupEmployee[] | null>(null)
  const [employeesError, setEmployeesError] = useState<string | null>(null)
  const [pickedIds, setPickedIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLabel('')
    setPickedIds([])
    setSearch('')
    setSubmitError(null)
    setEmployeesError(null)
    setEmployees(null)
    fetchInchargeEmployees()
      .then((rows) => {
        if (!cancelled) setEmployees(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setEmployeesError(
            err instanceof Error ? err.message : 'Could not load employees.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const filteredEmployees = useMemo(() => {
    if (!employees) return []
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (e) =>
        e.emp_display_name.toLowerCase().includes(q) ||
        e.emp_code.toLowerCase().includes(q),
    )
  }, [employees, search])

  const canSubmit =
    label.trim().length > 0 && pickedIds.length > 0 && !submitting

  async function submit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const next = await createInchargeCourse(timetable.id, {
        custom_label: label.trim(),
        employee_ids: pickedIds,
      })
      onCreated(next)
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't add the course.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col">
        <SheetHeader>
          <SheetTitle>Add an exclusive course</SheetTitle>
          <SheetDescription>
            Add a free-text activity to this template only. Pick the
            faculty who deliver it.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <div className="space-y-1.5">
            <Label htmlFor="course-label">Course label</Label>
            <Input
              id="course-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Faculty</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code…"
            />
            {employeesError ? (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <CircleAlert className="size-4" />
                {employeesError}
              </p>
            ) : !employees ? (
              <div className="space-y-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="shimmer h-9 rounded bg-muted/60" />
                ))}
              </div>
            ) : filteredEmployees.length === 0 ? (
              <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                No employees match your search.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-md border bg-card scrollbar-themed">
                <ul className="divide-y">
                  {filteredEmployees.slice(0, 200).map((e) => {
                    const checked = pickedIds.includes(e.id)
                    return (
                      <li key={e.id}>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent',
                            checked && 'bg-primary/10',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setPickedIds((prev) =>
                                prev.includes(e.id)
                                  ? prev.filter((id) => id !== e.id)
                                  : [...prev, e.id],
                              )
                            }
                            className="size-4"
                          />
                          <span className="flex-1 truncate">
                            {e.emp_display_name}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {e.emp_code}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {pickedIds.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {pickedIds.length} picked.
              </p>
            ) : null}
          </div>

          {submitError ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <CircleAlert className="size-4" />
              {submitError}
            </p>
          ) : null}
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="flex-1"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Adding…
              </>
            ) : (
              <>
                <CheckCircle2 />
                Add course
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Edit faculty sheet — reuses the same employee picker
// ---------------------------------------------------------------------------

function EditFacultySheet({
  course,
  onClose,
  onSaved,
}: {
  course: TimetableCourse | null
  onClose: () => void
  onSaved: (next: IncharqeTimetable) => void
}) {
  const [employees, setEmployees] = useState<LookupEmployee[] | null>(null)
  const [employeesError, setEmployeesError] = useState<string | null>(null)
  const [pickedIds, setPickedIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!course) return
    let cancelled = false
    setSearch('')
    setSubmitError(null)
    setEmployeesError(null)
    setEmployees(null)
    setPickedIds((course.faculty ?? []).map((f) => f.employee_id))
    fetchInchargeEmployees()
      .then((rows) => {
        if (!cancelled) setEmployees(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setEmployeesError(
            err instanceof Error ? err.message : 'Could not load employees.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [course])

  const filteredEmployees = useMemo(() => {
    if (!employees) return []
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (e) =>
        e.emp_display_name.toLowerCase().includes(q) ||
        e.emp_code.toLowerCase().includes(q),
    )
  }, [employees, search])

  async function submit() {
    if (!course) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const next = await setInchargeCourseFaculty(course.id, pickedIds)
      onSaved(next)
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't update faculty.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={course !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col">
        <SheetHeader>
          <SheetTitle>Edit faculty</SheetTitle>
          <SheetDescription>
            {course ? courseLabel(course) : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code…"
          />
          {employeesError ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <CircleAlert className="size-4" />
              {employeesError}
            </p>
          ) : !employees ? (
            <div className="space-y-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="shimmer h-9 rounded bg-muted/60" />
              ))}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md border bg-card scrollbar-themed">
              <ul className="divide-y">
                {filteredEmployees.slice(0, 200).map((e) => {
                  const checked = pickedIds.includes(e.id)
                  return (
                    <li key={e.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent',
                          checked && 'bg-primary/10',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setPickedIds((prev) =>
                              prev.includes(e.id)
                                ? prev.filter((id) => id !== e.id)
                                : [...prev, e.id],
                            )
                          }
                          className="size-4"
                        />
                        <span className="flex-1 truncate">
                          {e.emp_display_name}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {e.emp_code}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {submitError ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <CircleAlert className="size-4" />
              {submitError}
            </p>
          ) : null}
          <p className="text-xs text-warning">
            <X className="mr-1 inline size-3" />
            Saving with an empty list will fail — a timetable course must keep
            at least one faculty member.
          </p>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={submitting || pickedIds.length === 0}
            className="flex-1"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 />
                Save faculty
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
