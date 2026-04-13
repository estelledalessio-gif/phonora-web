import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Mic, BookOpen, BarChart3, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="py-20 md:py-32 px-6 flex flex-col items-center text-center bg-card">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl space-y-6"
        >
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground">
            Master the American Accent
          </div>
          <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight text-primary">
            Speak with Clarity and Confidence.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Phonora combines academic linguistic precision with modern learning tools to help you develop a native-like English accent.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/signup">
              <Button size="lg" className="h-12 px-8 text-base">
                Start Practicing Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/ipa">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                Explore IPA Library
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-background">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary">The science of sound, made simple.</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We break down pronunciation into practiceable elements, giving you actionable feedback on every phoneme.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-6 bg-card border rounded-xl shadow-sm space-y-4"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Mic className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-xl">Instant Feedback</h3>
              <p className="text-muted-foreground">
                Record yourself reading and get immediate, phoneme-level scoring to identify exactly where to improve.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-6 bg-card border rounded-xl shadow-sm space-y-4"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-xl">Interactive IPA Library</h3>
              <p className="text-muted-foreground">
                Study every sound in American English with clear articulation guides, minimal pairs, and audio examples.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="p-6 bg-card border rounded-xl shadow-sm space-y-4"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-xl">Progress Tracking</h3>
              <p className="text-muted-foreground">
                Build a daily habit with streak tracking and watch your accuracy and fluency scores climb over time.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <h2 className="font-serif text-3xl md:text-4xl font-bold">How Phonora works</h2>
          <div className="grid sm:grid-cols-2 gap-8 text-left">
            <div className="flex gap-4">
              <CheckCircle2 className="w-6 h-6 shrink-0 text-secondary" />
              <div>
                <h4 className="font-bold text-lg">1. Type or select text</h4>
                <p className="text-primary-foreground/80 mt-1">Input any English text you want to practice. We'll show you the exact IPA pronunciation.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle2 className="w-6 h-6 shrink-0 text-secondary" />
              <div>
                <h4 className="font-bold text-lg">2. Practice recording</h4>
                <p className="text-primary-foreground/80 mt-1">Read the text out loud. Our engine compares your speech to native American models.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle2 className="w-6 h-6 shrink-0 text-secondary" />
              <div>
                <h4 className="font-bold text-lg">3. Review feedback</h4>
                <p className="text-primary-foreground/80 mt-1">See exactly which sounds you missed with actionable tips on tongue and lip placement.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle2 className="w-6 h-6 shrink-0 text-secondary" />
              <div>
                <h4 className="font-bold text-lg">4. Track improvement</h4>
                <p className="text-primary-foreground/80 mt-1">Review your history to see your progress across overall accuracy, fluency, and completeness.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}