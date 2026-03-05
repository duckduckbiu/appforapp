import { useAudioUrl } from '@/hooks/useAudioUrl';
import { Play, Pause } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Slider } from '@/components/ui/slider';

interface VoiceMessagePlayerProps {
  filePath: string;
  duration?: number;
}

export function VoiceMessagePlayer({ filePath, duration }: VoiceMessagePlayerProps) {
  const { url, loading, error } = useAudioUrl(filePath);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);

  // 计算智能宽度：最短150px，最长350px
  const MIN_WIDTH = 150;
  const MAX_WIDTH = 350;
  const dynamicWidth = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, MIN_WIDTH + (totalDuration / 60) * (MAX_WIDTH - MIN_WIDTH))
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleDurationChange = () => {
      setTotalDuration(audio.duration);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSliderChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newTime = value[0];
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const seconds = Math.floor(time);
    return `0:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <LoadingSpinner size="sm" text="加载中..." className="py-1.5" />
    );
  }

  if (error || !url) {
    return (
      <div className="flex items-center gap-2 text-destructive py-1.5" style={{ width: `${MIN_WIDTH}px` }}>
        <span className="text-sm">{error || '语音加载失败'}</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 py-1.5"
      style={{ width: `${dynamicWidth}px` }}
    >
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />

      <button
        onClick={togglePlay}
        className="flex-shrink-0 hover:opacity-80 transition-opacity"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>

      <Slider
        value={[currentTime]}
        max={totalDuration || 100}
        step={0.1}
        onValueChange={handleSliderChange}
        className="flex-1 cursor-pointer"
      />

      <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
        {formatTime(totalDuration)}
      </span>
    </div>
  );
}
