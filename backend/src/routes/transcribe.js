import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import { log, logError } from '../logger.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// POST /api/transcribe-audio - Transcribe audio using Lovable AI (Gemini)
router.post('/', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file;
    
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      logError('transcribe.missing_api_key', new Error('LOVABLE_API_KEY not configured'));
      return res.status(500).json({ error: 'Transcription service not configured' });
    }

    // Convert audio to base64
    const base64Audio = audioFile.buffer.toString('base64');
    const mimeType = audioFile.mimetype || 'audio/ogg';

    log('info', 'transcribe.start', {
      size: audioFile.size,
      mimetype: mimeType,
      originalName: audioFile.originalname
    });

    // Use Lovable AI (Gemini) for transcription
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um transcritor de áudio profissional. Transcreva o áudio fornecido com precisão, mantendo pontuação adequada. Retorne APENAS o texto transcrito, sem explicações ou comentários adicionais. Se o áudio estiver vazio ou inaudível, retorne "[Áudio inaudível]".'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcreva o seguinte áudio em português:'
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: base64Audio,
                  format: mimeType.includes('mp3') ? 'mp3' : 
                          mimeType.includes('wav') ? 'wav' :
                          mimeType.includes('ogg') ? 'ogg' :
                          mimeType.includes('webm') ? 'webm' : 'mp3'
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError('transcribe.ai_error', new Error(`AI gateway error: ${response.status}`), {
        status: response.status,
        body: errorText
      });

      if (response.status === 429) {
        return res.status(429).json({ 
          error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' 
        });
      }

      if (response.status === 402) {
        return res.status(402).json({ 
          error: 'Créditos insuficientes. Adicione créditos em Configurações > Workspace > Uso.' 
        });
      }

      return res.status(500).json({ error: 'Erro no serviço de transcrição' });
    }

    const data = await response.json();
    const transcript = data.choices?.[0]?.message?.content?.trim() || '';

    log('info', 'transcribe.success', {
      transcriptLength: transcript.length,
      preview: transcript.substring(0, 50)
    });

    res.json({ transcript });
  } catch (error) {
    logError('transcribe.error', error);
    res.status(500).json({ 
      error: error.message || 'Erro ao transcrever áudio' 
    });
  }
});

export default router;
