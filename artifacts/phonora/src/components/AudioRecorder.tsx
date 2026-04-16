import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, durationMs: number) => void;
  className?: string;
  disabled?: boolean;
}

export function AudioRecorder({ onRecordingComplete, className, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      setDuration(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(blob, Date.now() - startTimeRef.current);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);
    } catch {
      setError('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className="relative">
        {isRecording && (
          <div className="absolute -inset-4 rounded-full bg-destructive/20 animate-pulse" />
        )}
        <Button
          type="button"
          size="icon"
          variant={isRecording ? 'destructive' : 'default'}
          disabled={disabled && !isRecording}
          className={cn(
            'w-16 h-16 rounded-full transition-all duration-200 relative z-10',
            isRecording && 'shadow-[0_0_0_8px_rgba(239,68,68,0.2)]'
          )}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? <Square className="w-6 h-6" fill="currentColor" /> : <Mic className="w-6 h-6" />}
        </Button>
      </div>

      {isRecording ? (
        <div className="text-sm font-mono font-medium text-destructive">{formatTime(duration)}</div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">
          {disabled ? 'Enter text first' : 'Tap to record'}
        </p>
      )}

      {error && <p className="text-sm text-destructive text-center max-w-[200px]">{error}</p>}
    </div>
  );
}
