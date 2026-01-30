import { useState, useRef, useCallback, useEffect } from 'react';

interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
}

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useSpeechRecognition() {
  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    isSupported: false,
    error: null,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isStoppingRef = useRef(false);

  // Check for browser support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setState(prev => ({ ...prev, isSupported: !!SpeechRecognitionAPI }));
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      setState(prev => ({ 
        ...prev, 
        error: 'Navegador não suporta reconhecimento de voz. Use Chrome, Edge ou Safari.' 
      }));
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    isStoppingRef.current = false;
    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState(prev => ({ 
        ...prev, 
        isListening: true, 
        error: null,
        transcript: '',
        interimTranscript: '',
      }));
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setState(prev => ({
        ...prev,
        transcript: prev.transcript + finalTranscript,
        interimTranscript,
      }));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Erro no reconhecimento de voz';
      
      switch (event.error) {
        case 'not-allowed':
          errorMessage = 'Permissão de microfone negada. Habilite nas configurações do navegador.';
          break;
        case 'no-speech':
          errorMessage = 'Nenhuma fala detectada. Tente novamente.';
          break;
        case 'audio-capture':
          errorMessage = 'Microfone não encontrado ou em uso.';
          break;
        case 'network':
          errorMessage = 'Erro de rede. Verifique sua conexão.';
          break;
        case 'aborted':
          // User stopped, not an error
          return;
      }

      setState(prev => ({ 
        ...prev, 
        isListening: false,
        error: errorMessage,
      }));
    };

    recognition.onend = () => {
      // Only restart if we're supposed to be listening and not manually stopping
      if (!isStoppingRef.current && state.isListening) {
        try {
          recognition.start();
        } catch {
          // Ignore - recognition may have been stopped
        }
      } else {
        setState(prev => ({ ...prev, isListening: false }));
      }
    };

    try {
      recognition.start();
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Erro ao iniciar reconhecimento de voz',
        isListening: false,
      }));
    }
  }, [state.isListening]);

  const stopListening = useCallback((): string => {
    isStoppingRef.current = true;
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const finalText = state.transcript + state.interimTranscript;
    
    setState(prev => ({ 
      ...prev, 
      isListening: false,
      interimTranscript: '',
    }));

    return finalText;
  }, [state.transcript, state.interimTranscript]);

  const cancelListening = useCallback(() => {
    isStoppingRef.current = true;
    
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    setState(prev => ({ 
      ...prev, 
      isListening: false,
      transcript: '',
      interimTranscript: '',
      error: null,
    }));
  }, []);

  const clearTranscript = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      transcript: '',
      interimTranscript: '',
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    fullTranscript: state.transcript + state.interimTranscript,
    startListening,
    stopListening,
    cancelListening,
    clearTranscript,
    clearError,
  };
}
