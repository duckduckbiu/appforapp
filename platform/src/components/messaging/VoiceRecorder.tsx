import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, X, Send, Square } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useMicrophonePermission } from "@/hooks/useMicrophonePermission";

interface VoiceRecorderProps {
  open: boolean;
  onClose: () => void;
  onSend: (file: File, duration: number) => void;
}

export function VoiceRecorder({ open, onClose, onSend }: VoiceRecorderProps) {
  const { permissionStatus, requestPermission, isRecording, startRecording, stopRecording } = useMicrophonePermission();
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open) {
      handleReset();
    }
  }, [open]);

  useEffect(() => {
    if (isRecording) {
      // Start timer with 60 second limit
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          // Auto stop at 60 seconds
          if (newDuration >= 60) {
            handleStopRecording();
            toast.info("已达到最长录音时间（60秒）");
          }
          return newDuration;
        });
      }, 1000);
    } else {
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (!granted) {
      toast.error("需要麦克风权限才能录音");
    }
  };

  const handleStartRecording = async () => {
    if (permissionStatus !== "granted") {
      await handleRequestPermission();
      return;
    }

    try {
      const success = await startRecording();
      
      if (!success) {
        toast.error("无法开始录音");
        return;
      }

      setRecordingDuration(0);
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("录音失败");
    }
  };

  const handleStopRecording = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) {
        setAudioBlob(blob);
      }
    }
  };

  const handleSend = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);
    try {
      const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
      await onSend(file, recordingDuration);
      handleClose();
    } catch (error) {
      console.error("Failed to send voice message:", error);
      toast.error("发送失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    if (isRecording) {
      await stopRecording();
    }
    setAudioBlob(null);
    setRecordingDuration(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-background/5 backdrop-blur-md rounded-lg overflow-hidden p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">语音消息</h3>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        {permissionStatus !== "granted" ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Mic className="h-16 w-16 text-muted-foreground" />
            <div>
              <h4 className="font-semibold mb-2">需要麦克风权限</h4>
              <p className="text-sm text-muted-foreground mb-4">
                请授予麦克风权限以录制语音消息
              </p>
            </div>
            <Button onClick={handleRequestPermission}>
              <Mic className="mr-2 h-4 w-4" />
              授予权限
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 py-8">
            {/* Recording Animation */}
            <div className="relative">
              <div className={`h-32 w-32 rounded-full border-4 flex items-center justify-center transition-colors ${
                isRecording ? "border-red-500 bg-red-500/10" : "border-primary bg-primary/10"
              }`}>
                <Mic className={`h-16 w-16 ${isRecording ? "text-red-500 animate-pulse" : "text-primary"}`} />
              </div>
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping"></div>
              )}
            </div>

            {/* Duration */}
            <div className="text-3xl font-mono font-bold">
              {formatDuration(recordingDuration)}
            </div>

            {/* Status Text */}
            <p className="text-sm text-muted-foreground">
              {!audioBlob && !isRecording && "点击开始录音"}
              {isRecording && "正在录音中..."}
              {audioBlob && !isRecording && "录音完成"}
            </p>

            {/* Controls */}
            <div className="flex items-center gap-4 w-full">
              {!audioBlob && !isRecording && (
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handleStartRecording}
                >
                  <Mic className="mr-2 h-5 w-5" />
                  开始录音
                </Button>
              )}

              {isRecording && (
                <Button
                  className="flex-1"
                  size="lg"
                  variant="destructive"
                  onClick={handleStopRecording}
                >
                  <Square className="mr-2 h-5 w-5" />
                  停止录音
                </Button>
              )}

              {audioBlob && !isRecording && (
                <>
                  <Button
                    className="flex-1"
                    size="lg"
                    variant="outline"
                    onClick={handleReset}
                    disabled={isProcessing}
                  >
                    重新录制
                  </Button>
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={handleSend}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        发送中...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-5 w-5" />
                        发送
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
