import type { SearchOperator } from '@/lib/student-search'

/**
 * Hand-written documentation for the student-search filters, keyed by the
 * server registry's attribute keys. This file is prose only — labels, groups,
 * kinds and operator lists always come from the live `meta()` response at
 * render time, so the help can never contradict the server. An attribute
 * missing here still shows up in the help with generic auto-generated text.
 */

export interface FilterExample {
  /** Short headline: the question the query answers. */
  title: string
  /** Optional elaboration in placement-cell terms. */
  description?: string
  /** The conditions exactly as set in the visual builder (attr = registry key). */
  builder: { attr: string; op: SearchOperator; value?: unknown }[]
  /** The equivalent NQL text (paste-ready). */
  nql: string
}

export interface FilterHelpEntry {
  /** One-liner shown in the summary list. */
  summary: string
  /** Longer explanation for the detail view. */
  details?: string
  /** How derived values are computed — critical for placement/internship attrs. */
  semantics?: string
  examples?: FilterExample[]
}

/** One-liner per attribute group (keys mirror the server's ATTRIBUTE_GROUPS). */
export const GROUP_HELP: Record<string, string> = {
  identity: 'Who the student is — name, roll number, contact and personal details.',
  admission: 'How and when they joined — programme, department, batch and entry type.',
  academic: 'Academic performance — school percentages, CGPA, backlogs, gaps and resume.',
  certifications: 'Industry certifications recorded on the student profile.',
  placement:
    'Placement standing derived from drive outcomes — offers, companies and CTC.',
  academic_internship:
    'Internship outcomes derived from internship-type drives — companies, count and stipend.',
  parent: 'Parent and guardian contact details.',
  address: 'Home address — district, state, country and pincode.',
  entrance: 'Entrance exam, rank and year.',
  tenth: '10th standard schooling — board, institution, year and state.',
  twelfth: '12th standard schooling — board, institution, year and state.',
  diploma: 'Diploma schooling — board, institution, specialization, year and state.',
  system: 'Record status and bookkeeping timestamps.',
}

/** Plain-language glossary for every filter operator. */
export const OPERATOR_GLOSSARY: Record<
  SearchOperator,
  { label: string; description: string }
> = {
  eq: { label: '=', description: 'Exactly equals the value.' },
  neq: { label: '≠', description: 'Anything except the value.' },
  gt: { label: '>', description: 'Strictly greater than the value.' },
  gte: { label: '≥', description: 'Greater than or equal to the value.' },
  lt: { label: '<', description: 'Strictly less than the value.' },
  lte: { label: '≤', description: 'Less than or equal to the value.' },
  between: {
    label: 'between',
    description: 'Within a range, both ends included.',
  },
  contains: {
    label: 'contains',
    description: 'The text appears anywhere in the value (case-insensitive).',
  },
  not_contains: {
    label: 'not contains',
    description: 'The text appears nowhere in the value.',
  },
  starts_with: {
    label: 'starts with',
    description: 'The value begins with the text (case-insensitive).',
  },
  in: {
    label: 'in',
    description: 'Matches any one of the selected values.',
  },
  not_in: {
    label: 'not in',
    description: 'Matches none of the selected values.',
  },
  is_null: {
    label: 'is empty',
    description: 'The field has no value recorded.',
  },
  not_null: {
    label: 'is not empty',
    description: 'The field has some value recorded.',
  },
}

/**
 * Shared prose for the placement-outcome probes: how "placed" is derived.
 * Referenced by several placement attributes so the story stays identical.
 */
const PLACED_SEMANTICS =
  'Derived from drive outcomes, not a profile field: a student counts as ' +
  '"placed" once a drive marks them Selected and that drive\'s offer type is a ' +
  'full-time role. Each Selected full-time outcome is one placement — a student ' +
  'with two offers matches conditions on either.'

const INTERNSHIP_SEMANTICS =
  'Derived from drive outcomes, not a profile field: a student counts as an ' +
  '"intern" once a drive marks them Selected and that drive\'s offer type is an ' +
  'internship (including internship + full-time offers). Each Selected ' +
  'internship outcome counts once.'

