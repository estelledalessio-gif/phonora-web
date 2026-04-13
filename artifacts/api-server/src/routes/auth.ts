import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, profilesTable, userSettingsTable } from "@workspace/db";
import { signToken, hashPassword, comparePassword } from "../lib/auth";
import { authenticate } from "../middlewares/authenticate";
import { GetProfileResponse, UpdateProfileBody, GetSettingsResponse, UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/signup", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const userId = randomUUID();
  await db.insert(usersTable).values({ id: userId, email: email.toLowerCase(), passwordHash });
  await db.insert(profilesTable).values({ userId, streakDays: 0, totalAttempts: 0 });
  await db.insert(userSettingsTable).values({ userId });
  const token = signToken(userId);
  res.status(201).json({ token, userId });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken(user.id);
  res.json({ token, userId: user.id });
});

router.get("/auth/profile", authenticate, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetProfileResponse.parse(profile));
});

router.patch("/auth/profile", authenticate, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if (parsed.data.nativeLanguage !== undefined) updates.nativeLanguage = parsed.data.nativeLanguage;
  if (parsed.data.targetAccent !== undefined) updates.targetAccent = parsed.data.targetAccent;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  const [profile] = await db
    .update(profilesTable)
    .set(updates)
    .where(eq(profilesTable.userId, userId))
    .returning();

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetProfileResponse.parse(profile));
});

router.get("/auth/settings", authenticate, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  let [settings] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId));
  if (!settings) {
    const [created] = await db.insert(userSettingsTable).values({ userId }).returning();
    settings = created;
  }
  res.json(GetSettingsResponse.parse(settings));
});

router.patch("/auth/settings", authenticate, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.theme !== undefined) updates.theme = parsed.data.theme;
  if (parsed.data.audioInputDeviceId !== undefined) updates.audioInputDeviceId = parsed.data.audioInputDeviceId;
  if (parsed.data.showPhonemeBreakdown !== undefined) updates.showPhonemeBreakdown = parsed.data.showPhonemeBreakdown;
  if (parsed.data.enableStreakReminders !== undefined) updates.enableStreakReminders = parsed.data.enableStreakReminders;
  if (parsed.data.dailyGoalMinutes !== undefined) updates.dailyGoalMinutes = parsed.data.dailyGoalMinutes;

  let [settings] = await db
    .update(userSettingsTable)
    .set(updates)
    .where(eq(userSettingsTable.userId, userId))
    .returning();

  if (!settings) {
    const [created] = await db.insert(userSettingsTable).values({ userId, ...updates }).returning();
    settings = created;
  }
  res.json(GetSettingsResponse.parse(settings));
});

export default router;
