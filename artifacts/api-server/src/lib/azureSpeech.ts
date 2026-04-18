/**
 * Azure Speech Pronunciation Assessment
 *
 * Audio pipeline:
 *   Browser WebM/Opus  →  ffmpeg  →  raw PCM s16le 16kHz mono
 *   →  SDK PushStream  →  SpeechRecognizer + PronunciationAssessmentConfig
 *   →  JSON result  →  structured coaching output
 */
import { spawn } from "child_process";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";

// ─── Public result shape ──────────────────────────────────────────────────────

export interface PhonemeEntry {
  phoneme: string;  // IPA symbol shown to user
  status: "good" | "fair" | "needs_work";
  tip: string;
}

export interface Substitution {
  target: string;    // expected phoneme (IPA)
  produced: string;  // what was heard (IPA)
  position: string;  // "word-initial" | "medial" | "word-final"
}

export interface PronunciationResult {
  overallScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  transcript: string;
  likelySubstitutions: Substitution[];
  phonemeFeedback: PhonemeEntry[];
  articulatoryTips: string[];
}

// ─── ARPABET ↔ IPA ────────────────────────────────────────────────────────────

const ARPABET_TO_IPA: Record<string, string> = {
  AA: "ɑ",  AE: "æ",  AH: "ʌ",  AO: "ɔ",  AW: "aʊ",
  AY: "aɪ", B:  "b",  CH: "tʃ", D:  "d",  DH: "ð",
  EH: "ɛ",  ER: "ɜː", EY: "eɪ", F:  "f",  G:  "ɡ",
  HH: "h",  IH: "ɪ",  IY: "iː", JH: "dʒ", K:  "k",
  L:  "l",  M:  "m",  N:  "n",  NG: "ŋ",  OW: "oʊ",
  OY: "ɔɪ", P:  "p",  R:  "ɹ",  S:  "s",  SH: "ʃ",
  T:  "t",  TH: "θ",  UH: "ʊ",  UW: "uː", V:  "v",
  W:  "w",  Y:  "j",  Z:  "z",  ZH: "ʒ",
};

function toIpa(arpabet: string): string {
  return ARPABET_TO_IPA[arpabet.toUpperCase()] ?? `/${arpabet.toLowerCase()}/`;
}

// ─── Per-phoneme articulation guidance ───────────────────────────────────────
// Phrased as inferred guidance, never claiming exact mouth tracking.

const PHONEME_TIPS: Record<string, string> = {
  TH: "For /θ/ (as in 'think'), let the tongue tip rest lightly behind the upper front teeth and allow air to pass through without voicing.",
  DH: "For /ð/ (as in 'the'), use the same tongue position as /θ/ but add voice — you should feel a slight buzz.",
  R:  "For the American /ɹ/, try pulling the tongue tip back without touching the roof of the mouth; the sides of the tongue can lightly contact the upper molars.",
  L:  "For /l/, tap the tongue tip firmly on the ridge just behind the upper front teeth while allowing air to flow around the sides.",
  V:  "For /v/, let the upper teeth lightly contact the inner lower lip and push air through while voicing — avoid making it sound like /b/.",
  W:  "For /w/, round the lips tightly and quickly open into the following vowel — the sound begins as the lips start moving.",
  AE: "For /æ/ (as in 'cat'), drop the jaw and spread the lips slightly; it sits lower and further forward than /ɛ/.",
  EH: "For /ɛ/ (as in 'bed'), the tongue mid-section rises toward the middle of the mouth — slightly higher than /æ/.",
  IH: "For /ɪ/ (as in 'sit'), the tongue is high but relaxed — a shorter, more central version of /iː/.",
  IY: "For /iː/ (as in 'see'), raise the tongue body high and push it forward while spreading the lips.",
  AH: "For /ʌ/ (as in 'but'), relax the tongue in a central, low-mid position — avoid raising it toward any vowel.",
  UW: "For /uː/ (as in 'food'), round the lips firmly and raise the back of the tongue toward the soft palate.",
  UH: "For /ʊ/ (as in 'book'), round the lips loosely and keep the tongue in a high-back but relaxed position.",
  ER: "For /ɜː/ (as in 'bird'), retract and slightly curl the tongue — the classic American r-colored vowel.",
  NG: "For /ŋ/ (as in 'sing'), the back of the tongue lifts to touch the soft palate while voicing continues through the nose.",
  SH: "For /ʃ/ (as in 'she'), raise the tongue blade toward (but not touching) the roof of the mouth and round the lips slightly.",
  ZH: "For /ʒ/ (as in 'measure'), use the same position as /ʃ/ but add voicing.",
  CH: "For /tʃ/ (as in 'church'), briefly stop airflow by raising the tongue blade, then release into a /ʃ/ sound.",
  JH: "For /dʒ/ (as in 'jump'), use the same motion as /tʃ/ but with voicing throughout.",
  S:  "For /s/, groove the tongue blade toward the alveolar ridge and let air flow through the narrow channel — keep the tip down.",
  Z:  "For /z/, use the same position as /s/ but add voicing; you should feel a buzz.",
  P:  "For /p/, press the lips together to stop airflow completely, then release with a puff of air.",
  B:  "For /b/, use the same lip closure as /p/ but add voicing throughout — the release is softer.",
  T:  "For /t/, briefly tap the tongue tip on the alveolar ridge and release with a small puff of air on stressed syllables.",
  D:  "For /d/, tap the tongue tip on the alveolar ridge as with /t/, but add voice — the release is less aspirated.",
  K:  "For /k/, raise the back of the tongue to contact the soft palate and release with airflow.",
  G:  "For /ɡ/, use the same back-tongue-to-palate contact as /k/ but add voicing.",
  F:  "For /f/, let the upper teeth rest lightly on the inner lower lip and let air escape steadily without voicing.",
  H:  "For /h/, let air pass through an open vocal tract with light friction — simply exhale gently before the following vowel.",
  M:  "For /m/, press the lips together and let sound resonate through the nose.",
  N:  "For /n/, touch the tongue tip to the alveolar ridge and let sound resonate through the nose.",
};