export const FILTER_HELP: Record<string, FilterHelpEntry> = {
  // --- identity -------------------------------------------------------------
  student_id: {
    summary: 'The roll number, e.g. 22981A0501.',
    details:
      'Also searched by the free-text box above the results, so plain lookups ' +
      'rarely need a filter. Use "starts with" to select whole series — a ' +
      'branch code or an admission batch prefix.',
    examples: [
      {
        title: 'One CSE admission series',
        builder: [{ attr: 'student_id', op: 'starts_with', value: '22981A05' }],
        nql: 'student_id ^= "22981A05"',
      },
    ],
  },
  display_name: {
    summary: 'Full name as printed on records.',
    details:
      'Also covered by the free-text search box. "contains" matches anywhere ' +
      'in the name, so surnames work.',
    examples: [
      {
        title: 'Everyone with "reddy" in their name, 2026 batch',
        builder: [
          { attr: 'display_name', op: 'contains', value: 'reddy' },
          { attr: 'pass_out_year', op: 'eq', value: 2026 },
        ],
        nql: 'display_name ~ "reddy" AND pass_out_year = 2026',
      },
    ],
  },
  first_name: { summary: 'First name only.' },
  middle_name: { summary: 'Middle name, when recorded.' },
  last_name: { summary: 'Last name / surname only.' },
  gender: {
    summary: 'Male, Female or Other — as recorded at admission.',
    examples: [
      {
        title: 'Female students for a diversity drive',
        builder: [{ attr: 'gender', op: 'eq', value: 'female' }],
        nql: 'gender = "female"',
      },
    ],
  },
  dob: {
    summary: 'Date of birth.',
    details:
      'Some companies set an age ceiling. Filter with a date cutoff — e.g. ' +
      '"born on or after" a date is `≥` that date.',
    examples: [
      {
        title: 'Born in 2004 or later (age cap)',
        builder: [{ attr: 'dob', op: 'gte', value: '2004-01-01' }],
        nql: 'dob >= "2004-01-01"',
      },
    ],
  },
  blood_group: { summary: 'Blood group recorded on the profile.' },
  abc_id: { summary: 'Academic Bank of Credits ID.' },
  email: {
    summary: 'The college-issued email address.',
    details: 'Also covered by the free-text search box.',
  },
  personal_email: { summary: 'The student’s personal email address.' },
  mobile_number: {
    summary: 'The student’s mobile number.',
    details: 'Also covered by the free-text search box.',
  },

  // --- admission ------------------------------------------------------------
  programme: {
    summary: 'The programme the student is enrolled in, e.g. B.Tech CSE.',
    details:
      'Pick one or more programmes from the list. This is usually the first ' +
      'condition of any drive shortlist.',
    examples: [
      {
        title: 'Circuit branches only',
        builder: [
          {
            attr: 'programme',
            op: 'in',
            value: '(select programmes, e.g. B.Tech ECE, B.Tech EEE)',
          },
        ],
        nql: 'programme IN ("B.Tech ECE", "B.Tech EEE")',
      },
    ],
  },
  department: {
    summary: 'The department that owns the student’s programme.',
    details:
      'A shortcut for "all programmes under this department" — broader than ' +
      'filtering by programme.',
  },
  degree: {
    summary: 'The degree level of the programme (B.Tech, M.Tech, MBA…).',
  },
  admission_year: {
    summary: 'The academic year the student was admitted in.',
    details:
      'Lateral-entry students join a different admission year than their ' +
      'classmates — for drive eligibility, pass-out year is usually the safer ' +
      'batch filter.',
  },
  attendance_group: {
    summary: 'The section (attendance group) the student belongs to.',
  },
  entry_type: {
    summary: 'How the student entered — Regular, Lateral entry, etc.',
    examples: [
      {
        title: 'Regular-entry students only',
        builder: [{ attr: 'entry_type', op: 'eq', value: 'Regular' }],
        nql: 'entry_type = "Regular"',
      },
    ],
  },
  pass_out_year: {
    summary: 'The year the student graduates — the usual "batch" for drives.',
    details:
      'Works for lateral entries too (their pass-out year matches their ' +
      'classmates even though the admission year differs).',
    examples: [
      {
        title: 'The 2026 outgoing batch',
        builder: [{ attr: 'pass_out_year', op: 'eq', value: 2026 }],
        nql: 'pass_out_year = 2026',
      },
    ],
  },

  // --- academic -------------------------------------------------------------
  tenth_percentage: {
    summary: '10th standard percentage (0–100).',
    details:
      'Students with no 10th percentage recorded never match a numeric ' +
      'comparison — add "is empty" with OR in NQL if you want to include them.',
    examples: [
      {
        title: 'Typical service-company cutoff: 60% in 10th',
        builder: [{ attr: 'tenth_percentage', op: 'gte', value: 60 }],
        nql: 'tenth_percentage >= 60',
      },
    ],
  },
  twelfth_percentage: {
    summary: '12th standard percentage (0–100). Empty for diploma-entry students.',
    details:
      'Most students have either a 12th or a diploma percentage, not both. A ' +
      '"60% in 12th OR diploma" criterion needs an OR group, which the visual ' +
      'builder cannot express — switch to NQL for it.',
    examples: [
      {
        title: '60% in 12th or diploma (the standard either/or criterion)',
        description:
          'The visual builder joins conditions with AND only; this OR ' +
          'alternative is written in NQL mode.',
        builder: [],
        nql: '(twelfth_percentage >= 60 OR diploma_percentage >= 60)',
      },
    ],
  },
  diploma_percentage: {
    summary: 'Diploma percentage (0–100). Empty for 12th-entry students.',
    details:
      'Pairs with 12th percentage in either/or eligibility criteria — see the ' +
      '12th percentage examples.',
  },
  ug_cgpa: {
    summary: 'Current undergraduate CGPA (0–10).',
    examples: [
      {
        title: 'CGPA 6.5 and above',
        builder: [{ attr: 'ug_cgpa', op: 'gte', value: 6.5 }],
        nql: 'ug_cgpa >= 6.5',
      },
      {
        title: 'A CGPA band, best first',
        description: '"between" includes both ends.',
        builder: [{ attr: 'ug_cgpa', op: 'between', value: [7, 8.5] }],
        nql: 'ug_cgpa BETWEEN 7 AND 8.5 ORDER BY ug_cgpa DESC',
      },
    ],
  },
  current_backlogs: {
    summary: 'Number of subjects the student currently has pending.',
    details:
      'This is the live count. Whether they ever failed a subject — even one ' +
      'cleared since — is the separate "Ever had a backlog" filter.',
    examples: [
      {
        title: 'No active backlogs right now',
        builder: [{ attr: 'current_backlogs', op: 'eq', value: 0 }],
        nql: 'current_backlogs = 0',
      },
      {
        title: 'At most one active backlog (lenient drives)',
        builder: [{ attr: 'current_backlogs', op: 'lte', value: 1 }],
        nql: 'current_backlogs <= 1',
      },
    ],
  },
  backlog_history: {
    summary: 'Whether the student has EVER had a backlog, even one cleared since.',
    details:
      'Strict companies require a clean history, not just a clean present. ' +
      'Combine with the current-backlogs count to express either reading.',
    examples: [
      {
        title: 'Spotless record (never failed a subject)',
        builder: [
          { attr: 'current_backlogs', op: 'eq', value: 0 },
          { attr: 'backlog_history', op: 'eq', value: false },
        ],
        nql: 'current_backlogs = 0 AND backlog_history = false',
      },
      {
        title: 'Cleared everything now, but had backlogs before',
        description:
          'Fine for companies that only care about the present state.',
        builder: [
          { attr: 'current_backlogs', op: 'eq', value: 0 },
          { attr: 'backlog_history', op: 'eq', value: true },
        ],
        nql: 'current_backlogs = 0 AND backlog_history = true',
      },
    ],
  },
  year_of_gap: {
    summary: 'Years of gap in education, as recorded on the profile.',
    examples: [
      {
        title: 'No education gap',
        builder: [{ attr: 'year_of_gap', op: 'eq', value: 0 }],
        nql: 'year_of_gap = 0',
      },
    ],
  },
  reason_of_gap: { summary: 'Free-text reason recorded for an education gap.' },
  has_resume: {
    summary: 'Whether the student has added their resume link.',
    details:
      'Supports Yes/No only. Useful as a readiness check before inviting ' +
      'students to a drive.',
    examples: [
      {
        title: 'Interested in placements but no resume yet',
        description: 'A follow-up list for the placement cell.',
        builder: [
          { attr: 'interested_in_placements_self', op: 'eq', value: true },
          { attr: 'has_resume', op: 'eq', value: false },
        ],
        nql: 'interested_in_placements_self = true AND has_resume = false',
      },
    ],
  },

  // --- certifications -------------------------------------------------------
  industry_certifications: {
    summary: 'Industry certifications recorded on the profile (AWS, Azure, …).',
    details:
      '"in" matches students holding ANY of the selected certifications; ' +
      '"not in" excludes students holding any of them.',
    examples: [
      {
        title: 'Cloud-certified students',
        builder: [
          {
            attr: 'industry_certifications',
            op: 'in',
            value: '(select certifications from the list)',
          },
        ],
        nql: 'industry_certifications IN ("AWS Cloud Practitioner")',
      },
    ],
  },

  // --- placement ------------------------------------------------------------
  allowed_by_dept_for_placements: {
    summary: 'Whether the department has cleared the student for placements.',
    details:
      'One of the three recommended defaults on drive shortlists — remove it ' +
      'only when you deliberately want students the department has held back.',
  },
  interested_in_placements_self: {
    summary: 'Whether the student has opted in to placements themselves.',
    details:
      'One of the three recommended defaults on drive shortlists. Students ' +
      'aiming at higher studies typically opt out.',
  },
  placed_company: {
    summary: 'A company the student already holds a full-time offer from.',
    semantics: PLACED_SEMANTICS,
    examples: [
      {
        title: 'Everyone placed at a specific company',
        builder: [
          {
            attr: 'placed_company',
            op: 'eq',
            value: '(pick the company from the list)',
          },
        ],
        nql: 'placed_company = "TCS"',
      },
    ],
  },
  placed_company_category: {
    summary: 'The CRM category of a company the student is placed in.',
    semantics: PLACED_SEMANTICS,
    examples: [
      {
        title: 'Not yet placed in a product company',
        description:
          'Students who may still sit for product-company drives under a ' +
          'category-upgrade policy.',
        builder: [
          {
            attr: 'placed_company_category',
            op: 'not_in',
            value: '(select the Product category)',
          },
        ],
        nql: 'placed_company_category NOT IN ("Product")',
      },
    ],
  },
  placed_placement_category: {
    summary: 'The placement category (Dream, Super Dream, …) of an offer held.',
    semantics: PLACED_SEMANTICS,
    examples: [
      {
        title: 'Students without a Super Dream offer yet',
        description:
          'Eligible for Super Dream drives under a one-offer-per-tier policy.',
        builder: [
          {
            attr: 'placed_placement_category',
            op: 'not_in',
            value: '(select Super Dream)',
          },
        ],
        nql: 'placed_placement_category NOT IN ("Super Dream")',
      },
    ],
  },
  offer_type: {
    summary: 'The offer type (Full-time, Internship + FTE, …) of a Selected outcome.',
    details:
      'Matches on ANY drive where the student was Selected, whatever the ' +
      'offer type — unlike the other placement filters, this one is not ' +
      'limited to full-time outcomes.',
    examples: [
      {
        title: 'Holding a full-time or internship+FTE offer',
        builder: [
          {
            attr: 'offer_type',
            op: 'in',
            value: '(select the offer types)',
          },
        ],
        nql: 'offer_type IN ("Full-time", "Internship + FTE")',
      },
    ],
  },
  placed_count: {
    summary: 'How many full-time offers the student holds. 0 = unplaced.',
    semantics:
      PLACED_SEMANTICS +
      ' Unlike the other placement filters, this one can also be shown as a ' +
      'column and sorted on.',
    examples: [
      {
        title: 'Not yet placed, from the outgoing batch',
        description: 'The classic "who still needs an offer" list.',
        builder: [
          { attr: 'placed_count', op: 'eq', value: 0 },
          { attr: 'pass_out_year', op: 'eq', value: 2026 },
        ],
        nql: 'placed_count = 0 AND pass_out_year = 2026',
      },
      {
        title: 'Multiple offers, most first',
        description:
          'Relevant when a one-student-one-offer policy is in force.',
        builder: [{ attr: 'placed_count', op: 'gte', value: 2 }],
        nql: 'placed_count >= 2 ORDER BY placed_count DESC',
      },
    ],
  },
  placed_ctc: {
    summary: 'The CTC (in LPA) of a full-time offer the student holds.',
    semantics:
      PLACED_SEMANTICS +
      ' The figure compared is the CTC recorded on the student’s selection ' +
      'itself — captured when they were marked Selected; where a range was ' +
      'recorded, its maximum is used. Unplaced students have no CTC at all, ' +
      'and selections recorded before designation/package capture existed ' +
      'have no figure either — neither ever matches a numeric comparison.',
    examples: [
      {
        title: 'Placed below 6 LPA — dream-offer eligible',
        description:
          'Under a typical dream-offer policy a placed student may sit for ' +
          'drives paying above a multiplier of their current offer. The ' +
          'placed-count condition is redundant (unplaced students can’t ' +
          'match a CTC comparison anyway) but makes the intent obvious.',
        builder: [
          { attr: 'placed_count', op: 'gte', value: 1 },
          { attr: 'placed_ctc', op: 'lt', value: 6 },
        ],
        nql: 'placed_count >= 1 AND placed_ctc < 6',
      },
      {
        title: 'Holds an offer of 10 LPA or more',
        builder: [{ attr: 'placed_ctc', op: 'gte', value: 10 }],
        nql: 'placed_ctc >= 10',
      },
    ],
  },

  // --- academic internship --------------------------------------------------
  internship_company: {
    summary: 'A company the student has an internship selection from.',
    semantics: INTERNSHIP_SEMANTICS,
    examples: [
      {
        title: 'Interned at a specific company',
        builder: [
          {
            attr: 'internship_company',
            op: 'eq',
            value: '(pick the company from the list)',
          },
        ],
        nql: 'internship_company = "Infosys"',
      },
    ],
  },
  internship_company_category: {
    summary: 'The CRM category of a company the student interned with.',
    semantics: INTERNSHIP_SEMANTICS,
  },
  internship_placement_category: {
    summary: 'The placement category of an internship selection.',
    semantics: INTERNSHIP_SEMANTICS,
  },
  internship_count: {
    summary: 'How many internship selections the student has. 0 = none.',
    semantics:
      INTERNSHIP_SEMANTICS +
      ' Can also be shown as a column and sorted on.',
    examples: [
      {
        title: 'Final years with no internship yet',
        builder: [
          { attr: 'internship_count', op: 'eq', value: 0 },
          { attr: 'pass_out_year', op: 'eq', value: 2026 },
        ],
        nql: 'internship_count = 0 AND pass_out_year = 2026',
      },
    ],
  },
  internship_stipend: {
    summary: 'The stipend (₹ per month) of an internship selection.',
    semantics:
      INTERNSHIP_SEMANTICS +
      ' The figure compared is the stipend recorded on the student’s ' +
      'selection itself — captured when they were marked Selected; where a ' +
      'range was recorded, its maximum is used. Students with no internship ' +
      'never match a numeric comparison, and neither do selections recorded ' +
      'before designation/package capture existed (they have no figure).',
    examples: [
      {
        title: 'Interned at ₹20,000/month or more',
        description:
          'The internship-count condition is redundant but states the intent.',
        builder: [
          { attr: 'internship_count', op: 'gte', value: 1 },
          { attr: 'internship_stipend', op: 'gte', value: 20000 },
        ],
        nql: 'internship_count >= 1 AND internship_stipend >= 20000',
      },
    ],
  },

  // --- parent & guardian ----------------------------------------------------
  parent_name: { summary: 'Parent’s name as recorded on the profile.' },
  parent_mobile: { summary: 'Parent’s mobile number.' },
  parent_email: { summary: 'Parent’s email address.' },
  guardian_name: { summary: 'Guardian’s name, where a guardian is recorded.' },
  guardian_mobile: { summary: 'Guardian’s mobile number.' },
  guardian_email: { summary: 'Guardian’s email address.' },

  // --- address --------------------------------------------------------------
  home_address: { summary: 'Free-text home address.' },
  home_pincode: {
    summary: 'Home pincode.',
    examples: [
      {
        title: 'A pincode zone (starts with)',
        builder: [{ attr: 'home_pincode', op: 'starts_with', value: '5310' }],
        nql: 'home_pincode ^= "5310"',
      },
    ],
  },
  home_district: {
    summary: 'Home district, from the districts master list.',
    details:
      'Useful for location-constrained drives — e.g. a company hiring for a ' +
      'local office that prefers nearby candidates.',
  },
  home_state: { summary: 'Home state.' },
  home_country: { summary: 'Home country.' },

  // --- entrance -------------------------------------------------------------
  entrance_exam_na: {
    summary: 'Whether the student marked entrance exam as not applicable.',
  },
  entrance_exam: { summary: 'The entrance exam taken (EAMCET, JEE, …).' },
  entrance_exam_rank: {
    summary: 'Rank obtained in the entrance exam.',
    examples: [
      {
        title: 'Top 10,000 EAMCET ranks',
        builder: [
          { attr: 'entrance_exam', op: 'eq', value: '(select the exam)' },
          { attr: 'entrance_exam_rank', op: 'lte', value: 10000 },
        ],
        nql: 'entrance_exam = "EAMCET" AND entrance_exam_rank <= 10000',
      },
    ],
  },
  entrance_exam_year: { summary: 'The year the entrance exam was taken.' },

  // --- tenth ----------------------------------------------------------------
  tenth_board: { summary: 'The 10th standard board (SSC, CBSE, …).' },
  tenth_institution: { summary: 'The 10th standard school, free text.' },
  tenth_year_of_pass: { summary: 'The year the student passed 10th.' },
  tenth_state: { summary: 'The state where 10th was completed.' },

  // --- twelfth --------------------------------------------------------------
  twelfth_board: { summary: 'The 12th standard board (Intermediate, CBSE, …).' },
  twelfth_institution: { summary: 'The 12th standard college, free text.' },
  twelfth_year_of_pass: { summary: 'The year the student passed 12th.' },
  twelfth_state: { summary: 'The state where 12th was completed.' },

  // --- diploma --------------------------------------------------------------
  diploma_board: { summary: 'The diploma board.' },
  diploma_institution: { summary: 'The diploma institution, free text.' },
  diploma_year_of_pass: { summary: 'The year the diploma was completed.' },
  diploma_specialization: { summary: 'The diploma specialization, free text.' },
  diploma_state: { summary: 'The state where the diploma was completed.' },

  // --- system ---------------------------------------------------------------
  is_active: {
    summary: 'Whether the student record is active (not withdrawn/removed).',
    details:
      'One of the three recommended defaults on drive shortlists — inactive ' +
      'records are usually withdrawals and detained students.',
  },
  created_at: { summary: 'When the student record was created.' },
  updated_at: { summary: 'When the student record was last modified.' },
}
