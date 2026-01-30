import { useState, useRef, useCallback } from 'react';

interface TranscriptionState {
  isTranscribing: boolean;
  isLoadingModel: boolean;
  progress: number;
  transcript: string | null;
  error: string | null;
}

// Store pipeline globally to avoid reloading the model
let pipelinePromise: Promise<any> | null = null;

export function useWhisperTranscription() {
  const [state, setState] = useState<TranscriptionState>({
    isTranscribing: false,
    isLoadingModel: false,
    progress: 0,
    transcript: null,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadPipeline = useCallback(async () => {
    if (pipelinePromise) {
      return pipelinePromise;
    }

    setState(prev => ({ ...prev, isLoadingModel: true, progress: 0 }));

    try {
      // Dynamic import to avoid loading the large library on page load
      const { pipeline } = await import('@xenova/transformers');

      pipelinePromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
        progress_callback: (progress: any) => {
          if (progress.status === 'progress' && progress.progress) {
            setState(prev => ({ ...prev, progress: Math.round(progress.progress) }));
          }
        },
      });

      const result = await pipelinePromise;
      setState(prev => ({ ...prev, isLoadingModel: false, progress: 100 }));
      return result;
    } catch (error) {
      pipelinePromise = null;
      setState(prev => ({
        ...prev,
        isLoadingModel: false,
        error: 'Erro ao carregar modelo de transcrição',
      }));
      throw error;
    }
  }, []);

  const transcribe = useCallback(async (audioUrl: string): Promise<string | null> => {
    setState(prev => ({
      ...prev,
      isTranscribing: true,
      transcript: null,
      error: null,
    }));

    abortControllerRef.current = new AbortController();

    try {
      // Load the pipeline if not already loaded
      const transcriber = await loadPipeline();

      // Fetch the audio file
      const response = await fetch(audioUrl, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Erro ao baixar áudio');
      }

      const audioData = await response.arrayBuffer();

      // Decode audio to get raw samples
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(audioData);

      // Get audio data as Float32Array (mono, 16kHz)
      const audioSamples = audioBuffer.getChannelData(0);

      // Transcribe
      const result = await transcriber(audioSamples, {
        language: 'portuguese',
        task: 'transcribe',
      });

      const transcript = result.text?.trim() || '';

      setState(prev => ({
        ...prev,
        isTranscribing: false,
        transcript,
      }));

      await audioContext.close();

      return transcript;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setState(prev => ({
          ...prev,
          isTranscribing: false,
          error: null,
        }));
        return null;
      }

      const errorMessage = error.message || 'Erro ao transcrever áudio';
      setState(prev => ({
        ...prev,
        isTranscribing: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [loadPipeline]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isTranscribing: false,
      error: null,
    }));
  }, []);

  const clearState = useCallback(() => {
    setState({
      isTranscribing: false,
      isLoadingModel: false,
      progress: 0,
      transcript: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    transcribe,
    cancel,
    clearState,
    isModelLoaded: !!pipelinePromise,
  };
}
