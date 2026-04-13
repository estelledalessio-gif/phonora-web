import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useLookupPronunciation, 
  useAssessPronunciation, 
  useCreatePracticeAttempt,
  useListSavedTexts
} from "@workspace/api-client-react";
import { AudioRecorder } from "@/components/AudioRecorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight, Save, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Practice() {
  const [location] = useLocation();
  // Simple query param parsing since wouter doesn't have a built-in hook for it
  const searchParams = new URLSearchParams(window.location.search);
  const initialText = searchParams.get("text") || "";

  const [text, setText] = useState(initialText);
  const [ipaWords, setIpaWords] = useState<Array<{word: string, pronunciations: string[], found: boolean, selectedIdx: number}>>([]);
  const [hasLookedUp, setHasLookedUp] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [isAssessing, setIsAssessing] = useState(false);

  const lookupMutation = useLookupPronunciation();
  const assessMutation = useAssessPronunciation();
  const saveAttemptMutation = useCreatePracticeAttempt();
  const { data: savedTexts } = useListSavedTexts();

  const handleLookup = async () => {
    if (!text.trim()) return;
    try {
      const results = await lookupMutation.mutateAsync({ data: { text: text.trim() } });
      setIpaWords(results.map(r => ({ ...r, selectedIdx: 0 })));
      setHasLookedUp(true);
      setAssessmentResult(null);
    } catch (err) {
      console.error("Lookup failed", err);
    }
  };

  const handlePronunciationChange = (wordIndex: number, pronIndex: string) => {
    setIpaWords(prev => {
      const next = [...prev];
      next[wordIndex].selectedIdx = parseInt(pronIndex, 10);
      return next;
    });
  };

  const handleRecordingComplete = async (base64Audio: string, durationMs: number) => {
    if (!text.trim()) return;
    setIsAssessing(true);
    try {
      // Get the assembled IPA string based on user selections
      const ipaBreakdown = ipaWords.map(w => w.found ? w.pronunciations[w.selectedIdx] : w.word).join(" ");
      
      const result = await assessMutation.mutateAsync({
        data: {
          audioBase64: base64Audio,
          referenceText: text.trim(),
          practiceType: "freeform"
        }
      });
      
      setAssessmentResult(result);

      // Save the attempt
      await saveAttemptMutation.mutateAsync({
        data: {
          practiceText: text.trim(),
          practiceType: "freeform",
          overallScore: result.overallScore,
          accuracyScore: result.accuracyScore,
          fluencyScore: result.fluencyScore,
          completenessScore: result.completenessScore,
          transcript: result.transcript,
          likelySubstitutions: result.likelySubstitutions,
          phonemeFeedback: result.phonemeFeedback,
          articulatoryTips: result.articulatoryTips,
          ipaBreakdown,
          durationMs
        }
      });
      
    } catch (err) {
      console.error("Assessment failed", err);
    } finally {
      setIsAssessing(false);
    }
  };

  const resetPractice = () => {
    setText("");
    setIpaWords([]);
    setHasLookedUp(false);
    setAssessmentResult(null);
  };

  // Helper for circular progress
  const ScoreRing = ({ score, label, color = "var(--primary)" }: { score: number, label: string, color?: string }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-muted/30" />
            <motion.circle 
              cx="40" cy="40" r={radius} 
              stroke={color} 
              strokeWidth="6" 
              fill="transparent" 
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-bold text-lg">
            {Math.round(score)}
          </div>
        </div>
        <span className="text-xs text-muted-foreground mt-2 font-medium uppercase tracking-wider">{label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-20 max-w-4xl mx-auto">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight mb-2">Practice Studio</h1>
        <p className="text-muted-foreground">
          Enter text, review the pronunciation, and record yourself.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-8 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">What do you want to practice?</CardTitle>
                {savedTexts && savedTexts.length > 0 && (
                  <Select onValueChange={(val) => { setText(val); setHasLookedUp(false); setAssessmentResult(null); }}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Use saved text..." />
                    </SelectTrigger>
                    <SelectContent>
                      {savedTexts.map(st => (
                        <SelectItem key={st.id} value={st.text}>{st.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Type or paste English text here..."
                className="min-h-[120px] text-lg resize-none p-4"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (hasLookedUp) {
                    setHasLookedUp(false);
                    setAssessmentResult(null);
                  }
                }}
              />
              
              {!hasLookedUp && (
                <Button 
                  onClick={handleLookup} 
                  disabled={!text.trim() || lookupMutation.isPending}
                  className="w-full"
                >
                  {lookupMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
                  Get Pronunciation Guide
                </Button>
              )}

              <AnimatePresence>
                {hasLookedUp && ipaWords.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pt-4 border-t space-y-4"
                  >
                    <div className="flex flex-wrap gap-2 items-center text-lg leading-loose">
                      {ipaWords.map((wordObj, i) => (
                        <div key={i} className="inline-flex flex-col group">
                          <span className="text-sm font-medium text-foreground">{wordObj.word}</span>
                          {wordObj.found ? (
                            wordObj.pronunciations.length > 1 ? (
                              <Select 
                                value={wordObj.selectedIdx.toString()} 
                                onValueChange={(val) => handlePronunciationChange(i, val)}
                              >
                                <SelectTrigger className="h-6 px-2 text-xs font-serif text-primary border-primary/20 bg-primary/5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {wordObj.pronunciations.map((pron, pIdx) => (
                                    <SelectItem key={pIdx} value={pIdx.toString()} className="font-serif">
                                      {pron}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs font-serif text-primary px-1 bg-primary/5 rounded border border-primary/10">
                                {wordObj.pronunciations[0]}
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic px-1">unknown</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {assessmentResult && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row items-center justify-around gap-8">
                    <ScoreRing score={assessmentResult.overallScore} label="Overall" color="hsl(var(--primary))" />
                    <div className="flex gap-6">
                      <ScoreRing score={assessmentResult.accuracyScore} label="Accuracy" color="hsl(var(--chart-2))" />
                      <ScoreRing score={assessmentResult.fluencyScore} label="Fluency" color="hsl(var(--chart-4))" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {assessmentResult.phonemeFeedback && assessmentResult.phonemeFeedback.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Phoneme Feedback</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {assessmentResult.phonemeFeedback.map((fb: any, i: number) => (
                        <div key={i} className="flex items-start gap-4 p-3 rounded-lg border bg-card">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-serif text-xl font-bold shrink-0 ${
                            fb.score > 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            fb.score > 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {fb.phoneme}
                          </div>
                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold">Score: {Math.round(fb.score)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{fb.tip}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {assessmentResult.articulatoryTips && assessmentResult.articulatoryTips.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Coaching Tips</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {assessmentResult.articulatoryTips.map((tip: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={resetPractice}>Practice Something Else</Button>
              </div>
            </motion.div>
          )}
        </div>

        <div className="md:col-span-4">
          <div className="sticky top-6">
            <Card className={!hasLookedUp || assessmentResult ? "opacity-50 pointer-events-none grayscale-[0.5] transition-all" : "border-primary shadow-md"}>
              <CardHeader className="text-center pb-2">
                <CardTitle>Record Your Speech</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center p-6 pt-2">
                {isAssessing ? (
                  <div className="flex flex-col items-center py-8 space-y-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-sm font-medium text-muted-foreground">Analyzing pronunciation...</p>
                  </div>
                ) : (
                  <AudioRecorder 
                    onRecordingComplete={handleRecordingComplete} 
                    className="py-8"
                  />
                )}
                <p className="text-xs text-center text-muted-foreground mt-4 max-w-[200px]">
                  Read the text aloud clearly. Click the mic to start and stop.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Needed to fix the import missing in this file:
import { BookOpen } from "lucide-react";