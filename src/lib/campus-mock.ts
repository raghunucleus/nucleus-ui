/**
 * Static demo data for the campus dashboard — social feed, classmates,
 * events, birthdays and holidays. UI-only for now; swap this file for real
 * API calls once the corresponding endpoints exist.
 *
 * Time-relative items (events, birthdays, holidays) store an `offsetDays`
 * from "today" rather than a fixed date, so the demo always looks current.
 *
 * Pure TypeScript (no React imports) so it stays portable.
 */
import type { ModuleColor } from '@/lib/modules'

// ---------------------------------------------------------------------------
// Date helpers — resolve day offsets to real dates and friendly labels.
// ---------------------------------------------------------------------------

/** Resolves a day-offset (0 = today) to a Date at local midnight. */
export function dateFromOffset(offsetDays: number): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  return date
}

/** A friendly countdown label, e.g. "Today", "Tomorrow", "in 5 days". */
export function relativeLabel(offsetDays: number): string {
  if (offsetDays <= 0) return 'Today'
  if (offsetDays === 1) return 'Tomorrow'
  return `in ${offsetDays} days`
}

// ---------------------------------------------------------------------------
// Class context — the demo student's class within their branch.
// ---------------------------------------------------------------------------

export const CLASS_CONTEXT = {
  branch: 'Computer Science & Engineering',
  section: 'CSE-A',
  semester: 6,
} as const

// ---------------------------------------------------------------------------
// Campus feed — social posts from students, faculty and official handles.
// ---------------------------------------------------------------------------

export type FeedKind =
  | 'announcement'
  | 'event'
  | 'achievement'
  | 'photo'
  | 'update'

export interface CampusPost {
  id: string
  author: string
  affiliation: string
  avatarColor: ModuleColor
  /** Relative timestamp, e.g. "3h", "Yesterday". */
  time: string
  kind: FeedKind
  content: string
  likes: number
  comments: number
  tag?: string
}

export const CAMPUS_FEED: CampusPost[] = [
  {
    id: 'p1',
    author: 'Training & Placement Cell',
    affiliation: 'Official · Raghu Engineering College',
    avatarColor: 'blue',
    time: '3h',
    kind: 'announcement',
    tag: 'Placements',
    content:
      'TCS and Infosys campus drives are confirmed. Open to the 2026 batch with 60%+ aggregate and no active backlogs. Register on the placement portal before the deadline — slots are limited.',
    likes: 142,
    comments: 38,
  },
  {
    id: 'p2',
    author: 'Coding Club',
    affiliation: 'Student Club · CSE',
    avatarColor: 'violet',
    time: '5h',
    kind: 'event',
    tag: 'Hackathon',
    content:
      'RECursion 2026 is here! Our 24-hour hackathon runs in the Innovation Hub. Teams of 3, a ₹50,000 prize pool, and mentors from the industry. Registrations are officially open 🚀',
    likes: 208,
    comments: 54,
  },
  {
    id: 'p3',
    author: 'Sai Teja',
    affiliation: 'CSE-A · 6th semester',
    avatarColor: 'emerald',
    time: '8h',
    kind: 'achievement',
    content:
      'We placed 2nd at the Smart India Hackathon regional round! Huge thanks to our mentors and everyone who cheered us on. On to the nationals 🏆',
    likes: 312,
    comments: 71,
  },
  {
    id: 'p4',
    author: 'Dr. Anil Kumar',
    affiliation: 'Faculty · Computer Science & Engineering',
    avatarColor: 'amber',
    time: 'Yesterday',
    kind: 'announcement',
    tag: 'Guest Lecture',
    content:
      "Guest lecture on 'LLMs in Production' by a senior engineer from Google — Seminar Hall A, 2:00 PM. Strongly recommended for all 6th semester students.",
    likes: 96,
    comments: 12,
  },
  {
    id: 'p5',
    author: 'Cultural Committee',
    affiliation: 'Student Body · Raghu Engineering College',
    avatarColor: 'rose',
    time: 'Yesterday',
    kind: 'event',
    tag: 'Fest',
    content:
      'Spandana 2026 — our annual cultural fest — is almost here! Auditions for dance, music and drama are running all week at the open-air theatre. Come show us what you have.',
    likes: 187,
    comments: 43,
  },
  {
    id: 'p6',
    author: 'Priya Nair',
    affiliation: 'CSE-A · 6th semester',
    avatarColor: 'orange',
    time: '2d',
    kind: 'photo',
    content:
      'Golden hour from the CSE block after today’s ML lab session. This campus really never disappoints 🌇',
    likes: 421,
    comments: 28,
  },
  {
    id: 'p7',
    author: 'Central Library',
    affiliation: 'Official · Raghu Engineering College',
    avatarColor: 'cyan',
    time: '2d',
    kind: 'update',
    content:
      'Exam-season hours: the central library will stay open until 11:00 PM. A fresh batch of reference titles has arrived in the Computer Science section.',
    likes: 64,
    comments: 9,
  },
]

