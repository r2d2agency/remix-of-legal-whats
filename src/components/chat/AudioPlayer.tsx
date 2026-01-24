import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  mimetype?: string;
  className?: string;
  isFromMe?: boolean;
}

export function AudioPlayer({ src, mimetype, className, isFromMe }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext>();
  const analyserRef = useRef<AnalyserNode>();
  const sourceRef = useRef<MediaElementAudioSourceNode>();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Generate static waveform bars
  useEffect(() => {
    const bars = Array.from({ length: 30 }, () => Math.random() * 0.6 + 0.2);
    setWaveformData(bars);
  }, [src]);

  // Draw waveform with requestAnimationFrame for smooth updates
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Only resize if dimensions changed
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    
    if (width === 0 || height === 0) return;
    
    const barCount = waveformData.length;
    const totalGaps = (barCount - 1) * 2;
    const barWidth = Math.max(2, (width - totalGaps) / barCount);
    const gap = 2;

    ctx.clearRect(0, 0, width, height);

    const progress = duration > 0 ? currentTime / duration : 0;

    waveformData.forEach((level, i) => {
      const x = i * (barWidth + gap);
      const barHeight = Math.max(4, level * (height * 0.8));
      const y = (height - barHeight) / 2;

      // Calculate if this bar is before or after the progress point
      const barProgress = (i + 0.5) / barCount; // center of bar
      const isPlayed = barProgress <= progress;

      // Color based on progress
      if (isPlayed) {
        ctx.fillStyle = isFromMe 
          ? 'rgba(255, 255, 255, 0.95)' 
          : '#2563eb'; // primary blue
      } else {
        ctx.fillStyle = isFromMe 
          ? 'rgba(255, 255, 255, 0.35)' 
          : 'rgba(37, 99, 235, 0.35)'; // primary blue with opacity
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    });
  }, [waveformData, currentTime, duration, isFromMe]);

  // Redraw on every relevant change
  useEffect(() => {
    const animationId = requestAnimationFrame(drawWaveform);
    return () => cancelAnimationFrame(animationId);
  }, [drawWaveform, currentTime]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
      setHasError(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      console.error('Audio error:', audio.error);
      setIsLoading(false);
      setHasError(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
    };
  }, []);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Play error:', error);
      setHasError(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || !duration) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audio.currentTime = percentage * duration;
  };

  if (hasError) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg",
        isFromMe ? "bg-primary-foreground/10" : "bg-muted",
        className
      )}>
        <Volume2 className="h-5 w-5 opacity-50" />
        <span className="text-sm opacity-70">Áudio não disponível</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-lg min-w-[200px] max-w-[280px]",
      isFromMe ? "bg-primary-foreground/10" : "bg-background/50",
      className
    )}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        preload="metadata"
        crossOrigin="anonymous"
      >
        {mimetype && <source src={src} type={mimetype} />}
        <source src={src} type="audio/ogg; codecs=opus" />
        <source src={src} type="audio/webm; codecs=opus" />
        <source src={src} type="audio/mpeg" />
        <source src={src} type="audio/mp4" />
        <source src={src} type="audio/ogg" />
      </audio>

      {/* Play/Pause button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-10 w-10 rounded-full flex-shrink-0",
          isFromMe 
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground" 
            : "bg-primary/20 hover:bg-primary/30 text-primary"
        )}
        onClick={togglePlay}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </Button>

      {/* Waveform and time */}
      <div className="flex-1 min-w-0">
        <canvas
          ref={canvasRef}
          className="w-full h-8 cursor-pointer"
          onClick={handleSeek}
        />
        <div className={cn(
          "text-[10px] mt-0.5",
          isFromMe ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
