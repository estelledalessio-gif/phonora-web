import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useGetIpaSound } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Play, Mic, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function IpaDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  const { data: sound, isLoading } = useGetIpaSound(id, {
    query: {
      enabled: !isNaN(id)
    }
  });

  const playAudio = () => {
    if (sound?.audioUrl) {
      const audio = new Audio(sound.audioUrl);
      audio.play().catch(e => console.error("Audio playback failed", e));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!sound) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Sound not found</h2>
        <Link href="/ipa">
          <Button variant="link" className="mt-4">Back to Library</Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10 max-w-3xl mx-auto"
    >
      <Link href="/ipa">
        <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Library
        </Button>
      </Link>

      <Card className="overflow-hidden border-none shadow-lg bg-primary/5">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row">
            <div className="bg-primary text-primary-foreground p-12 flex flex-col items-center justify-center shrink-0 md:w-64 text-center">
              <span className="font-serif text-8xl font-bold mb-4">{sound.symbol}</span>
              <span className="text-sm uppercase tracking-widest opacity-80">{sound.category}</span>
              {sound.audioUrl && (
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="mt-6 rounded-full w-12 h-12"
                  onClick={playAudio}
                >
                  <Play className="w-5 h-5 ml-1" />
                </Button>
              )}
            </div>
            
            <div className="p-8 md:p-10 flex-1 space-y-6 bg-card">
              <div>
                <h1 className="text-3xl font-serif font-bold mb-2">{sound.name}</h1>
                <p className="text-muted-foreground text-lg leading-relaxed">{sound.description}</p>
              </div>

              <div>
                <h3 className="font-bold uppercase text-xs tracking-wider text-primary mb-3">How to articulate</h3>
                <p className="text-sm leading-relaxed">{sound.articulationGuide}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold uppercase text-xs tracking-wider text-primary mb-4">Example Words</h3>
            <div className="space-y-2">
              {sound.exampleWords.map((word, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded bg-muted/30">
                  <span className="font-medium text-lg">{word}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold uppercase text-xs tracking-wider text-primary mb-4">Minimal Pairs</h3>
            <div className="space-y-2">
              {sound.minimialPairs?.map((pair, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded bg-muted/30">
                  <span className="font-medium text-lg">{pair}</span>
                </div>
              ))}
              {(!sound.minimialPairs || sound.minimialPairs.length === 0) && (
                <p className="text-sm text-muted-foreground italic">No minimal pairs listed.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="pt-6 flex justify-center">
        <Link href={`/practice?text=${encodeURIComponent(sound.exampleWords.join(" "))}`}>
          <Button size="lg" className="h-14 px-8 text-lg w-full md:w-auto">
            <Mic className="mr-2 h-5 w-5" />
            Practice this sound
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}