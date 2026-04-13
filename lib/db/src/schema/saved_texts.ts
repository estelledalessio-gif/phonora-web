import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savedTextsTable = pgTable("saved_texts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
  text: text("text").notNull(),
  practiceType: text("practice_type").notNull().default("sentence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSavedTextSchema = createInsertSchema(savedTextsTable).omit({ id: true, createdAt: true });
export type InsertSavedText = z.infer<typeof insertSavedTextSchema>;
export type SavedText = typeof savedTextsTable.$inferSelect;
