import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, practiceAttemptsTable, savedTextsTable, dailyActivityTable, profilesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import {
  ListPracticeAttemptsQueryParams,
  ListPracticeAttemptsResponse,
  CreatePracticeAttemptBody,
  GetPracticeAttemptParams,
  GetPracticeAttemptResponse,
  ListSavedTextsResponse,
  CreateSavedTextBody,
  DeleteSavedTextParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function mapAttempt(a: typeof practiceAttemptsTable.$inferSelect) {
  return {
    ...a,
    overallScore: a.overallScore != null ? Number(a.overallScore) : null,
    accuracyScore: a.accuracyScore != null ? Number(a.accuracyScore) : null,
    fluencyScore: a.fluencyScore != null ? Number(a.fluencyScore) : null,
    completenessScore: a.completenessScore != null ? Number(a.completenessScore) : null,
    likelySubstitutions: Array.isArray(a.likelySubstitutions) ? a.likelySubstitutions : [],
    phonemeFeedback: Array.isArray(a.phonemeFeedback) ? a.phonemeFeedback : [],
    articulatoryTips: a.articulatoryTips ?? [],
  };
}

async function upsertDailyActivity(userId: string, score: number | null): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const [existing] = await db
    .select()
    .from(dailyActivityTable)
    .where(and(eq(dailyActivityTable.userId, userId), eq(dailyActivityTable.date, today)));

  if (existing) {
    const newCount = existing.count + 1;
    const prevAvg = existing.avgScore != null ? Number(existing.avgScore) : null;
    let newAvg: string | null = null;
    if (score != null) {
      newAvg = prevAvg != null
        ? String(((prevAvg * (newCount - 1)) + score) / newCount)
        : String(score);
    } else {
      newAvg = prevAvg != null ? String(prevAvg) : null;
    }
    await db
      .update(dailyActivityTable)
      .set({ count: newCount, avgScore: newAvg })
      .where(eq(dailyActivityTable.id, existing.id));
  } else {
    await db.insert(dailyActivityTable).values({
      userId,
      date: today,
      count: 1,
      avgScore: score != null ? String(score) : null,
    });
  }

  // Recalculate streak and increment total attempts on profile
  const allActivity = await db
    .select({ date: dailyActivityTable.date })
    .from(dailyActivityTable)
    .where(eq(dailyActivityTable.userId, userId))
    .orderBy(desc(dailyActivityTable.date));

  let streak = 0;
  const now = new Date();
  for (let i = 0; i < allActivity.length; i++) {
    const actDate = new Date(allActivity[i].date);
    const expected = new Date(now);
    expected.setDate(expected.getDate() - i);
    const actDateStr = actDate.toISOString().split("T")[0];
    const expectedStr = expected.toISOString().split("T")[0];
    if (actDateStr === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  await db
    .update(profilesTable)
    .set({
      streakDays: streak,
      totalAttempts: sql`${profilesTable.totalAttempts} + 1`,
    })
    .where(eq(profilesTable.userId, userId));
}

router.get("/practice/attempts", authenticate, async (req, res): Promise<void> => {
  const params = ListPracticeAttemptsQueryParams.safeParse(req.query);
  const limit = params.success && params.data.limit != null ? params.data.limit : 50;
  const offset = params.success && params.data.offset != null ? params.data.offset : 0;

  const attempts = await db
    .select()
    .from(practiceAttemptsTable)
    .where(eq(practiceAttemptsTable.userId, req.userId))
    .orderBy(desc(practiceAttemptsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(ListPracticeAttemptsResponse.parse(attempts.map(mapAttempt)));
});

router.post("/practice/attempts", authenticate, async (req, res): Promise<void> => {
  const parsed = CreatePracticeAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [attempt] = await db
    .insert(practiceAttemptsTable)
    .values({
      userId: req.userId,
      practiceText: parsed.data.practiceText,
      practiceType: parsed.data.practiceType,
      overallScore: parsed.data.overallScore != null ? String(parsed.data.overallScore) : null,
      accuracyScore: parsed.data.accuracyScore != null ? String(parsed.data.accuracyScore) : null,
      fluencyScore: parsed.data.fluencyScore != null ? String(parsed.data.fluencyScore) : null,
      completenessScore: parsed.data.completenessScore != null ? String(parsed.data.completenessScore) : null,
      transcript: parsed.data.transcript ?? null,
      likelySubstitutions: parsed.data.likelySubstitutions,
      phonemeFeedback: parsed.data.phonemeFeedback,
      articulatoryTips: parsed.data.articulatoryTips,
      ipaBreakdown: parsed.data.ipaBreakdown ?? null,
      durationMs: parsed.data.durationMs ?? null,
    })
    .returning();

  // Upsert daily activity and update streak (fire-and-forget but await to keep data consistent)
  await upsertDailyActivity(req.userId, parsed.data.overallScore ?? null);

  res.status(201).json(GetPracticeAttemptResponse.parse(mapAttempt(attempt)));
});

router.get("/practice/attempts/:id", authenticate, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPracticeAttemptParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [attempt] = await db
    .select()
    .from(practiceAttemptsTable)
    .where(eq(practiceAttemptsTable.id, params.data.id));

  if (!attempt || attempt.userId !== req.userId) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  res.json(GetPracticeAttemptResponse.parse(mapAttempt(attempt)));
});

router.get("/practice/saved-texts", authenticate, async (req, res): Promise<void> => {
  const texts = await db
    .select()
    .from(savedTextsTable)
    .where(eq(savedTextsTable.userId, req.userId))
    .orderBy(desc(savedTextsTable.createdAt));
  res.json(ListSavedTextsResponse.parse(texts));
});

router.post("/practice/saved-texts", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateSavedTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [text] = await db
    .insert(savedTextsTable)
    .values({ userId: req.userId, ...parsed.data })
    .returning();
  res.status(201).json(text);
});

router.delete("/practice/saved-texts/:id", authenticate, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteSavedTextParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(savedTextsTable)
    .where(and(eq(savedTextsTable.id, params.data.id), eq(savedTextsTable.userId, req.userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Text not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
