import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  index,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

/** Type de séance normalisé (strict) */
export const SESSION_TYPES = ["CM", "TD", "TP", "AUTRE"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const REVISION_LEVELS = ["none", "low", "medium", "high", "custom"] as const;
export type RevisionLevel = (typeof REVISION_LEVELS)[number];

export const EVENT_KINDS = ["devoir", "exercice", "projet", "rendu", "autre"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const courses = sqliteTable(
  "courses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#6366f1"),
    source: text("source", { enum: ["celcat", "manual"] }).notNull().default("manual"),
    memo: text("memo").notNull().default(""),
    /** code module Celcat (ex: DIDB1OPL(DI01C1-260)) : identifiant stable de la matière */
    code: text("code"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("courses_slug_idx").on(t.slug), index("courses_code_idx").on(t.code)],
);

export const courseLinks = sqliteTable(
  "course_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("course_links_course_idx").on(t.courseId)],
);

export const folders = sqliteTable(
  "folders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    parentId: integer("parent_id").references((): AnySQLiteColumn => folders.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("folders_course_idx").on(t.courseId), index("folders_parent_idx").on(t.parentId)],
);

export const files = sqliteTable(
  "files",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    folderId: integer("folder_id").references(() => folders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    storedName: text("stored_name").notNull(),
    mimeType: text("mime_type").notNull().default("application/octet-stream"),
    size: integer("size").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("files_course_idx").on(t.courseId), index("files_folder_idx").on(t.folderId)],
);

export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    folderId: integer("folder_id").references(() => folders.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("notes_course_idx").on(t.courseId), index("notes_folder_idx").on(t.folderId)],
);

export const celcatEvents = sqliteTable(
  "celcat_events",
  {
    /** identifiant Celcat (ou mock-…) */
    id: text("id").primaryKey(),
    courseId: integer("course_id").references(() => courses.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    rawSubject: text("raw_subject").notNull().default(""),
    sessionType: text("session_type", { enum: SESSION_TYPES }).notNull().default("AUTRE"),
    code: text("code").notNull().default(""),
    cancelled: integer("cancelled", { mode: "boolean" }).notNull().default(false),
    category: text("category").notNull().default(""),
    start: integer("start", { mode: "timestamp_ms" }).notNull(),
    end: integer("end", { mode: "timestamp_ms" }).notNull(),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    room: text("room").notNull().default(""),
    teacher: text("teacher").notNull().default(""),
    groups: text("groups").notNull().default(""),
    rawDescription: text("raw_description").notNull().default(""),
    color: text("color"),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("celcat_events_start_idx").on(t.start),
    index("celcat_events_course_idx").on(t.courseId, t.sessionType, t.start),
  ],
);

export const exams = sqliteTable(
  "exams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(120),
    location: text("location").notNull().default(""),
    revisionLevel: text("revision_level", { enum: REVISION_LEVELS }).notNull().default("medium"),
    revisionPercent: integer("revision_percent").notNull().default(50),
    notes: text("notes").notNull().default(""),
    /** épreuve Celcat d'origine (import automatique) */
    celcatEventId: text("celcat_event_id"),
    createdAt: createdAt(),
  },
  (t) => [index("exams_starts_idx").on(t.startsAt), index("exams_celcat_idx").on(t.celcatEventId)],
);

export const revisionSessions = sqliteTable(
  "revision_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    examId: integer("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** jour local YYYY-MM-DD */
    date: text("date").notNull(),
    /** heure locale HH:mm (optionnelle) */
    startTime: text("start_time"),
    durationMinutes: integer("duration_minutes").notNull().default(90),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    doneAt: integer("done_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("revision_sessions_date_idx").on(t.date), index("revision_sessions_exam_idx").on(t.examId)],
);

export const customEvents = sqliteTable(
  "custom_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id").references(() => courses.id, { onDelete: "set null" }),
    kind: text("kind", { enum: EVENT_KINDS }).notNull().default("devoir"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    /** créneau Celcat auquel l'événement a été rattaché (pas de FK : les événements Celcat sont resynchronisés) */
    linkedCelcatEventId: text("linked_celcat_event_id"),
    linkedSessionType: text("linked_session_type", { enum: SESSION_TYPES }),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("custom_events_starts_idx").on(t.startsAt)],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Course = typeof courses.$inferSelect;
export type CourseLink = typeof courseLinks.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type CelcatEvent = typeof celcatEvents.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type RevisionSession = typeof revisionSessions.$inferSelect;
export type CustomEvent = typeof customEvents.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
