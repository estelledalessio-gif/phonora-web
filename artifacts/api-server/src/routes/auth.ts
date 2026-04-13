import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable, userSettingsTable } from "@workspace/db";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { authenticate } from "../middlewares/authenticate";
import { GetProfileResponse, UpdateProfileBody, GetSettingsResponse, UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

// ── Ensure profile + settings exist for a user ───────────────────────────────
async function ensureUserRecords(userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));

  if (!existing) {
    await db
      .insert(profilesTable)
      .values({ userId, streakDays: 0, totalAttempts: 0 })
      .onConflictDoNothing();
    await db
      .insert(userSettingsTable)
      .values({ userId })
      .onConflictDoNothing();
  }
}

// ── Signup ────────────────────────────────────────────────────────────────────
router.post("/auth/signup", async (req, res): Promise<void> => {
  const { email, password, displayName } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error || !data.user) {
    req.log.warn({ err: error }, "Signup failed");
    res.status(400).json({ error: error?.message ?? "Signup failed" });
    return;
  }

  const userId = data.user.id;
  await ensureUserRecords(userId);

  if (displayName) {
    await db
      .update(profilesTable)
      .set({ displayName })
      .where(eq(profilesTable.userId, userId));
  }

  // Sign in to get a session token
  const { data: session, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !session.session) {
    res.status(201).json({ userId, message: "Account created. Please log in." });
    return;
  }

  res.status(201).json({
    token: session.session.access_token,
    refreshToken: session.session.refresh_token,
    userId,
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Ensure profile rows exist for users who signed up via Google or other means
  await ensureUserRecords(data.user.id);

  res.json({
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    userId: data.user.id,
  });
});

// ── Token refresh ─────────────────────────────────────────────────────────────
router.post("/auth/refresh", async (req, res): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken required" });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  res.json({
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
});

// ── Google OAuth – redirect to Supabase ───────────────────────────────────────
router.get("/auth/google", async (req, res): Promise<void> => {
  const supabaseUrl = process.env.SUPABASE_URL!;
  // Use an env var for the redirect URL; fall back to REPLIT_DOMAINS
  const origin = process.env.PUBLIC_URL
    ?? (process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
        : "http://localhost:80");

  const redirectTo = `${origin}/auth/callback`;
  const googleOAuthUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  res.redirect(googleOAuthUrl);
});

// ── OAuth callback – exchange code for session ────────────────────────────────
router.get("/auth/callback", async (req, res): Promise<void> => {
  const origin = process.env.PUBLIC_URL
    ?? (process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
        : "http://localhost:80");

  // Supabase handles the PKCE exchange client-side; redirect to frontend which
  // will pick up the session from the URL fragment.
  res.redirect(`${origin}/#access_token=&type=recovery`);
  // The real redirect is handled by supabase-js on the client.
  res.redirect(`${origin}/auth/callback`);
});

// ── Profile ───────────────────────────────────────────────────────────────────
router.get("/auth/profile", authenticate, async (req, res): Promise<void> => {
  await ensureUserRecords(req.userId);
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, req.userId));

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetProfileResponse.parse(profile));
});

router.patch("/auth/profile", authenticate, async (req, res): Promise<void> => {
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
    .where(eq(profilesTable.userId, req.userId))
    .returning();

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetProfileResponse.parse(profile));
});

// ── Settings ──────────────────────────────────────────────────────────────────
router.get("/auth/settings", authenticate, async (req, res): Promise<void> => {
  await ensureUserRecords(req.userId);
  let [settings] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, req.userId));

  if (!settings) {
    const [created] = await db
      .insert(userSettingsTable)
      .values({ userId: req.userId })
      .returning();
    settings = created;
  }
  res.json(GetSettingsResponse.parse(settings));
});

router.patch("/auth/settings", authenticate, async (req, res): Promise<void> => {
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

  const [settings] = await db
    .update(userSettingsTable)
    .set(updates)
    .where(eq(userSettingsTable.userId, req.userId))
    .returning();

  if (!settings) {
    const [created] = await db
      .insert(userSettingsTable)
      .values({ userId: req.userId, ...updates })
      .returning();
    res.json(GetSettingsResponse.parse(created));
    return;
  }
  res.json(GetSettingsResponse.parse(settings));
});

export default router;
