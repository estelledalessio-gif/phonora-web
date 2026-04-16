import { Router, type IRouter } from "express";
import multer from "multer";
import https from "https";
import http from "http";
import { authenticate } from "../middlewares/authenticate";
import { db, practiceAttemptsTable, profilesTable, dailyActivityTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

interface PronunciationResult {
  overallScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  transcript: string;
  likelySubstitutions: Array<{ target: string; produced: string; position: string }>;
  phonemeFeedback: Array<{ phoneme: string; status: string; tip: string }>;
  articulatoryTips: string[];
}

function buildMockResult(referenceText: string, mode: string): PronunciationResult {
  const words = referenceText.trim().split(/\s+/).filter(Boolean);

  const phonemeFeedback = words.slice(0, Math.min(words.length, 4)).map((word) => {
    const phoneme = word.slice(0, 2).toLowerCase();
    const status = Math.random() > 0.5 ? "good" : "needs_work";
    const tip =
      status === "good"
        ? `Good production of the sound in "${word}". Keep it up.`
        : `Focus on the opening sound of "${word}" — keep your tongue relaxed and forward.`;
    return { phoneme, status, tip };
  });

  const likelySubstitutions: PronunciationResult["likelySubstitutions"] = [];
  if (words.some((w) => w.toLowerCase().startsWith("th"))) {
    likelySubstitutions.push({ target: "θ", produced: "s", position: "word-initial" });
  }
  if (words.some((w) => /[aeiou]{2}/.test(w.toLowerCase()))) {
    likelySubstitutions.push({ target: "æ", produced: "ɛ", position: "medial" });
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
      "Reduce tension and let the airflow continue smoothly between words.",
      "Avoid turning /θ/ into /s/ — keep the tongue slightly forward, between the teeth.",
      "Work on linking words in connected speech for a more natural rhythm.",
    ],
  };
}

async function callAzurePronunciationAssessment(
  audioBuffer: Buffer,
  audioContentType: string,
  referenceText: string,
  azureKey: string,
  azureRegion: string
): Promise<PronunciationResult> {
  // Build the pronunciation assessment config JSON
  const pronunciationConfig = JSON.stringify({
    ReferenceText: referenceText,
    GradingSystem: "HundredMark",
    Dimension: "Comprehensive",
    EnableMiscue: true,
  });
  const configBase64 = Buffer.from(pronunciationConfig).toString("base64");

  const hostname = `${azureRegion}.stt.speech.microsoft.com`;
  const path =
    `/speech/recognition/conversation/cognitiveservices/v1` +
    `?language=en-US&format=detailed`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": azureKey,
        "Content-Type": audioContentType.includes("wav") ? "audio/wav" : "audio/webm;codecs=opus",
        "Pronunciation-Assessment": configBase64,
        "Accept": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);

          if (res.statusCode !== 200) {
            reject(new Error(`Azure API error ${res.statusCode}: ${body}`));
            return;
          }

          const best = data.NBest?.[0];
          if (!best) {
            reject(new Error("No recognition result from Azure"));
            return;
          }

          const pa = best.PronunciationAssessment ?? {};
          const words: any[] = best.Words ?? [];

          const phonemeFeedback = words.slice(0, 8).map((w: any) => {
            const score = w.PronunciationAssessment?.AccuracyScore ?? 70;
            return {
              phoneme: w.Word?.slice(0, 3) ?? "?",
              status: score >= 80 ? "good" : score >= 60 ? "fair" : "needs_work",
              tip:
                score < 80
                  ? `Work on the pronunciation of "${w.Word}" — try slowing down for this sound.`
                  : `Good production of "${w.Word}".`,
            };
          });

          const likelySubstitutions: PronunciationResult["likelySubstitutions"] = words
            .filter((w: any) => (w.PronunciationAssessment?.AccuracyScore ?? 100) < 70)
            .slice(0, 4)
            .map((w: any) => ({
              target: w.Word?.slice(0, 2) ?? "?",
              produced: "~",
              position: "word",
            }));

          resolve({
            overallScore: Math.round(pa.PronScore ?? 75),
            accuracyScore: Math.round(pa.AccuracyScore ?? 72),
            fluencyScore: Math.round(pa.FluencyScore ?? 78),
            completenessScore: Math.round(pa.CompletenessScore ?? 80),
            transcript: best.Lexical ?? referenceText,
            likelySubstitutions,
            phonemeFeedback,
            articulatoryTips: [
              "Focus on smooth linking between words for natural connected speech.",
              "Pay attention to word stress — stressed syllables should be longer and louder.",
            ],
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(audioBuffer);
    req.end();
  });
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

  // Recalculate streak
  const allActivity = await db
    .select({ date: dailyActivityTable.date })
    .from(dailyActivityTable)
    .where(eq(dailyActivityTable.userId, userId))
    .orderBy(desc(dailyActivityTable.date));

  let streak = 0;
  const now = new Date();
  for (let i = 0; i < allActivity.length; i++) {
    const actDateStr = typeof allActivity[i].date === "string"
      ? allActivity[i].date
      : (allActivity[i].date as unknown as Date).toISOString().split("T")[0];
    const expected = new Date(now);
    expected.setDate(expected.getDate() - i);
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

router.post(
  "/pronunciation",
  authenticate,
  upload.single("audio"),
  async (req, res): Promise<void> => {
    const referenceText = (req.body.referenceText as string)?.trim();
    const mode = (req.body.mode as string) || "sentence";

    if (!referenceText) {
      res.status(400).json({ error: "referenceText is required" });
      return;
    }

    let result: PronunciationResult;

    const azureKey = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION;

    if (azureKey && azureRegion && req.file) {
      try {
        result = await callAzurePronunciationAssessment(
          req.file.buffer,
          req.file.mimetype,
          referenceText,
          azureKey,
          azureRegion
        );
      } catch (err) {
        req.log.warn({ err }, "Azure assessment failed, falling back to mock");
        result = buildMockResult(referenceText, mode);
      }
    } else {
      result = buildMockResult(referenceText, mode);
    }

    const durationMs = req.file?.size ? Math.round((req.file.size / 16000) * 8 * 1000) : null;

    const [attempt] = await db
      .insert(practiceAttemptsTable)
      .values({
        userId: req.userId,
        practiceText: referenceText,
        practiceType: mode,
        overallScore: String(result.overallScore),
        accuracyScore: String(result.accuracyScore),
        fluencyScore: String(result.fluencyScore),
        completenessScore: String(result.completenessScore),
        transcript: result.transcript,
        likelySubstitutions: result.likelySubstitutions,
        phonemeFeedback: result.phonemeFeedback,
        articulatoryTips: result.articulatoryTips,
        feedbackJson: result,
        durationMs,
      })
      .returning();

    await upsertDailyActivity(req.userId, result.overallScore);

    res.status(201).json({ attemptId: attempt.id, ...result });
  }
);

export default router;
