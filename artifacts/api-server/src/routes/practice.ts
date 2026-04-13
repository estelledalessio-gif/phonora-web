import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, practiceAttemptsTable, savedTextsTable } from "@workspace/db";
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

router.get("/practice/attempts", authenticate, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const params = ListPracticeAttemptsQueryParams.safeParse(req.query);
  const limit = params.success && params.data.limit != null ? params.data.limit : 50;
  const offset = params.success && params.data.offset != null ? params.data.offset : 0;

  const attempts = await db
    .select()
    .from(practiceAttemptsTable)
    .where(eq(practiceAttemptsTable.userId, userId))
    .orderBy(desc(practiceAttemptsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(ListPracticeAttemptsResponse.parse(attempts.map(mapAttempt)));
});

router.post("/practice/attempts", authenticate, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const parsed = CreatePracticeAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [attempt] = await db
    .insert(practiceAttemptsTable)
    .values({
      userId,
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

  res.status(201).json(GetPracticeAttemptResponse.parse(mapAttempt(attempt)));
});

router.get("/practice/attempts/:id", authenticate, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPracticeAttemptParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = (req as typeof req & { userId: string }).userId;
  const [attempt] = await db
    .select()
    .from(practiceAttemptsTable)
    .where(eq(practiceAttemptsTable.id, params.data.id));

  if (!attempt || attempt.userId !== userId) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  res.json(GetPracticeAttemptResponse.parse(mapAttempt(attempt)));
});

router.get("/practice/saved-texts", authenticate, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const texts = await db
    .select()
    .from(savedTextsTable)
    .where(eq(savedTextsTable.userId, userId))
    .orderBy(desc(savedTextsTable.createdAt));
  res.json(ListSavedTextsResponse.parse(texts));
});

router.post("/practice/saved-texts", authenticate, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const parsed = CreateSavedTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [text] = await db
    .insert(savedTextsTable)
    .values({ userId, ...parsed.data })
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
  const userId = (req as typeof req & { userId: string }).userId;
  const [deleted] = await db
    .delete(savedTextsTable)
    .where(eq(savedTextsTable.id, params.data.id))
    .returning();
  if (!deleted || deleted.userId !== userId) {
    res.status(404).json({ error: "Text not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
