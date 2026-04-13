import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onRecordingComplete: (base64: string, durationMs: number) => void;
  className?: string;
}

export function AudioRecorder({ onRecordingComplete, className }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // The base64 string includes the data URL prefix e.g. "data:audio/webm;base64,XXXX"
          // We might want to strip it depending on the backend, but usually it's fine
          const actualBase64 = base64data.split(',')[1];
          onRecordingComplete(actualBase64 || base64data, duration);
        };
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Microphone permission denied. Please allow microphone access to practice.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (isRecording && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <div className="relative">
        {isRecording && (
          <div className="absolute -inset-4 rounded-full bg-destructive/20 animate-pulse" />
        )}
        <Button
          type="button"
          size="icon"
          variant={isRecording ? 'destructive' : 'default'}
          className={cn(
            'w-16 h-16 rounded-full transition-all duration-200 relative z-10',
            isRecording && 'hover:bg-destructive/90 shadow-[0_0_0_8px_rgba(239,68,68,0.2)]'
          )}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? <Square className="w-6 h-6" fill="currentColor" /> : <Mic className="w-6 h-6" />}
        </Button>
      </div>

      {isRecording && (
        <div className="text-sm font-mono font-medium text-destructive">
          {formatTime(duration)}
        </div>
      )}

      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
    </div>
  );
}