// Generic tips keyed by phoneme category
const CATEGORY_TIPS: Record<string, string[]> = {
  vowel: [
    "Vowel quality often comes from tongue body height and position — try exaggerating the movement before settling into a natural rhythm.",
    "Listen carefully to native examples of this vowel and mimic both the duration and quality.",
  ],
  fricative: [
    "Fricatives need consistent airflow — avoid stopping the breath mid-sound.",
    "Reduce jaw and lip tension to let air escape more freely.",
  ],
  stop: [
    "Stops need a clear moment of closure followed by a clean release — avoid blurring into the next sound.",
    "On stressed syllables, aspirate /p/, /t/, /k/ with a small puff of air after release.",
  ],
  nasal: [
    "Keep the airflow through the nose steady — avoid cutting it off early.",
    "Nasals at the end of words should fully resolve before you stop voicing.",
  ],
  approximant: [
    "Approximants are transitional — the articulators approach but never fully contact the target position.",
    "Slow down slightly before this sound to allow the tongue to reach the right position.",
  ],
};

const PHONEME_CATEGORY: Record<string, keyof typeof CATEGORY_TIPS> = {
  AE: "vowel", AH: "vowel", AO: "vowel", AW: "vowel", AY: "vowel",
  EH: "vowel", ER: "vowel", EY: "vowel", IH: "vowel", IY: "vowel",
  OW: "vowel", OY: "vowel", UH: "vowel", UW: "vowel", AA: "vowel",
  F: "fricative", V: "fricative", S: "fricative", Z: "fricative",
  SH: "fricative", ZH: "fricative", TH: "fricative", DH: "fricative",
  HH: "fricative",
  P: "stop", B: "stop", T: "stop", D: "stop", K: "stop", G: "stop",
  CH: "stop", JH: "stop",
  M: "nasal", N: "nasal", NG: "nasal",
  L: "approximant", R: "approximant", W: "approximant", Y: "approximant",
};

function tipForPhoneme(arpabet: string): string {
  const key = arpabet.toUpperCase();
  return PHONEME_TIPS[key] ?? `Work on the /${toIpa(key)}/ sound — try listening to native examples and mimicking the placement.`;
}

function statusLabel(score: number): "good" | "fair" | "needs_work" {
  if (score >= 80) return "good";
  if (score >= 60) return "fair";
  return "needs_work";
}

// Determine word position of a phoneme within its word
function phonemePosition(phonemeIndex: number, totalPhonemes: number): string {
  if (totalPhonemes === 1) return "isolated";
  if (phonemeIndex === 0) return "word-initial";
  if (phonemeIndex === totalPhonemes - 1) return "word-final";
  return "medial";
}

// ─── Audio conversion: WebM → raw PCM s16le 16kHz mono ───────────────────────