// ---------------------------------------------------------------------------
// Classmates — the student's own class (CSE-A · 6th sem) and their presence.
// ---------------------------------------------------------------------------

export type Presence = 'in-class' | 'library' | 'online' | 'away'

export interface Classmate {
  name: string
  presence: Presence
  avatarColor: ModuleColor
  /** What they are up to right now. */
  note: string
}

export const CLASSMATES: Classmate[] = [
  {
    name: 'Sai Teja',
    presence: 'in-class',
    avatarColor: 'emerald',
    note: 'In the Machine Learning lab',
  },
  {
    name: 'Priya Nair',
    presence: 'library',
    avatarColor: 'orange',
    note: 'Studying at the central library',
  },
  {
    name: 'Ananya Reddy',
    presence: 'online',
    avatarColor: 'violet',
    note: 'Active now',
  },
  {
    name: 'Vivek Sharma',
    presence: 'in-class',
    avatarColor: 'blue',
    note: 'In Computer Networks',
  },
  {
    name: 'Meghana Rao',
    presence: 'online',
    avatarColor: 'rose',
    note: 'Active now',
  },
  {
    name: 'Karthik Menon',
    presence: 'in-class',
    avatarColor: 'cyan',
    note: 'In the Web Technologies lab',
  },
  {
    name: 'Arjun Das',
    presence: 'away',
    avatarColor: 'amber',
    note: 'Last seen 30m ago',
  },
  {
    name: 'Sneha Pillai',
    presence: 'library',
    avatarColor: 'violet',
    note: 'At the library',
  },
]

// Birthdays now come from the live /student/birthdays endpoint — see
// `lib/student-birthdays.ts` and the dynamic `BirthdaysTile`.

// ---------------------------------------------------------------------------
// Holidays — upcoming days off.
// ---------------------------------------------------------------------------

export interface Holiday {
  name: string
  offsetDays: number
  color: ModuleColor
}

export const HOLIDAYS: Holiday[] = [
  { name: 'Bakrid (Eid al-Adha)', offsetDays: 6, color: 'emerald' },
  { name: 'Muharram', offsetDays: 26, color: 'violet' },
  { name: 'Independence Day', offsetDays: 86, color: 'amber' },
]

// ---------------------------------------------------------------------------
// Campus events — dated happenings, including ones today.
// ---------------------------------------------------------------------------

export interface CampusEvent {
  title: string
  offsetDays: number
  location: string
  color: ModuleColor
}

export const CAMPUS_EVENTS: CampusEvent[] = [
  {
    title: 'Blood Donation Camp',
    offsetDays: 0,
    location: 'College Health Centre',
    color: 'rose',
  },
  {
    title: 'Guest Lecture: LLMs in Production',
    offsetDays: 1,
    location: 'Seminar Hall A',
    color: 'amber',
  },
  {
    title: 'TCS & Infosys Placement Drive',
    offsetDays: 7,
    location: 'Placement Block',
    color: 'blue',
  },
  {
    title: 'RECursion 2026 Hackathon',
    offsetDays: 16,
    location: 'Innovation Hub',
    color: 'violet',
  },
  {
    title: 'Spandana Cultural Fest',
    offsetDays: 22,
    location: 'Main Auditorium',
    color: 'rose',
  },
]
