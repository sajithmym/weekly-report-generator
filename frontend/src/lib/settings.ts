// ─── Frontend Settings ──────────────────────────────────────
// All configuration values are centralized here.
// Environment variables take priority; these are fallback defaults.

// ─── Application ───────────────────────────────────────────
export const APP_SETTINGS = {
  name: 'Weekly Report Generator',
  description: 'Internal team weekly report and dashboard application',
  memberPanelTitle: 'Weekly Reports',
  managerPanelTitle: 'Manager Panel',
  language: 'en',
  locale: 'en-US',
  timezone: process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Asia/Colombo',
} as const;

// ─── Roles and Route Access ────────────────────────────────
// Frontend navigation uses these values for display and redirects.
// The backend remains the authority that enforces permissions on every API request.
export const USER_ROLES = {
  TEAM_MEMBER: 'TEAM_MEMBER',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ROUTES = {
  login: '/login',
  register: '/register',
  memberDashboard: '/dashboard',
  newReport: '/reports/new',
  reportHistory: '/reports/history',
  reportDetail: (id: string) => `/reports/${id}`,
  reportEdit: (id: string) => `/reports/${id}/edit`,
  managerDashboard: '/manager/dashboard',
  managerReports: '/manager/reports',
  managerUsers: '/manager/users',
  managerProjects: '/manager/projects',
} as const;

export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  [USER_ROLES.TEAM_MEMBER]: ROUTES.memberDashboard,
  [USER_ROLES.MANAGER]: ROUTES.managerDashboard,
  [USER_ROLES.ADMIN]: ROUTES.managerDashboard,
};

export function getRoleHomeRoute(role: UserRole): string {
  return ROLE_HOME_ROUTES[role];
}

// ─── UI, Theme and Experience ──────────────────────────────
// Change these HSL values to rebrand the application without searching through components.
export const UI_SETTINGS = {
  theme: {
    // HSL format: 'hue saturation% lightness%'. 210 40% 98% is a very light blue-grey.
    background: '210 40% 98%', // Main page background behind all content.
    foreground: '222 47% 11%', // Default dark text color for readable body content.
    card: '0 0% 100%', // White surface used by cards, tables, and panels.
    cardForeground: '222 47% 11%', // Default text color displayed inside cards.
    popover: '0 0% 100%', // Background for dialogs, menus, and popovers.
    popoverForeground: '222 47% 11%', // Text color for dialogs, menus, and popovers.
    primary: '217 91% 42%', // Main brand blue for primary buttons and active navigation.
    primaryForeground: '0 0% 100%', // Text/icon color placed on the primary blue.
    secondary: '214 95% 96%', // Soft blue surface for secondary buttons and sections.
    secondaryForeground: '222 47% 11%', // Text/icon color placed on secondary surfaces.
    muted: '210 40% 96%', // Low-emphasis background for disabled or subtle UI areas.
    mutedForeground: '215 16% 42%', // Supporting text color, such as descriptions and metadata.
    accent: '214 95% 96%', // Hover and selected background for non-primary controls.
    accentForeground: '217 75% 28%', // Text/icon color when an accent background is active.
    destructive: '0 72% 51%', // Red used for destructive actions, validation errors, and alerts.
    destructiveForeground: '0 0% 100%', // Text/icon color placed on destructive red actions.
    border: '214 32% 90%', // Subtle border color separating cards, inputs, and sections.
    input: '214 32% 88%', // Input border color in its default state.
    ring: '217 91% 55%', // Keyboard focus outline color for accessible navigation.
    radius: '0.75rem', // Corner roundness used by cards, buttons, inputs, and dialogs.
  },
  layout: {
    sidebarWidth: '16rem', // Desktop sidebar width; increase for longer navigation labels.
    contentMaxWidth: '1400px', // Recommended maximum content width for future centered layouts.
  },
  motion: {
    transitionMs: 200, // Standard animation duration in milliseconds (200ms feels responsive).
    reduceMotion: false, // Set true when adding reduced-motion behavior for sensitive users.
  },
  toast: {
    durationMs: 5000, // Time in milliseconds before a toast notification closes automatically.
    maxVisible: 4, // Maximum number of toast notifications shown at the same time.
  },
} as const;