function convertToPcm(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      "-i", "pipe:0",
      "-ar", "16000",    // 16 kHz — Azure requirement
      "-ac", "1",        // mono
      "-acodec", "pcm_s16le",
      "-f", "s16le",     // raw PCM, no WAV header
      "pipe:1",
    ]);

    const chunks: Buffer[] = [];
    proc.stdout.on("data", (c: Buffer) => chunks.push(c));
    proc.stderr.on("data", () => {});  // suppress ffmpeg's own log
    proc.stdout.on("end", () => resolve(Buffer.concat(chunks)));
    proc.on("error", (err) => reject(new Error(`ffmpeg spawn failed: ${err.message}`)));
    proc.on("close", (code) => {
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    proc.stdin.on("error", () => {}); // ignore EPIPE
    proc.stdin.write(inputBuffer);
    proc.stdin.end();
  });
}

// ─── Azure SDK pronunciation assessment ──────────────────────────────────────

interface AzureWordResult {
  Word: string;
  PronunciationAssessment?: {
    AccuracyScore?: number;
    ErrorType?: string;  // "None" | "Omission" | "Insertion" | "Mispronunciation"
  };
  Phonemes?: Array<{
    Phoneme: string;      // ARPABET
    PronunciationAssessment?: {
      AccuracyScore?: number;
      NBestPhonemes?: Array<{ Phoneme: string; Score: number }>;
    };
  }>;
}

interface AzureRawResult {
  RecognitionStatus?: string;
  DisplayText?: string;
  NBest?: Array<{
    Lexical?: string;
    Display?: string;
    PronunciationAssessment?: {
      AccuracyScore?: number;
      FluencyScore?: number;
      CompletenessScore?: number;
      PronScore?: number;
    };
    Words?: AzureWordResult[];
  }>;
}

export async function assessWithAzure(
  audioBuffer: Buffer,
  referenceText: string,
  azureKey: string,
  azureRegion: string,
): Promise<PronunciationResult> {
  // 1. Convert audio to raw PCM expected by the SDK push stream
  const pcmBuffer = await convertToPcm(audioBuffer);

  // 2. Build SDK config
  const speechConfig = sdk.SpeechConfig.fromSubscription(azureKey, azureRegion);
  speechConfig.speechRecognitionLanguage = "en-US";
  // Request phoneme-level detail in the JSON response
  speechConfig.setServiceProperty(
    "wordLevelTimestamps", "true", sdk.ServicePropertyChannel.UriQueryParameter,
  );

  // 3. Push stream — format matches ffmpeg output
  const pushStream = sdk.AudioInputStream.createPushStream(
    sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1),
  );
  pushStream.write(pcmBuffer);
  pushStream.close();

  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

  // 4. Pronunciation assessment config — phoneme granularity with miscue detection
  const pronConfig = new sdk.PronunciationAssessmentConfig(
    referenceText,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Phoneme,
    true, // enableMiscue
  );

  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  pronConfig.applyTo(recognizer);

  // 5. Run recognition
  const raw = await new Promise<AzureRawResult>((resolve, reject) => {
    recognizer.recognizeOnceAsync(
      (result) => {
        recognizer.close();
        if (result.reason === sdk.ResultReason.RecognizedSpeech ||
            result.reason === sdk.ResultReason.NoMatch) {
          try {
            const jsonStr = result.properties.getProperty(
              sdk.PropertyId.SpeechServiceResponse_JsonResult, "{}"
            );
            resolve(JSON.parse(jsonStr) as AzureRawResult);
          } catch {
            reject(new Error("Failed to parse Azure response JSON"));
          }
        } else if (result.reason === sdk.ResultReason.Canceled) {
          const details = sdk.CancellationDetails.fromResult(result);
          recognizer.close();
          reject(new Error(`Azure recognition canceled: ${details.errorDetails}`));
        } else {
          recognizer.close();
          reject(new Error(`Azure recognition failed with reason: ${result.reason}`));
        }
      },
      (err) => {
        recognizer.close();
        reject(new Error(`Azure SDK error: ${err}`));
      },
    );
  });

  // 6. Map to structured result
  return mapAzureResult(raw, referenceText);
}

// ─── Result mapping ───────────────────────────────────────────────────────────

