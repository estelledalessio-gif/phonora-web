import { useState } from "react";
import { useLookupPronunciation, useListSavedTexts } from "@workspace/api-client-react";
import { AudioRecorder } from "@/components/AudioRecorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, BookOpen, RotateCcw, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Mode = "sound" | "word" | "phrase" | "sentence";

const MODES: { value: Mode; label: string; placeholder: string }[] = [
  { value: "sound", label: "Sound", placeholder: "e.g. the, this, three — words with /θ/" },
  { value: "word", label: "Word", placeholder: "e.g. pronunciation, comfortable, vegetable" },
  { value: "phrase", label: "Phrase", placeholder: "e.g. pleased to meet you" },
  { value: "sentence", label: "Sentence", placeholder: "e.g. She sells seashells by the seashore." },
];

interface AssessmentResult {
  attemptId?: number;
  overallScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  transcript: string;
  likelySubstitutions: Array<{ target: string; produced: string; position: string }>;
  phonemeFeedback: Array<{ phoneme: string; status: string; tip: string }>;
  articulatoryTips: string[];
}

function ScoreRing({
  score,
  label,
  size = "lg",
  color = "hsl(var(--primary))",
}: {
  score: number;
  label: string;
  size?: "sm" | "lg";
  color?: string;
}) {
  const isLg = size === "lg";
  const r = isLg ? 36 : 28;
  const stroke = isLg ? 7 : 5;
  const dim = isLg ? 96 : 72;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(score, 100) / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={cn("relative", isLg ? "w-24 h-24" : "w-[72px] h-[72px]")}>
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${dim} ${dim}`}>
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            stroke="currentColor" strokeWidth={stroke}
            fill="transparent" className="text-muted/25"
          />
          <motion.circle
            cx={dim / 2} cy={dim / 2} r={r}
            stroke={color} strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-bold tabular-nums", isLg ? "text-2xl" : "text-base")}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "good") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  if (status === "fair") return <Info className="w-4 h-4 text-yellow-500 shrink-0" />;
  return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
}

export default function Practice() {
  const [mode, setMode] = useState<Mode>("sentence");
  const [text, setText] = useState("");
  const [ipaWords, setIpaWords] = useState<Array<{ word: string; pronunciations: string[]; found: boolean; selectedIdx: number }>>([]);
  const [hasLookedUp, setHasLookedUp] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const session = useAuthStore((s) => s.session);
  const lookupMutation = useLookupPronunciation();
  const { data: savedTexts } = useListSavedTexts();

  const currentMode = MODES.find((m) => m.value === mode)!;

  const handleLookup = async () => {
    if (!text.trim()) return;
    try {
      const results = await lookupMutation.mutateAsync({ data: { text: text.trim() } });
      setIpaWords(results.map((r) => ({ ...r, selectedIdx: 0 })));
      setHasLookedUp(true);
    } catch {
      // swallow — IPA lookup is optional
    }
  };

  const handleRecordingComplete = async (blob: Blob, durationMs: number) => {
    if (!text.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("referenceText", text.trim());
      formData.append("mode", mode);

      const token = session?.access_token;
      const response = await fetch("/api/pronunciation", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).error ?? `Server error ${response.status}`);
      }

      const data: AssessmentResult = await response.json();
      setResult(data);
    } catch (err: any) {
      setSubmitError(err.message ?? "Assessment failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setText("");
    setIpaWords([]);
    setHasLookedUp(false);
    setResult(null);
    setSubmitError(null);
  };

  const scoreColor = (s: number) =>
    s >= 80 ? "hsl(142,71%,45%)" : s >= 65 ? "hsl(38,92%,50%)" : "hsl(0,84%,60%)";

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight mb-1">Practice Studio</h1>
        <p className="text-muted-foreground">Record your speech and receive instant pronunciation feedback.</p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 flex-wrap">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => { setMode(m.value); reset(); }}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
              mode === m.value
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Left column — input + IPA + results */}
        <div className="md:col-span-8 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base">
                  {mode === "sound" && "Words featuring the sound"}
                  {mode === "word" && "Word to practice"}
                  {mode === "phrase" && "Phrase to practice"}
                  {mode === "sentence" && "Sentence to practice"}
                </CardTitle>
                {savedTexts && savedTexts.filter((s) => !s.practiceType || s.practiceType === mode).length > 0 && (
                  <Select
                    onValueChange={(val) => {
                      setText(val);
                      setHasLookedUp(false);
                      setResult(null);
                    }}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="Use saved…" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedTexts
                        .filter((s) => !s.practiceType || s.practiceType === mode)
                        .map((st) => (
                          <SelectItem key={st.id} value={st.text}>
                            {st.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder={currentMode.placeholder}
                className="min-h-[90px] text-base resize-none"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (hasLookedUp) { setHasLookedUp(false); setResult(null); }
                }}
              />

              {!hasLookedUp && text.trim() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLookup}
                  disabled={lookupMutation.isPending}
                  className="gap-1.5"
                >
                  {lookupMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <BookOpen className="w-3.5 h-3.5" />}
                  Show pronunciation guide
                </Button>
              )}

              <AnimatePresence>
                {hasLookedUp && ipaWords.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-3 border-t"
                  >
                    <div className="flex flex-wrap gap-3 items-end">
                      {ipaWords.map((w, i) => (
                        <div key={i} className="flex flex-col items-start gap-0.5">
                          <span className="text-sm font-medium text-foreground">{w.word}</span>
                          {w.found ? (
                            w.pronunciations.length > 1 ? (
                              <Select
                                value={w.selectedIdx.toString()}
                                onValueChange={(v) => {
                                  setIpaWords((prev) => {
                                    const next = [...prev];
                                    next[i].selectedIdx = parseInt(v, 10);
                                    return next;
                                  });
                                }}
                              >
                                <SelectTrigger className="h-6 px-2 text-xs font-serif text-primary border-primary/20 bg-primary/5 w-auto min-w-[56px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {w.pronunciations.map((p, pi) => (
                                    <SelectItem key={pi} value={pi.toString()} className="font-serif text-xs">
                                      {p}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs font-serif text-primary px-1.5 py-0.5 bg-primary/5 rounded border border-primary/15">
                                {w.pronunciations[0]}
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic px-1">—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Score overview */}
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                      <ScoreRing
                        score={result.overallScore}
                        label="Overall"
                        size="lg"
                        color={scoreColor(result.overallScore)}
                      />
                      <div className="flex gap-5 sm:gap-6">
                        <ScoreRing score={result.accuracyScore} label="Accuracy" size="sm" color={scoreColor(result.accuracyScore)} />
                        <ScoreRing score={result.fluencyScore} label="Fluency" size="sm" color={scoreColor(result.fluencyScore)} />
                        <ScoreRing score={result.completenessScore} label="Complete" size="sm" color={scoreColor(result.completenessScore)} />
                      </div>
                    </div>
                    {result.transcript && (
                      <div className="mt-4 pt-4 border-t border-primary/10">
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-medium">Recognized</p>
                        <p className="text-sm italic text-foreground/80">"{result.transcript}"</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Phoneme feedback */}
                {result.phonemeFeedback.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Phoneme Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {result.phonemeFeedback.map((fb, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-serif text-sm font-bold shrink-0",
                              fb.status === "good"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : fb.status === "fair"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            )}
                          >
                            {fb.phoneme}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <StatusIcon status={fb.status} />
                              <span className="text-xs font-medium capitalize text-muted-foreground">{fb.status.replace("_", " ")}</span>
                            </div>
                            <p className="text-sm text-foreground/80">{fb.tip}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Substitutions */}
                {result.likelySubstitutions.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Likely Substitutions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {result.likelySubstitutions.map((sub, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-muted/30 text-sm">
                            <span className="font-serif font-bold text-primary">/{sub.target}/</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="font-serif text-destructive">/{sub.produced}/</span>
                            <span className="text-xs text-muted-foreground ml-1">{sub.position}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Coaching tips */}
                {result.articulatoryTips.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Coaching Tips</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.articulatoryTips.map((tip, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={reset} className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Practice something else
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column — mic */}
        <div className="md:col-span-4">
          <div className="sticky top-6">
            <Card
              className={cn(
                "transition-all duration-300",
                !text.trim() || result
                  ? "opacity-50 pointer-events-none grayscale-[0.4]"
                  : "border-primary shadow-md shadow-primary/10"
              )}
            >
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-base">Record</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center p-6 pt-2 gap-4">
                {isSubmitting ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground font-medium">Analyzing pronunciation…</p>
                  </div>
                ) : (
                  <AudioRecorder
                    onRecordingComplete={handleRecordingComplete}
                    disabled={!text.trim()}
                    className="py-6"
                  />
                )}

                {submitError && (
                  <p className="text-sm text-destructive text-center px-2">{submitError}</p>
                )}

                {!result && text.trim() && !isSubmitting && (
                  <div className="w-full space-y-2 pt-1 border-t">
                    <p className="text-xs text-muted-foreground text-center leading-snug">
                      Read the text aloud clearly, then tap stop.
                    </p>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{mode}</Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