// Values consumed by the root layout. Keep this mapping here so theme changes stay centralized.
export const THEME_CSS_VARIABLES = {
  '--background': UI_SETTINGS.theme.background,
  '--foreground': UI_SETTINGS.theme.foreground,
  '--card': UI_SETTINGS.theme.card,
  '--card-foreground': UI_SETTINGS.theme.cardForeground,
  '--popover': UI_SETTINGS.theme.popover,
  '--popover-foreground': UI_SETTINGS.theme.popoverForeground,
  '--primary': UI_SETTINGS.theme.primary,
  '--primary-foreground': UI_SETTINGS.theme.primaryForeground,
  '--secondary': UI_SETTINGS.theme.secondary,
  '--secondary-foreground': UI_SETTINGS.theme.secondaryForeground,
  '--muted': UI_SETTINGS.theme.muted,
  '--muted-foreground': UI_SETTINGS.theme.mutedForeground,
  '--accent': UI_SETTINGS.theme.accent,
  '--accent-foreground': UI_SETTINGS.theme.accentForeground,
  '--destructive': UI_SETTINGS.theme.destructive,
  '--destructive-foreground': UI_SETTINGS.theme.destructiveForeground,
  '--border': UI_SETTINGS.theme.border,
  '--input': UI_SETTINGS.theme.input,
  '--ring': UI_SETTINGS.theme.ring,
  '--radius': UI_SETTINGS.theme.radius,
} as const;

// ─── Charts ────────────────────────────────────────────────
export const CHART_SETTINGS = {
  palette: ['#2563eb', '#0f766e', '#d97706', '#ea580c', '#7c3aed'] as const,
  taskTotal: '#6366f1',
  taskCompleted: '#16a34a',
  projectReports: '#6366f1',
  projectMinutes: '#d97706',
  height: 300,
  pieOuterRadius: 100,
} as const;

export const DASHBOARD_SETTINGS = {
  taskTrendWeeks: 8,
  recentActivityLimit: 10,
} as const;

// ─── Feature Flags ─────────────────────────────────────────
// Use these for safe, gradual rollout of optional frontend features.
export const FEATURE_FLAGS = {
  projectManagement: true,
  userManagement: true,
  reportVersionHistory: true,
  dashboardCharts: true,
} as const;

// ─── API ────────────────────────────────────────────────────
export const API_SETTINGS = {
  baseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1',
  authEndpoints: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    currentUser: '/auth/me',
  },
} as const;

// ─── Pagination ─────────────────────────────────────────────
export const PAGINATION_SETTINGS = {
  defaultPage: 1,
  defaultLimit: 20,
  dashboardLimit: 10,
  historyLimit: 50,
  managerListLimit: 50,
  pageSizeOptions: [10, 20, 50, 100] as const,
} as const;

// ─── Reporting workflow ──────────────────────────────────
// These values mirror the backend validation rules. Keep client validation
// helpful, but treat the backend as the authority for enforcement.
export const REPORT_SETTINGS = {
  defaultTaskPriority: 'MEDIUM',
  defaultTaskStatus: 'TODO',
  defaultWorkHourType: 'DEVELOPMENT',
  defaultNumericValue: 0,
  taskSectionTitle: 'Tasks and progress',
  submissionGuidance: 'A project and at least one named task are required to save a report; unfinished tasks are allowed.',
  minTasksForSubmission: 1,
  maxItemsPerSection: 50,
  taskPriorities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const,
  taskStatuses: ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const,
  workHourTypes: [
    'DEVELOPMENT',
    'TESTING',
    'MEETINGS',
    'DOCUMENTATION',
    'OTHER',
  ] as const,
  rosterStatuses: [
    'ALL',
    'NOT_STARTED',
    'DRAFT',
    'SUBMITTED',
    'NEEDS_CORRECTION',
    'APPROVED',
    'PENDING',
    'LATE',
  ] as const,
  calendar: {
    millisecondsPerDay: 86_400_000,
    finalDayOffset: 6,
  },
} as const;

// ─── Auth ───────────────────────────────────────────────────
export const AUTH_SETTINGS = {
  // Access tokens remain only in module memory. Refresh tokens are HttpOnly cookies,
  // so browser JavaScript cannot read or exfiltrate them.
  accessTokenStorage: 'memory',
  refreshTokenStorage: 'httpOnly-cookie',
  csrfHeaderName: 'X-Requested-With',
  csrfHeaderValue: 'weekly-report-web',
} as const;

// ─── Validation ─────────────────────────────────────────────
export const VALIDATION_SETTINGS = {
  requiredText: { min: 1 },
  name: { min: 2, max: 100 },
  email: { max: 255 },
  password: { min: 8, max: 128 },
  projectName: { min: 2, max: 200 },
  projectDescription: { max: 1000 },
  taskName: { min: 1, max: 500 },
  description: { min: 1, max: 500 },
  deliverable: { max: 500 },
  reportNotes: { max: 2000 },
  percentage: { min: 0, max: 100 },
  minutes: { min: 0, max: 10_080 },
  sortOrder: { min: 0 },
  datePattern: /^\d{4}-\d{2}-\d{2}$/,
} as const;
