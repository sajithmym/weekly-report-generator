import "dotenv/config";
import ms = require("ms");

const refreshLifetime = ms(
  (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as ms.StringValue,
);
if (!Number.isFinite(refreshLifetime) || refreshLifetime < 1000)
  throw new Error(
    "JWT_REFRESH_EXPIRES_IN must be a positive duration of at least one second.",
  );

// ─── Backend Settings ───────────────────────────────────────
// All configuration values are centralized here.
// Environment variables take priority; these are fallback defaults.

import { ReportStatus } from "./common/enums/report-status.enum";
import { UserRole } from "./common/enums/user-role.enum";

// ─── Database ───────────────────────────────────────────────
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || "5432";
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASSWORD = process.env.DB_PASSWORD || "postgres";
const DB_NAME = process.env.DB_NAME || "weekly_report_db";
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const SERVER_PORT = parseInt(process.env.PORT || "5000", 10);
const COOKIE_SAME_SITE =
  process.env.AUTH_COOKIE_SAME_SITE || (IS_PRODUCTION ? "none" : "lax");

if (!["lax", "strict", "none"].includes(COOKIE_SAME_SITE)) {
  throw new Error("AUTH_COOKIE_SAME_SITE must be lax, strict, or none.");
}

export const DB_SETTINGS = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  name: DB_NAME,
  /** Full connection string — built from individual fields if DATABASE_URL is missing */
  url:
    process.env.DATABASE_URL?.replace(
      /\$\{(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)\}/g,
      (_match, key: string) => {
        const values: Record<string, string> = {
          DB_HOST,
          DB_PORT,
          DB_USER,
          DB_PASSWORD,
          DB_NAME,
        };
        return ["DB_USER", "DB_PASSWORD", "DB_NAME"].includes(key)
          ? encodeURIComponent(values[key])
          : values[key];
      },
    ) ||
    `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${encodeURIComponent(DB_NAME)}`,
} as const;

process.env.DATABASE_URL = DB_SETTINGS.url;

