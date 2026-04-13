import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ipaSoundsTable } from "@workspace/db";
import {
  ListIpaSoundsQueryParams,
  ListIpaSoundsResponse,
  GetIpaSoundParams,
  GetIpaSoundResponse,
  LookupPronunciationBody,
  LookupPronunciationResponse,
} from "@workspace/api-zod";
import { lookupText } from "../lib/cmudict";

const router: IRouter = Router();

router.get("/ipa/sounds", async (req, res): Promise<void> => {
  const params = ListIpaSoundsQueryParams.safeParse(req.query);
  let query = db.select().from(ipaSoundsTable);
  const sounds = params.success && params.data.category
    ? await db.select().from(ipaSoundsTable).where(eq(ipaSoundsTable.category, params.data.category))
    : await db.select().from(ipaSoundsTable);

  const mapped = sounds.map((s) => ({
    ...s,
    minimialPairs: s.minimialPairs ?? [],
  }));
  res.json(ListIpaSoundsResponse.parse(mapped));
});

router.get("/ipa/sounds/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetIpaSoundParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [sound] = await db.select().from(ipaSoundsTable).where(eq(ipaSoundsTable.id, params.data.id));
  if (!sound) {
    res.status(404).json({ error: "Sound not found" });
    return;
  }
  res.json(GetIpaSoundResponse.parse({ ...sound, minimialPairs: sound.minimialPairs ?? [] }));
});

router.post("/ipa/lookup", async (req, res): Promise<void> => {
  const parsed = LookupPronunciationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const results = lookupText(parsed.data.text);
  res.json(LookupPronunciationResponse.parse(results));
});

export default router;
