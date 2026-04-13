import { useGetDashboardSummary, useGetDailyActivity, useGetRecentAttempts } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Trophy, Target, Mic, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: recent, isLoading: loadingRecent } = useGetRecentAttempts({ limit: 5 });

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight mb-2">Overview</h1>
        <p className="text-muted-foreground">Your pronunciation progress at a glance.</p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={item}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Streak</CardTitle>
              <Flame className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.streakDays || 0} days</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary?.todayAttempts ? "You practiced today!" : "Practice today to keep it up"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weekly Average</CardTitle>
              <Trophy className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.avgScoreWeek ? Math.round(summary.avgScoreWeek) : '--'}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Overall accuracy this week
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
              <Target className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.totalAttempts || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary?.weekAttempts || 0} attempts this week
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} className="flex flex-col justify-center">
          <Link href="/practice">
            <Button className="w-full h-full min-h-[104px] text-lg flex-col gap-2">
              <Mic className="w-6 h-6" />
              Practice Now
            </Button>
          </Link>
        </motion.div>
      </motion.div>

      <div className="grid gap-8 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Practice</CardTitle>
              <CardDescription>Your latest assessment results</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRecent ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recent && recent.length > 0 ? (
                <div className="space-y-4">
                  {recent.map((attempt) => (
                    <Link key={attempt.id} href={`/results?id=${attempt.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
                        <div className="overflow-hidden mr-4">
                          <p className="text-sm font-medium truncate">{attempt.practiceText}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(attempt.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-bold text-primary">
                              {attempt.overallScore ? `${Math.round(attempt.overallScore)}%` : '--'}
                            </div>
                            <div className="text-xs text-muted-foreground">Score</div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No practice attempts yet.</p>
                  <Link href="/practice">
                    <Button variant="link" className="mt-2">Start your first session</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Focus Sounds</CardTitle>
              <CardDescription>Based on your recent practice</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : summary?.topPracticedSounds && summary.topPracticedSounds.length > 0 ? (
                <div className="space-y-3">
                  {summary.topPracticedSounds.map((sound, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-primary/10 text-primary font-serif text-lg font-bold flex items-center justify-center">
                          {sound.symbol}
                        </div>
                        <span className="text-sm font-medium">Practiced {sound.count} times</span>
                      </div>
                    </div>
                  ))}
                  <Link href="/ipa" className="block mt-4 text-sm text-primary hover:underline font-medium">
                    View all sounds in IPA Library
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Keep practicing to see your focus sounds.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}