// ─── Server ─────────────────────────────────────────────────
export const SERVER_SETTINGS = {
  port: SERVER_PORT,
  publicUrl: process.env.PUBLIC_API_URL || `http://localhost:${SERVER_PORT}`,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  apiPrefix: "api/v1",
  nodeEnv: NODE_ENV,
  cors: {
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  apiRateLimit: {
    ttlMilliseconds: 60_000,
    maxRequests: 100,
  },
} as const;

// ─── JWT / Auth ─────────────────────────────────────────────
export const AUTH_SETTINGS = {
  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-in-production",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-in-production",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  passwordHashRounds: 12,
  refreshCookieName: "weekly_report_refresh_token",
  csrfHeaderName: "x-requested-with",
  csrfHeaderValue: "weekly-report-web",
  refreshCookie: {
    httpOnly: true,
    secure: IS_PRODUCTION || COOKIE_SAME_SITE === "none",
    sameSite: COOKIE_SAME_SITE as "lax" | "strict" | "none",
    path: "/api/v1/auth",
    maxAge: refreshLifetime,
  },
  allowSelfRegistration:
    process.env.ALLOW_SELF_REGISTRATION === undefined
      ? !IS_PRODUCTION
      : process.env.ALLOW_SELF_REGISTRATION === "true",
  authRateLimit: {
    ttlMilliseconds: 60_000,
    loginAttempts: 5,
    registrationAttempts: 3,
    refreshAttempts: 20,
  },
  messages: {
    invalidCredentials: "Invalid credentials",
    accountDeactivated: "Account is deactivated",
    invalidRefreshToken: "Invalid refresh token",
    expiredRefreshToken: "Refresh token expired",
    usedRefreshToken: "Refresh token has already been used",
    userNotFoundOrInactive: "User not found or inactive",
    emailAlreadyRegistered: "Email already registered",
    selfRegistrationDisabled: "Self-registration is not available.",
    refreshTokenMissing: "Refresh token is missing.",
    invalidBrowserRequest: "Invalid browser request.",
  },
} as const;

// ─── Domain Defaults and Workflow ──────────────────────────
// Database states belong to enums; these settings define application behavior around them.
export const REPORT_SETTINGS = {
  defaultTaskPriority: "MEDIUM",
  defaultTaskStatus: "TODO",
  defaultNumericValue: 0,
  defaultSortOrder: 0,
  maxItemsPerSection: 50,
  minTasksForSubmission: 1,
  taskPriorities: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  taskStatuses: ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"],
  workHourTypes: [
    "DEVELOPMENT",
    "TESTING",
    "MEETINGS",
    "DOCUMENTATION",
    "OTHER",
  ],
  rosterStatuses: [
    "DRAFT",
    "SUBMITTED",
    "NEEDS_CORRECTION",
    "APPROVED",
    "NOT_STARTED",
    "LATE",
    "PENDING",
  ],
  rosterStates: {
    notStarted: "NOT_STARTED",
    late: "LATE",
    pending: "PENDING",
  },
  calendar: {
    millisecondsPerDay: 86_400_000,
    daysPerWeek: 7,
    finalDayOffset: 6,
    maxSelectableWeeks: 52,
  },
  editableStatuses: [
    ReportStatus.DRAFT,
    ReportStatus.NEEDS_CORRECTION,
  ] as const,
  messages: {
    invalidWeekRange: "Week end must be after or equal to week start",
    invalidReportingDate: "Invalid reporting date.",
    invalidReportingWeek:
      "Reports must cover Monday through Sunday using date-only values.",
    reportingRangeTooLarge:
      "Choose an ordered reporting range of at most 52 weeks.",
    projectNotFound: "Project not found",
    inactiveProject: "Project is deactivated and cannot be used",
    reportNotFound: "Report not found",
    reportAccessDenied: "You do not have access to this report",
    reportOwnershipDenied: "You can only edit your own reports",
    reportReadOnly: "Report is not editable in current status",
    reportMustBeSubmitted: "Report is not in SUBMITTED status",
    reportAlreadyExists: "A weekly report already exists for this week.",
    reportRequiresTask: "Add at least one named task before submitting.",
    projectRequired: "Select a project before saving the report.",
    projectRequiredForSubmission: "Select a project before submitting.",
    blankTaskName: "Task names cannot be blank.",
    cannotSubmitInStatus: (status: ReportStatus) =>
      `Cannot submit report in ${status} status`,
    onlyOneKeyIssue: "Only one blocker can be marked as the key issue",
    onlyOneKeyAchievement:
      "Only one achievement can be marked as the key achievement",
    commentRequired: "Comment is required when requesting changes",
  },
} as const;

export const PROJECT_SETTINGS = {
  messages: {
    notFound: "Project not found",
  },
} as const;

export const USER_SETTINGS = {
  defaultRole: UserRole.TEAM_MEMBER,
  messages: {
    notFound: "User not found",
    cannotChangeOwnRole: "You cannot change your own role",
    cannotChangeOwnStatus: "You cannot change your own account status",
  },
} as const;

// ─── API Response Messages ─────────────────────────────────
// Centralized so response copy can be kept consistent or later moved to i18n.
export const API_RESPONSE_MESSAGES = {
  auth: {
    registered: "Account created. An administrator must activate it before sign-in.",
    loggedIn: "Logged in successfully",
    refreshed: "Tokens refreshed successfully",
    loggedOut: "Logged out successfully",
    userFetched: "User fetched successfully",
  },
  users: {
    fetched: "Users fetched successfully",
    created: "User created successfully",
    userFetched: "User fetched successfully",
    roleUpdated: "User role updated successfully",
    statusUpdated: "User status updated successfully",
  },
  projects: {
    fetched: "Projects fetched successfully",
    projectFetched: "Project fetched successfully",
    created: "Project created successfully",
    updated: "Project updated successfully",
    deactivated: "Project deactivated successfully",
  },
  reports: {
    created: "Report created successfully",
    fetched: "Reports fetched successfully",
    reportFetched: "Report fetched successfully",
    updated: "Report updated successfully",
    submitted: "Report submitted successfully",
    versionHistoryFetched: "Version history fetched successfully",
    changesRequested: "Changes requested successfully",
    approved: "Report approved successfully",
  },
  dashboard: {
    summaryFetched: "Summary fetched successfully",
    statusDistributionFetched: "Status distribution fetched successfully",
    taskTrendsFetched: "Task trends fetched successfully",
    projectWorkloadFetched: "Project workload fetched successfully",
    timeDistributionFetched: "Time distribution fetched successfully",
    recentActivityFetched: "Recent activity fetched successfully",
  },
} as const;

// ─── Pagination ─────────────────────────────────────────────
export const PAGINATION_SETTINGS = {
  defaultPage: 1,
  defaultLimit: 20,
  maxLimit: 100,
} as const;

// ─── Dashboard ──────────────────────────────────────────────
export const DASHBOARD_SETTINGS = {
  defaultTaskTrendWeeks: 8,
  defaultActivityLimit: 20,
  firstSubmissionLimit: 1,
  completedTaskStatus: "DONE",
  messages: {
    invalidDateRange: "Week end must be after or equal to week start",
  },
} as const;

// ─── Validation Limits ──────────────────────────────────────
export const VALIDATION_SETTINGS = {
  name: { min: 2, max: 100 },
  email: { max: 255 },
  password: { min: 8, max: 128 },
  search: { max: 200 },
  taskName: { min: 1, max: 500 },
  description: { min: 1, max: 500 },
  deliverable: { max: 500 },
  projectDescription: { max: 1000 },
  projectName: { min: 2, max: 200 },
  reportNotes: { max: 2000 },
  percentage: { min: 0, max: 100 },
  minutes: { min: 0, max: 10_080 },
  sortOrder: { min: 0 },
  datePattern: /^\d{4}-\d{2}-\d{2}$/,
  reviewCommentRequired: true,
} as const;

/** Fail fast rather than launching a production service with development credentials. */
export function validateRuntimeConfiguration() {
  if (!IS_PRODUCTION) return;

  const insecureValues = new Set([
    "dev-access-secret-change-in-production",
    "dev-refresh-secret-change-in-production",
    "change-me-to-a-random-access-secret",
    "change-me-to-a-random-refresh-secret",
  ]);
  const missingOrInsecureSecrets =
    !process.env.JWT_ACCESS_SECRET ||
    !process.env.JWT_REFRESH_SECRET ||
    insecureValues.has(process.env.JWT_ACCESS_SECRET) ||
    insecureValues.has(process.env.JWT_REFRESH_SECRET) ||
    process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_ACCESS_SECRET.length < 32 ||
    process.env.JWT_REFRESH_SECRET.length < 32;

  if (missingOrInsecureSecrets) {
    throw new Error(
      "Production requires distinct JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values of at least 32 characters.",
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("Production requires DATABASE_URL.");
  }

  if (
    AUTH_SETTINGS.refreshCookie.sameSite === "none" &&
    !AUTH_SETTINGS.refreshCookie.secure
  ) {
    throw new Error("Cross-site refresh cookies require the Secure attribute.");
  }
}

// ─── Seed Data ──────────────────────────────────────────────
export const SEED_SETTINGS = {
  defaultPassword: "password123",
  manager: {
    name: "Sarah Fernando",
    email: "sarah@example.com",
  },
  members: [
    { name: "Kasun Silva", email: "kasun@example.com" },
    { name: "Ayesha Perera", email: "ayesha@example.com" },
    { name: "Mohamed Rizwan", email: "mohamed@example.com" },
    { name: "Nimal Jayasinghe", email: "nimal@example.com" },
  ],
  projects: [
    { name: "Client Portal", description: "Client-facing web portal" },
    {
      name: "Internal ERP",
      description: "Internal enterprise resource planning system",
    },
    { name: "Mobile Application", description: "Cross-platform mobile app" },
    {
      name: "Research & Development",
      description: "R&D projects and experiments",
    },
  ],
  weeksToSeed: 4,
  seedTasks: [
    {
      taskName: "Feature development",
      priority: "HIGH",
      plannedPercentage: 60,
      actualPercentage: 55,
      status: "DONE",
      plannedMinutes: 480,
      actualMinutes: 440,
      deliverable: "Implemented feature X",
    },
    {
      taskName: "Code review",
      priority: "MEDIUM",
      plannedPercentage: 20,
      actualPercentage: 25,
      status: "DONE",
      plannedMinutes: 160,
      actualMinutes: 200,
    },
    {
      taskName: "Bug fixes",
      priority: "LOW",
      plannedPercentage: 20,
      actualPercentage: 20,
      status: "IN_PROGRESS",
      plannedMinutes: 160,
      actualMinutes: 160,
    },
  ],
  seedNextWeekTasks: [
    { description: "Continue feature development", sortOrder: 0 },
    { description: "Write unit tests", sortOrder: 1 },
    { description: "Update documentation", sortOrder: 2 },
  ],
  seedWorkHours: [
    { type: "DEVELOPMENT", minutes: 480 },
    { type: "TESTING", minutes: 120 },
    { type: "MEETINGS", minutes: 60 },
    { type: "DOCUMENTATION", minutes: 60 },
  ],
} as const;
