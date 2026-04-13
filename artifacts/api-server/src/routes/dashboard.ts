import { Router, type IRouter } from "express";
import { eq, desc, gte, sql } from "drizzle-orm";
import { db, practiceAttemptsTable, profilesTable, dailyActivityTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import {
  GetDashboardSummaryResponse,
  GetDailyActivityQueryParams,
  GetDailyActivityResponse,
  GetRecentAttemptsQueryParams,
  GetRecentAttemptsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", authenticate, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId));
  const streakDays = profile?.streakDays ?? 0;
  const totalAttempts = profile?.totalAttempts ?? 0;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const allAttempts = await db
    .select()
    .from(practiceAttemptsTable)
    .where(eq(practiceAttemptsTable.userId, userId));

  const todayAttempts = allAttempts.filter((a) => new Date(a.createdAt) >= todayStart).length;
  const weekAttempts = allAttempts.filter((a) => new Date(a.createdAt) >= weekStart);

  const weekScores = weekAttempts
    .map((a) => (a.overallScore != null ? Number(a.overallScore) : null))
    .filter((s): s is number => s != null);
  const avgScoreWeek = weekScores.length > 0 ? weekScores.reduce((a, b) => a + b, 0) / weekScores.length : null;

  const allScores = allAttempts
    .map((a) => (a.overallScore != null ? Number(a.overallScore) : null))
    .filter((s): s is number => s != null);
  const avgScoreAllTime = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;

  const lastAttempt = allAttempts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  // Compute top practiced sounds from practice texts
  const soundCounts: Record<string, number> = {};
  for (const attempt of allAttempts) {
    const text = attempt.practiceText ?? "";
    for (const word of text.split(/\s+/).slice(0, 3)) {
      const key = word.slice(0, 2).toLowerCase();
      soundCounts[key] = (soundCounts[key] ?? 0) + 1;
    }
  }
  const topPracticedSounds = Object.entries(soundCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symbol, count]) => ({ symbol, count }));

  const summary = {
    streakDays,
    totalAttempts,
    todayAttempts,
    weekAttempts: weekAttempts.length,
    avgScoreWeek: avgScoreWeek != null ? Math.round(avgScoreWeek * 10) / 10 : null,
    avgScoreAllTime: avgScoreAllTime != null ? Math.round(avgScoreAllTime * 10) / 10 : null,
    topPracticedSounds,
    lastPracticeAt: lastAttempt?.createdAt?.toISOString() ?? null,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/activity", authenticate, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const params = GetDailyActivityQueryParams.safeParse(req.query);
  const days = params.success && params.data.days != null ? params.data.days : 30;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const activity = await db
    .select()
    .from(dailyActivityTable)
    .where(eq(dailyActivityTable.userId, userId))
    .orderBy(dailyActivityTable.date);

  const mapped = activity.map((a) => ({
    date: typeof a.date === "string" ? a.date : (a.date as Date).toISOString().split("T")[0],
    count: a.count,
    avgScore: a.avgScore != null ? Number(a.avgScore) : null,
  }));

  res.json(GetDailyActivityResponse.parse(mapped));
});

router.get("/dashboard/recent-attempts", authenticate, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const params = GetRecentAttemptsQueryParams.safeParse(req.query);
  const limit = params.success && params.data.limit != null ? params.data.limit : 5;

  const attempts = await db
    .select()
    .from(practiceAttemptsTable)
    .where(eq(practiceAttemptsTable.userId, userId))
    .orderBy(desc(practiceAttemptsTable.createdAt))
    .limit(limit);

  const mapped = attempts.map((a) => ({
    ...a,
    overallScore: a.overallScore != null ? Number(a.overallScore) : null,
    accuracyScore: a.accuracyScore != null ? Number(a.accuracyScore) : null,
    fluencyScore: a.fluencyScore != null ? Number(a.fluencyScore) : null,
    completenessScore: a.completenessScore != null ? Number(a.completenessScore) : null,
    likelySubstitutions: Array.isArray(a.likelySubstitutions) ? a.likelySubstitutions : [],
    phonemeFeedback: Array.isArray(a.phonemeFeedback) ? a.phonemeFeedback : [],
    articulatoryTips: a.articulatoryTips ?? [],
  }));

  res.json(GetRecentAttemptsResponse.parse(mapped));
});

export default router;
