import { Router, type IRouter } from "express";
import { authenticate } from "../middlewares/authenticate";
import { AssessPronunciationBody, AssessPronunciationResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/assessment/score", authenticate, async (req, res): Promise<void> => {
  const parsed = AssessPronunciationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION;

  if (azureKey && azureRegion) {
    // Real Azure Speech Pronunciation Assessment integration
    // Placeholder: the actual implementation would use the Azure Cognitive Services SDK
    // and make a request to the REST pronunciation assessment API
    req.log.info({ region: azureRegion }, "Azure Speech assessment requested (integration pending)");
  }

  // Mock result matching the exact shape the real service returns
  const words = parsed.data.referenceText.trim().split(/\s+/);
  const phonemeFeedback = words.slice(0, 6).map((word, i) => ({
    phoneme: word.slice(0, 2).toLowerCase(),
    score: Math.round(70 + Math.random() * 28),
    tip: `Focus on the opening sound of "${word}" — keep your tongue relaxed and forward.`,
  }));

  const articulatoryTips = [
    "Reduce vowel reduction in unstressed syllables for a more natural rhythm.",
    "Work on linking words smoothly — connected speech feels more native.",
    "Your stopping consonants are clear; focus on aspirating /p/, /t/, /k/ at the start of stressed syllables.",
  ];

  const likelySubstitutions = words.slice(0, 3).map((word) => ({
    expected: word.slice(0, 1),
    actual: word.slice(0, 1).toLowerCase() === "θ" ? "s" : "θ",
    word,
  }));

  const result = {
    overallScore: Math.round(72 + Math.random() * 20),
    accuracyScore: Math.round(68 + Math.random() * 25),
    fluencyScore: Math.round(75 + Math.random() * 18),
    completenessScore: Math.round(85 + Math.random() * 12),
    transcript: parsed.data.referenceText,
    likelySubstitutions,
    phonemeFeedback,
    articulatoryTips,
  };

  res.json(AssessPronunciationResponse.parse(result));
});

export default router;
