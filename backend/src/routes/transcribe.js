// Transcription route
import express from 'express';
import multer from 'multer';
// form-data replaced by native FormData
import { authenticate } from '../middleware/auth.js';
import { query } from '../db.js';
import { callAI } from '../lib/ai-caller.js';
import { log, logError } from '../logger.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Get AI config from organization
async function getAIConfig(userId) {
  // Get user's organization
  const orgResult = await query(
    `SELECT o.ai_provider, o.ai_model, o.ai_api_key 
     FROM organizations o
     JOIN organization_members om ON om.organization_id = o.id
     WHERE om.user_id = $1 LIMIT 1`,
    [userId]
  );

  const org = orgResult.rows[0];
  if (!org || !org.ai_api_key || org.ai_provider === 'none') {
    return null;
  }

  return {
    provider: org.ai_provider,
    model: org.ai_model || (org.ai_provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash'),
    apiKey: org.ai_api_key,
  };
}

// POST /api/transcribe-audio - Transcribe audio using org AI config
router.post('/', authenticate, upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const aiConfig = await getAIConfig(req.userId);
    if (!aiConfig) {
      return res.status(400).json({ 
        error: 'IA não configurada. Configure a chave de IA nas configurações da organização.' 
      });
    }

    // Convert audio to base64
    const base64Audio = audioFile.buffer.toString('base64');
    const mimeType = audioFile.mimetype || 'audio/ogg';

    // Determine audio format - OpenAI only supports 'wav' and 'mp3'
    // Gemini supports more formats
    let audioFormat;
    if (aiConfig.provider === 'openai') {
      // OpenAI: only wav and mp3 supported, default to mp3 for unsupported formats
      audioFormat = mimeType.includes('wav') ? 'wav' : 'mp3';
    } else {
      // Gemini: supports ogg, webm, mp3, wav
      audioFormat = mimeType.includes('mp3') ? 'mp3' :
                    mimeType.includes('wav') ? 'wav' :
                    mimeType.includes('ogg') ? 'ogg' :
                    mimeType.includes('webm') ? 'webm' : 'mp3';
    }

    log('info', 'transcribe.start', {
      size: audioFile.size,
      mimetype: mimeType,
      provider: aiConfig.provider,
      audioFormat,
    });

    let transcript;

    if (aiConfig.provider === 'openai') {
      // OpenAI: use Whisper API for transcription via form-data (Node.js compatible)
      const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('webm') ? 'webm' : 'mp3';
      const formData = new FormData();
      formData.append('file', audioFile.buffer, {
        filename: `audio.${ext}`,
        contentType: mimeType,
      });
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (!whisperRes.ok) {
        const errText = await whisperRes.text();
        throw new Error(`Whisper API error ${whisperRes.status}: ${errText}`);
      }

      const whisperData = await whisperRes.json();
      transcript = whisperData.text?.trim() || '[Áudio inaudível]';
    } else {
      // Gemini: use multimodal chat with inline audio
      const messages = [
        {
          role: 'system',
          content: 'Você é um transcritor de áudio profissional. Transcreva o áudio fornecido com precisão, mantendo pontuação adequada. Retorne APENAS o texto transcrito, sem explicações ou comentários adicionais. Se o áudio estiver vazio ou inaudível, retorne "[Áudio inaudível]".'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcreva o seguinte áudio em português:' },
            {
              type: 'input_audio',
              input_audio: { data: base64Audio, format: audioFormat }
            }
          ]
        }
      ];

      const result = await callAI(aiConfig, messages, { temperature: 0.1, maxTokens: 4000 });
      transcript = result.content?.trim() || '[Áudio inaudível]';
    }

    log('info', 'transcribe.success', {
      transcriptLength: transcript.length,
      preview: transcript.substring(0, 50),
      provider: aiConfig.provider,
    });

    // Save transcript to message if messageId provided
    const messageId = req.body?.messageId || req.query?.messageId;
    if (messageId && transcript && transcript !== '[Áudio inaudível]') {
      try {
        await query(
          `UPDATE chat_messages SET transcript = $1 WHERE id = $2`,
          [transcript, messageId]
        );
        log('info', 'transcribe.saved_to_db', { messageId });
      } catch (dbErr) {
        logError('transcribe.save_db_error', dbErr);
      }
    }

    res.json({ transcript });
  } catch (error) {
    logError('transcribe.error', error);
    res.status(500).json({
      error: error.message || 'Erro ao transcrever áudio'
    });
  }
});

export default router;
