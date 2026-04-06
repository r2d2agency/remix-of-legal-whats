import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AudioWaveform } from '@/components/chat/AudioWaveform';
import { Mic, Square, Pause, Play, Upload, X, FileText, Image, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpload } from '@/hooks/use-upload';
import { toast } from 'sonner';

interface RecordingModalProps {
  open: boolean;
  onClose: () => void;
  onFinish: (audioBlob: Blob, reason: string, notes: string, duration: number, attachments: Array<{ name: string; url: string; type: string }>) => void;
  sessionTitle?: string;
}

export function RecordingModal({ open, onClose, onFinish, sessionTitle }: RecordingModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(20).fill(0));
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string; type: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile } = useUpload();

  const updateLevels = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    const bands = 20;
    const bandSize = Math.floor(dataArray.length / bands);
    const levels: number[] = [];
    for (let i = 0; i < bands; i++) {
      let sum = 0;
      for (let j = 0; j < bandSize; j++) sum += dataArray[i * bandSize + j];
      levels.push(sum / (bandSize * 255));
    }
    setAudioLevels(levels);
    animFrameRef.current = requestAnimationFrame(updateLevels);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/wav';

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      animFrameRef.current = requestAnimationFrame(updateLevels);
    } catch (e) {
      toast.error('Erro ao acessar microfone');
    }
  }, [updateLevels]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; analyserRef.current = null; }
  }, []);

  const finishRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    const recorder = mediaRecorderRef.current;
    const finalDuration = duration;
    recorder.onstop = () => {
      const mime = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mime });
      cleanup();
      setIsRecording(false);
      setIsPaused(false);
      onFinish(blob, reason, notes, finalDuration, attachments);
    };
    recorder.stop();
  }, [duration, reason, notes, attachments, cleanup, onFinish]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    cleanup();
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    chunksRef.current = [];
    onClose();
  }, [cleanup, onClose]);

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  const handleFilesDrop = useCallback(async (files: FileList | File[]) => {
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadFile(file);
        if (url) {
          setAttachments(prev => [...prev, { name: file.name, url, type: file.type }]);
        }
      }
    } finally {
      setIsUploading(false);
    }
  }, [uploadFile]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 gap-0" onInteractOutside={e => e.preventDefault()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Gravação - {sessionTitle || 'Nova Sessão'}</h2>
            <p className="text-sm text-muted-foreground">Teleatendimento</p>
          </div>
          <Button variant="ghost" size="icon" onClick={cancelRecording}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Timer + Waveform */}
          <div className="flex flex-col items-center space-y-4">
            <div className={cn(
              "text-5xl font-mono font-bold tabular-nums",
              isRecording && !isPaused ? "text-destructive animate-pulse" : "text-foreground"
            )}>
              {formatTime(duration)}
            </div>

            {isRecording && (
              <div className="w-full max-w-md">
                <AudioWaveform levels={audioLevels} className="justify-center" />
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-4">
              {!isRecording ? (
                <Button size="lg" onClick={startRecording} className="gap-2">
                  <Mic className="h-5 w-5" /> Iniciar Gravação
                </Button>
              ) : (
                <>
                  {isPaused ? (
                    <Button size="lg" variant="outline" onClick={resumeRecording} className="gap-2">
                      <Play className="h-5 w-5" /> Retomar
                    </Button>
                  ) : (
                    <Button size="lg" variant="outline" onClick={pauseRecording} className="gap-2">
                      <Pause className="h-5 w-5" /> Pausar
                    </Button>
                  )}
                  <Button size="lg" variant="destructive" onClick={finishRecording} className="gap-2">
                    <Square className="h-5 w-5" /> Finalizar
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Motivo da Reunião</label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Consulta de retorno, Alinhamento de projeto..." />
            </div>
            <div>
              <label className="text-sm font-medium">Anotações Livres</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anotações durante a reunião..." rows={4} />
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="text-sm font-medium mb-2 block">Documentos Anexos</label>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => { e.preventDefault(); setIsDragOver(false); handleFilesDrop(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Arraste e solte PDFs ou imagens aqui, ou clique para selecionar
              </p>
              <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={e => e.target.files && handleFilesDrop(e.target.files)} />
            </div>
            {isUploading && <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</div>}
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    {att.type.startsWith('image/') ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    <span className="text-sm flex-1 truncate">{att.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security notice */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Áudio armazenado por no máximo 24h e excluído automaticamente após processamento.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
