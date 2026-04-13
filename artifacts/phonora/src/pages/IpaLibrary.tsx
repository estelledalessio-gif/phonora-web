import { useState } from "react";
import { Link } from "wouter";
import { useListIpaSounds } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { motion } from "framer-motion";

export default function IpaLibrary() {
  const [filter, setFilter] = useState<string>("all");
  const { data: sounds, isLoading } = useListIpaSounds();

  const filteredSounds = sounds?.filter(
    (sound) => filter === "all" || sound.category.toLowerCase() === filter.toLowerCase()
  );

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, scale: 0.95 },
    show: { opacity: 1, scale: 1 }
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight mb-2">IPA Library</h1>
        <p className="text-muted-foreground">
          Study the building blocks of the American English accent.
        </p>
      </div>

      <div className="flex overflow-x-auto pb-2 scrollbar-hide">
        <ToggleGroup type="single" value={filter} onValueChange={(val) => val && setFilter(val)} className="justify-start">
          <ToggleGroupItem value="all" className="px-4">All Sounds</ToggleGroupItem>
          <ToggleGroupItem value="vowel" className="px-4">Vowels</ToggleGroupItem>
          <ToggleGroupItem value="consonant" className="px-4">Consonants</ToggleGroupItem>
          <ToggleGroupItem value="diphthong" className="px-4">Diphthongs</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(15)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          {filteredSounds?.map((sound) => (
            <motion.div key={sound.id} variants={item}>
              <Link href={`/ipa/${sound.id}`}>
                <Card className="h-full cursor-pointer hover:border-primary hover:shadow-md transition-all flex flex-col items-center justify-center p-6 text-center space-y-2 group">
                  <div className="font-serif text-4xl text-foreground font-bold group-hover:text-primary transition-colors">
                    {sound.symbol}
                  </div>
                  <Badge variant="outline" className="text-xs uppercase tracking-wider bg-transparent">
                    {sound.category}
                  </Badge>
                  <div className="text-xs text-muted-foreground truncate w-full mt-2">
                    {sound.exampleWords.slice(0, 2).join(", ")}
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}