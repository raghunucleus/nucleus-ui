// English — the source of truth for the parent-portal `parent` namespace. `hi`
// and `te` are typed `typeof en`, so adding a key here without translating it in
// the other two fails the build. Interpolation uses {{var}}; count-based strings
// use i18next plural suffixes (`_one` / `_other`).
//
// NOT exported as `const` on purpose: leaving the leaves as `string` (rather than
// string-literal types) lets hi/te satisfy `typeof en` with their own wording.
export const en = {
  lang: { label: 'Language' },

  common: {
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    retry: 'Retry',
    tryAgain: 'Try again',
    saving: 'Saving…',
    sending: 'Sending…',
    backToSignIn: 'Back to sign in',
    cancel: 'Cancel',
  },

  nav: {
    home: 'Home',
    timetable: 'Timetable',
    attendance: 'Attendance',
    examResults: 'Exam results',
    holidays: 'Holidays',
    profile: 'Profile',
  },

  brand: { parentPortal: 'Parent portal' },

  a11y: {
    openAccount: 'Open account menu',
    parentHome: 'Parent home',
    expandSidebar: 'Expand sidebar',
    collapseSidebar: 'Collapse sidebar',
    prevWeek: 'Previous week',
    nextWeek: 'Next week',
    loading: 'Loading',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },

  account: { switchStudent: 'Switch student', switch: 'Switch', collapse: 'Collapse' },

  loginChrome: {
    eyebrow: 'Welcome to Nucleus',
    title: 'Sign in',
    subtitle: 'Choose your account type to continue.',
    tabStudent: 'Student',
    tabParent: 'Parent',
    needHelp: 'Need help?',
    contact: 'Contact your institution',
  },

  login: {
    mobileLabel: 'Registered mobile number',
    password: 'Password',
    forgot: 'Forgot password?',
    errMobile: 'Enter your 10-digit mobile number.',
  },

  pw: {
    hint: 'Use at least 8 characters, including a letter and a number.',
    errLen: 'Password must be at least 8 characters.',
    errLetter: 'Password must contain at least one letter.',
    errNumber: 'Password must contain at least one number.',
    mismatch: 'The new passwords do not match.',
  },

  change: {
    title: 'Set a new password',
    desc: 'You are signed in with a temporary password. Choose a new one to continue.',
    temp: 'Temporary password',
    newPw: 'New password',
    confirm: 'Confirm new password',
    save: 'Save and continue',
    cancel: 'Cancel and sign out',
  },

  forgot: {
    title: 'Reset your password',
    desc: "Enter your registered mobile number. We'll send a verification code to the contact on file.",
    send: 'Send code',
  },

  otp: {
    title: 'Enter your code',
    desc: 'We sent a 6-digit code to the contact on file for {{mobile}}. Enter it and choose a new password.',
    codeLabel: 'Verification code',
    codePlaceholder: '6-digit code',
    set: 'Set password',
    errCode: 'Enter the 6-digit code we sent you.',
    newPw: 'New password',
    confirm: 'Confirm new password',
  },

  done: {
    title: 'Password updated',
    desc: 'Your password has been set. You can now sign in with it.',
  },

  generic: { error: 'Something went wrong. Please try again.' },

  selectChild: {
    title: 'Select a student to continue',
    signedInAs: 'Signed in as {{name}}',
    emptyTitle: 'No linked students',
    emptyDesc:
      "Your account isn't linked to any active student yet. Please contact your institution.",
  },

  home: {
    greetMorning: 'Good morning',
    greetAfternoon: 'Good afternoon',
    greetEvening: 'Good evening',
    statAttendance: 'Attendance',
    statCgpa: 'CGPA',
    statBacklogs: 'Backlogs',
    notYet: 'Not yet',
    upcomingHolidays: 'Upcoming holidays',
    // Identity strip
    identitySem: 'Semester {{n}}',
    batch: 'Batch {{year}}',
    // Stat-tile hints
    creditsHint: '{{credits}} credits earned',
    backlogsClear: 'All clear',
    subjectsPassed: '{{passed}}/{{total}} subjects passed',
    // Attendance focus
    attnFocus: 'Attendance focus',
    attnOverall: 'Overall attendance',
    attnAllSubjects: 'All subjects',
    // Academic performance
    academicTitle: 'Academic performance',
    academicCredits: 'Credits',
    academicBacklogs: 'Backlogs',
    academicTrend: 'SGPA by semester',
    academicPending: 'Results have not been published yet.',
    semShort: 'Sem {{n}}',
  },

  profile: {
    viewingStudent: 'Viewing student',
    noStudent: 'No student selected.',
    allLinked: 'All linked students',
  },

  attendance: {
    title: 'Attendance',
    semester: 'Semester {{n}}',
    overall: 'Overall attendance',
    standingGood: 'On track',
    standingLow: 'Low',
    standingShortage: 'Shortage',
    subjectWise: 'Subject-wise attendance',
    subjectsReq: '{{n}} subjects · {{threshold}}% required for exam eligibility',
    summaryNone: '{{a}} of {{h}} classes attended.',
    classes: '{{a}} / {{h}} classes',
    missed: '{{n}} missed',
    viewHistory: 'View class history',
    viewAllClasses: 'View all classes',
    noDataTitle: 'No attendance yet',
    noDataDesc:
      'No subjects with attendance data yet. Check back once classes start.',
    notReadyDesc: "Attendance will show up here as soon as it's available.",
  },

  timetable: {
    title: 'Timetable',
    thisWeek: 'This week',
    classesCount: '{{n}} classes',
    error: 'Could not load the timetable.',
    periods: '{{n}} periods',
    badgeLecture: 'Lecture',
    badgeLab: 'Lab',
    badgeElective: 'Elective',
    badgeCancelled: 'Cancelled',
    badgeRescheduled: 'Rescheduled',
    dayLong: {
      '1': 'Monday',
      '2': 'Tuesday',
      '3': 'Wednesday',
      '4': 'Thursday',
      '5': 'Friday',
      '6': 'Saturday',
      '7': 'Sunday',
    },
    dayShort: {
      '1': 'Mon',
      '2': 'Tue',
      '3': 'Wed',
      '4': 'Thu',
      '5': 'Fri',
      '6': 'Sat',
      '7': 'Sun',
    },
  },

  exam: {
    title: 'Exam results',
    cgpaLabel: 'Cumulative GPA',
    summary: '{{n}} semesters · {{credits}} credits',
    backlogs_one: '{{count}} active backlog',
    backlogs_other: '{{count}} active backlogs',
    backlogNote: 'Subjects awaiting a pass — clearing them lifts the CGPA.',
    semesterResults: 'Semester results',
    tapHint: 'Tap a semester to see its subject grades.',
    search: 'Search a subject…',
    noMatch: 'No subject matches “{{q}}”.',
    pass: 'Pass',
    fail: 'Fail',
    semMeta: '{{subjects}} subjects · {{credits}} credits',
    semBacklog: '{{n}} backlog',
    sgpa: 'SGPA',
    scaleNote: 'Graded on a 10-point scale',
    colCourse: 'Course',
    colCredits: 'Credits',
    colGrade: 'Grade',
    attempts: '{{n}} attempts',
    allAttempts: 'All attempts (newest → oldest)',
    best: 'Best',
    pts: '{{n}} pts',
    errTitle: "Couldn't load the results",
    emptyTitle: 'Results not yet published',
    emptyDesc: 'Results will appear here once your institution publishes them.',
  },

  holidays: {
    title: 'Academic holidays',
    tabUpcoming: 'Upcoming',
    tabPast: 'Past',
    emptyUpcoming: 'No upcoming holidays. Check the Past tab for earlier breaks.',
    emptyPast: 'No past holidays yet.',
    showing: 'Showing {{start}}–{{end}} of {{total}}',
    prev: 'Prev',
    next: 'Next',
    pageOf: 'Page {{page}} of {{total}}',
    errTitle: "Couldn't load holidays",
  },

  subject: {
    titleFallback: 'Subject attendance',
    backToAttendance: 'Back to attendance',
    filterAll: 'All classes',
    filterAbsent: 'Only absent',
    showingAbsent: 'Showing {{n}} absent of {{total}} total',
    showingAll: 'Showing all {{n}} classes · {{absent}} absent',
    noAbsences: 'No absences recorded — keep it going.',
    noClassesYet: 'No classes recorded for this subject yet.',
    reason: 'Reason:',
    errLoad: "Couldn't load this subject's sessions.",
    missing: 'Missing subject.',
    statusPresent: 'Present',
    statusAbsent: 'Absent',
    statusLate: 'Late',
    statusOd: 'OD',
    statusExempt: 'Exempt',
    statusLeave: 'Leave',
    statusCancelled: 'Cancelled',
    statusUnmarked: 'Not marked',
    statusUpcoming: 'Upcoming',
    sub: 'Sub',
    viewLabel: 'View',
    viewCalendar: 'Calendar',
    viewList: 'List',
    filterLabel: 'Filter sessions',
    legend: 'Legend',
    noClassesThisMonth: 'No classes this month.',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    today: 'Today',
    dayCount_one: '{{count}} class',
    dayCount_other: '{{count}} classes',
    dayAbsent_one: '{{count}} absent',
    dayAbsent_other: '{{count}} absent',
    prevDay: 'Previous day',
    nextDay: 'Next day',
    close: 'Close',
    tapDayHint: 'Tap a day to see its classes.',
    summaryOther: 'Other',
    filterAllSubjects: 'All subjects',
    allTitle: 'All classes',
    allNoClassesYet: 'No classes recorded this semester yet.',
    allErrLoad: "Couldn't load the classes.",
  },

  // Device limit (sign-in picker) + signed-in devices (profile).
  // `{{when}}` is an already-localised relative time ("5 minutes ago").
  devices: {
    limitTitle: 'Device limit reached',
    limitDesc_one:
      "You're signed in on {{n}} of {{count}} allowed device. Sign out of at least one to continue here.",
    limitDesc_other:
      "You're signed in on {{n}} of {{count}} allowed devices. Sign out of at least one to continue here.",
    lastActive: 'Last active {{when}}',
    signedIn: 'Signed in {{when}}',
    submit_one: 'Sign out {{count}} device & continue',
    submit_other: 'Sign out {{count}} devices & continue',
    selectPrompt: 'Select a device to sign out',
    raceNotice:
      'Those devices were signed out, but every slot is taken again — pick another device.',
    challengeExpired: 'Your sign-in session has expired. Please sign in again.',
    title: 'Signed-in devices',
    subtitle:
      "Everywhere your account is signed in. Sign out any device you don't recognise — it takes effect immediately.",
    thisDevice: 'This device',
    empty: 'No signed-in devices found.',
    loadError: "Couldn't load your devices.",
    confirmTitleCurrent: 'Sign out of this device?',
    confirmTitleOther: 'Sign out of “{{name}}”?',
    confirmDescCurrent: "You'll be returned to the sign-in screen.",
    confirmDescOther:
      'That device is disconnected immediately and will need to sign in again.',
    signedOutToast: 'Signed out of “{{name}}”.',
    alreadySignedOut: 'That device was already signed out.',
    revokeError: 'Could not sign that device out. Please try again.',
  },
}
