// ============================================================
// Constants & Configuration
// ============================================================

// --- localStorage Keys ---

export const LS_KEYS = {
  PARTICIPANT: 'wikicred_participant',
  PHASE: 'wikicred_phase',
  CURRENT_SESSION: 'wikicred_session_current',
  COMPLETED_SESSIONS: 'wikicred_sessions_completed',
  SURVEY: 'wikicred_survey',
  ADMIN_DATA: 'wikicred_admin_data',
  PARTICIPANT_COUNT: 'wikicred_participant_count',
} as const;

// --- Experiment Config ---

export const EXPERIMENT = {
  EDIT_DURATION_MS: 10 * 60 * 1000, // 8 min editing + 2 min finalize
  ARTICLES: {
    A: 'semaglutide',
    B: 'vaccine-misinfo',
  },
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'demo',
} as const;

// --- Wikipedia Styling ---

export const WIKI_COLORS = {
  text: '#202122',
  textSecondary: '#54595d',
  textDisabled: '#a2a9b1',
  link: '#3366cc',
  linkHover: '#3056a9',
  linkVisited: '#6a60b0',
  linkRed: '#bf3c2c',
  background: '#ffffff',
  chrome: '#eaecf0',
  chromeBorder: '#c8ccd1',
  buttonPrimary: '#3366cc',
  buttonPrimaryHover: '#2a4b8d',
  success: '#14866d',
  warning: '#fc3',
  error: '#d33',
} as const;

// --- Form Options ---

export const EXPERIENCE_OPTIONS = {
  yearsActive: ['< 1 year', '1-3 years', '3-5 years', '5-10 years', '10+ years'],
  editCount: ['0-50', '50-500', '500-5,000', '5,000-50,000', '50,000+'],
  contentAreas: [
    'Science & Medicine',
    'History & Politics',
    'Technology',
    'Arts & Culture',
    'Geography',
    'Biographies',
    'Current Events',
    'Other',
  ],
  frequency: [
    { value: 'never', label: 'Never' },
    { value: 'rarely', label: 'Rarely' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'often', label: 'Often' },
    { value: 'always', label: 'Always' },
  ],
} as const;

// --- Metrics Throttling ---

export const METRICS = {
  EDIT_THROTTLE_MS: 500,
  HOVER_MIN_DURATION_MS: 500,
  FLUSH_INTERVAL_MS: 5000,
} as const;
