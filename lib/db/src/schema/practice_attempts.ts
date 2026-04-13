import { pgTable, text, serial, integer, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const practiceAttemptsTable = pgTable("practice_attempts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  practiceText: text("practice_text").notNull(),
  practiceType: text("practice_type").notNull(),
  overallScore: numeric("overall_score"),
  accuracyScore: numeric("accuracy_score"),
  fluencyScore: numeric("fluency_score"),
  completenessScore: numeric("completeness_score"),
  transcript: text("transcript"),
  likelySubstitutions: jsonb("likely_substitutions").notNull().default([]),
  phonemeFeedback: jsonb("phoneme_feedback").notNull().default([]),
  articulatoryTips: text("articulatory_tips").array().notNull().default([]),
  ipaBreakdown: text("ipa_breakdown"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPracticeAttemptSchema = createInsertSchema(practiceAttemptsTable).omit({ id: true, createdAt: true });
export type InsertPracticeAttempt = z.infer<typeof insertPracticeAttemptSchema>;
export type PracticeAttempt = typeof practiceAttemptsTable.$inferSelect;
