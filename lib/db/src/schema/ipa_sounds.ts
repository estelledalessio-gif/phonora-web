import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ipaSoundsTable = pgTable("ipa_sounds", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  articulationGuide: text("articulation_guide").notNull(),
  exampleWords: text("example_words").array().notNull().default([]),
  minimialPairs: text("minimal_pairs").array().notNull().default([]),
  difficulty: text("difficulty").notNull().default("intermediate"),
  audioUrl: text("audio_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIpaSoundSchema = createInsertSchema(ipaSoundsTable).omit({ id: true, createdAt: true });
export type InsertIpaSound = z.infer<typeof insertIpaSoundSchema>;
export type IpaSound = typeof ipaSoundsTable.$inferSelect;