function mapAzureResult(raw: AzureRawResult, referenceText: string): PronunciationResult {
  const best = raw.NBest?.[0];
  const pa = best?.PronunciationAssessment ?? {};
  const words: AzureWordResult[] = best?.Words ?? [];

  const overallScore   = Math.round(pa.PronScore        ?? 0);
  const accuracyScore  = Math.round(pa.AccuracyScore    ?? 0);
  const fluencyScore   = Math.round(pa.FluencyScore     ?? 0);
  const completenessScore = Math.round(pa.CompletenessScore ?? 0);
  const transcript     = best?.Lexical ?? best?.Display ?? referenceText;

  // Collect phoneme-level data across all words
  const phonemeEntries: PhonemeEntry[] = [];
  const substitutions: Substitution[] = [];
  const lowScoringCategories = new Set<keyof typeof CATEGORY_TIPS>();

  for (const word of words) {
    const errorType = word.PronunciationAssessment?.ErrorType ?? "None";
    const phonemes  = word.Phonemes ?? [];

    for (let pi = 0; pi < phonemes.length; pi++) {
      const ph    = phonemes[pi];
      const arp   = ph.Phoneme?.toUpperCase() ?? "";
      const score = ph.PronunciationAssessment?.AccuracyScore ?? 100;
      const ipa   = toIpa(arp);
      const pos   = phonemePosition(pi, phonemes.length);

      const status = statusLabel(score);

      // Only surface needs_work and fair phonemes, plus a sample of good ones
      if (status !== "good" || phonemeEntries.length < 3) {
        phonemeEntries.push({
          phoneme: ipa,
          status,
          tip: status === "good"
            ? `Good production of /${ipa}/ in "${word.Word}".`
            : tipForPhoneme(arp),
        });
      }

      // Track category for global tips
      const cat = PHONEME_CATEGORY[arp];
      if (cat && status !== "good") lowScoringCategories.add(cat);

      // Substitution detection via NBestPhonemes
      if (score < 70 && ph.PronunciationAssessment?.NBestPhonemes?.length) {
        const [first, second] = ph.PronunciationAssessment.NBestPhonemes;
        if (first && second && first.Phoneme.toUpperCase() !== arp) {
          // The top alternative phoneme is not what was expected
          substitutions.push({
            target:   ipa,
            produced: toIpa(first.Phoneme),
            position: pos,
          });
        } else if (second && second.Score > 40 && second.Phoneme.toUpperCase() !== arp) {
          // Strong runner-up suggests a likely substitution
          substitutions.push({
            target:   ipa,
            produced: toIpa(second.Phoneme),
            position: pos,
          });
        }
      }
    }

    // Word-level omission or insertion feedback
    if (errorType === "Omission") {
      phonemeEntries.push({
        phoneme: word.Word,
        status: "needs_work",
        tip: `The word "${word.Word}" appears to have been omitted — try saying every word in the phrase clearly.`,
      });
    } else if (errorType === "Insertion") {
      phonemeEntries.push({
        phoneme: word.Word,
        status: "needs_work",
        tip: `An extra word around "${word.Word}" was detected — focus on matching the reference text exactly.`,
      });
    }
  }

  // De-duplicate substitutions by target phoneme
  const seenTargets = new Set<string>();
  const uniqueSubs = substitutions.filter((s) => {
    if (seenTargets.has(s.target)) return false;
    seenTargets.add(s.target);
    return true;
  });

  // Build global articulation tips
  const articulatoryTips: string[] = [];

  // Score-based global tips
  if (fluencyScore < 70) {
    articulatoryTips.push(
      "Work on connected speech — link words smoothly and reduce unnatural pauses between syllables.",
    );
  }
  if (accuracyScore < 70) {
    articulatoryTips.push(
      "Focus on individual sound placement before increasing speaking pace.",
    );
  }
  if (completenessScore < 90) {
    articulatoryTips.push(
      "Aim to pronounce every word in the phrase — omitting words reduces the overall completeness score.",
    );
  }

  // Category-specific tips (one per struggling category, max 2)
  let catTipCount = 0;
  for (const cat of lowScoringCategories) {
    if (catTipCount >= 2) break;
    const tips = CATEGORY_TIPS[cat];
    if (tips?.length) {
      articulatoryTips.push(tips[catTipCount % tips.length]);
      catTipCount++;
    }
  }

  // Universal positional tip if high overall
  if (overallScore >= 80 && articulatoryTips.length === 0) {
    articulatoryTips.push(
      "Strong overall result. Try increasing your natural speaking pace while maintaining clarity.",
    );
  }

  // Cap phoneme entries to avoid overwhelming the UI
  const cappedPhonemes = phonemeEntries.slice(0, 8);

  return {
    overallScore,
    accuracyScore,
    fluencyScore,
    completenessScore,
    transcript,
    likelySubstitutions: uniqueSubs.slice(0, 5),
    phonemeFeedback: cappedPhonemes,
    articulatoryTips: articulatoryTips.slice(0, 4),
  };
}
