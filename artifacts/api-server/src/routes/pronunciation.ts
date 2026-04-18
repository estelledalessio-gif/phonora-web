import { Router, type IRouter } from "express";
import multer from "multer";
import { desc, and, eq, sql } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { logger } from "../lib/logger";
import { db, practiceAttemptsTable, profilesTable, dailyActivityTable } from "@workspace/db";
import { assessWithAzure, PronunciationResult } from "../lib/azureSpeech";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Mock fallback (used when Azure credentials are absent) ───────────────────

function buildMockResult(referenceText: string): PronunciationResult {
  const words = referenceText.trim().split(/\s+/).filter(Boolean);

  const phonemeFeedback = words.slice(0, 4).map((word) => {
    const isStruggling = Math.random() > 0.55;
    return {
      phoneme: word.slice(0, 2).toLowerCase(),
      status: (isStruggling ? "needs_work" : "good") as "good" | "fair" | "needs_work",
      tip: isStruggling
        ? `Focus on the opening sound of "${word}" — slow down slightly and let the airflow remain steady.`
        : `Good production of the sound in "${word}". Keep it up.`,
    };
  });

  const likelySubstitutions: PronunciationResult["likelySubstitutions"] = [];
  if (words.some((w) => /^th/i.test(w))) {
    likelySubstitutions.push({ target: "θ", produced: "s", position: "word-initial" });
  }

  return {
    overallScore: Math.round(75 + Math.random() * 15),
    accuracyScore: Math.round(72 + Math.random() * 18),
    fluencyScore: Math.round(78 + Math.random() * 14),
    completenessScore: Math.round(80 + Math.random() * 15),
    transcript: referenceText,
    likelySubstitutions,
    phonemeFeedback,
    articulatoryTips: [
      "Work on smooth word linking — connected speech sounds more natural when words blend together.",
      "On stressed syllables, aspirate /p/, /t/, /k/ with a light puff of air.",
      "Reduce tension throughout the phrase and let the airflow continue steadily.",
    ],
  };
}

// ─── Daily activity + streak helpers ─────────────────────────────────────────

async function upsertDailyActivity(userId: string, score: number | null): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const [existing] = await db
    .select()
    .from(dailyActivityTable)
    .where(and(eq(dailyActivityTable.userId, userId), eq(dailyActivityTable.date, today)));

  if (existing) {
    const newCount = existing.count + 1;
    const prevAvg = existing.avgScore != null ? Number(existing.avgScore) : null;
    const newAvg =
      score != null
        ? String(prevAvg != null ? (prevAvg * (newCount - 1) + score) / newCount : score)
        : prevAvg != null ? String(prevAvg) : null;
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

  // Recalculate streak
  const allActivity = await db
    .select({ date: dailyActivityTable.date })
    .from(dailyActivityTable)
    .where(eq(dailyActivityTable.userId, userId))
    .orderBy(desc(dailyActivityTable.date));

  let streak = 0;
  const now = new Date();
  for (let i = 0; i < allActivity.length; i++) {
    const actDateStr =
      typeof allActivity[i].date === "string"
        ? allActivity[i].date
        : (allActivity[i].date as unknown as Date).toISOString().split("T")[0];
    const expected = new Date(now);
    expected.setDate(expected.getDate() - i);
    if (actDateStr === expected.toISOString().split("T")[0]) {
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

// ─── Route ────────────────────────────────────────────────────────────────────

router.post(
  "/pronunciation",
  authenticate,
  upload.single("audio"),
  async (req, res): Promise<void> => {
    const referenceText = (req.body.referenceText as string)?.trim();
    const mode = ((req.body.mode as string) || "sentence").trim();

    if (!referenceText) {
      res.status(400).json({ error: "referenceText is required" });
      return;
    }

    const azureKey    = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION;

    let result: PronunciationResult;
    let usedAzure = false;

    if (azureKey && azureRegion && req.file?.buffer.length) {
      try {
        result    = await assessWithAzure(req.file.buffer, referenceText, azureKey, azureRegion);
        usedAzure = true;
      } catch (err) {
        logger.warn({ err }, "Azure pronunciation assessment failed — using mock result");
        result = buildMockResult(referenceText);
      }
    } else {
      if (!azureKey || !azureRegion) {
        logger.info("Azure credentials absent — using mock result");
      } else if (!req.file?.buffer.length) {
        logger.warn("No audio received — using mock result");
      }
      result = buildMockResult(referenceText);
    }

    const [attempt] = await db
      .insert(practiceAttemptsTable)
      .values({
        userId:             req.userId,
        practiceText:       referenceText,
        practiceType:       mode,
        overallScore:       String(result.overallScore),
        accuracyScore:      String(result.accuracyScore),
        fluencyScore:       String(result.fluencyScore),
        completenessScore:  String(result.completenessScore),
        transcript:         result.transcript,
        likelySubstitutions: result.likelySubstitutions,
        phonemeFeedback:    result.phonemeFeedback,
        articulatoryTips:   result.articulatoryTips,
        feedbackJson:       result,
        durationMs:         req.file?.size
          ? Math.round((req.file.size / 16000) * 8 * 1000)
          : null,
      })
      .returning();

    await upsertDailyActivity(req.userId, result.overallScore);

    res.status(201).json({ attemptId: attempt.id, usedAzure, ...result });
  },
);

export default router;
