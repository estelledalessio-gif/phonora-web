import { useListPracticeAttempts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion } from "framer-motion";

export default function Results() {
  const { data: attempts, isLoading } = useListPracticeAttempts({ limit: 50 });

  const getScoreColor = (score: number | null | undefined) => {
    if (!score) return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight mb-2">Practice History</h1>
        <p className="text-muted-foreground">Review your past assessments and track your improvement.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Attempts</CardTitle>
          <CardDescription>Click on an attempt to see detailed feedback</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {isLoading ? (
            <div className="space-y-4 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !attempts || attempts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No practice history yet.</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {attempts.map((attempt, idx) => (
                <AccordionItem key={attempt.id} value={`item-${attempt.id}`} className="border-b last:border-0">
                  <AccordionTrigger className="hover:no-underline px-4 sm:px-2 py-4 hover:bg-muted/50 rounded-lg transition-colors group">
                    <div className="flex items-center justify-between w-full pr-4 text-left">
                      <div className="flex flex-col space-y-1 max-w-[60%]">
                        <span className="font-medium truncate group-hover:text-primary transition-colors">
                          {attempt.practiceText}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(attempt.createdAt), 'MMM d, yyyy • h:mm a')}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {attempt.overallScore != null && (
                          <Badge variant="secondary" className={getScoreColor(attempt.overallScore)}>
                            {Math.round(attempt.overallScore)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 sm:px-2 pb-6 pt-2">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-6"
                    >
                      {/* Scores */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Overall</span>
                          <span className="font-bold text-lg">{attempt.overallScore ? Math.round(attempt.overallScore) : '--'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Accuracy</span>
                          <span className="font-bold text-lg">{attempt.accuracyScore ? Math.round(attempt.accuracyScore) : '--'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Fluency</span>
                          <span className="font-bold text-lg">{attempt.fluencyScore ? Math.round(attempt.fluencyScore) : '--'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Duration</span>
                          <span className="font-bold text-lg">{attempt.durationMs ? `${(attempt.durationMs / 1000).toFixed(1)}s` : '--'}</span>
                        </div>
                      </div>

                      {/* Phoneme Feedback */}
                      {attempt.phonemeFeedback && (attempt.phonemeFeedback as any[]).length > 0 && (
                        <div>
                          <h4 className="font-bold text-sm uppercase tracking-wider text-primary mb-3">Target Sounds</h4>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {(attempt.phonemeFeedback as Array<{ phoneme: string; status?: string; score?: number; tip?: string }>).map((fb, i) => {
                              const statusColorMap: Record<string, string> = {
                                good: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                                fair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                                needs_work: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                              };
                              const statusLabel = fb.status ?? (fb.score != null ? (fb.score >= 80 ? "good" : fb.score >= 60 ? "fair" : "needs_work") : "good");
                              const colorClass = statusColorMap[statusLabel] ?? statusColorMap.good;
                              return (
                                <div key={i} className="flex gap-3 p-3 rounded border bg-card">
                                  <div className={`w-10 h-10 rounded flex items-center justify-center font-serif text-lg font-bold shrink-0 ${colorClass}`}>
                                    {fb.phoneme}
                                  </div>
                                  <div className="text-sm">
                                    <div className="font-medium mb-0.5 capitalize">{statusLabel.replace("_", " ")}</div>
                                    <p className="text-muted-foreground text-xs leading-relaxed">{fb.tip ?? "—"}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tips */}
                      {attempt.articulatoryTips && attempt.articulatoryTips.length > 0 && (
                        <div>
                          <h4 className="font-bold text-sm uppercase tracking-wider text-primary mb-3">Coaching Notes</h4>
                          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                            {attempt.articulatoryTips.map((tip, i) => (
                              <li key={i}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}