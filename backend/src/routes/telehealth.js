import express from 'express';
import multer from 'multer';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logInfo, logError } from '../logger.js';
import { callAI } from '../lib/ai-caller.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'telehealth');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.webm`),
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

// Helper to get user's organization
async function getUserOrganization(userId) {
  const result = await query(
    `SELECT om.organization_id, om.role, u.name
     FROM organization_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.user_id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

// Init tables
async function ensureTables() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS telehealth_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      created_by UUID NOT NULL,
      title VARCHAR(500),
      reason TEXT,
      notes TEXT,
      contact_id UUID,
      contact_name VARCHAR(255),
      deal_id UUID,
      deal_title VARCHAR(255),
      status VARCHAR(30) NOT NULL DEFAULT 'waiting',
      audio_url TEXT,
      audio_size BIGINT,
      audio_duration INTEGER,
      audio_mime VARCHAR(100),
      transcript TEXT,
      structured_content JSONB,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      consent_given BOOLEAN DEFAULT false,
      attachments JSONB DEFAULT '[]'::jsonb,
      audio_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    )`);
    await query(`CREATE TABLE IF NOT EXISTS telehealth_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL,
      organization_id UUID NOT NULL,
      user_id UUID NOT NULL,
      user_name VARCHAR(255),
      action VARCHAR(100) NOT NULL,
      details JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    logInfo('Telehealth tables ensured');
  } catch (e) {
    logError('Failed to ensure telehealth tables', e);
  }
}
ensureTables();

async function auditLog(sessionId, orgId, userId, userName, action, details = null) {
  try {
    await query(
      `INSERT INTO telehealth_audit_logs (session_id, organization_id, user_id, user_name, action, details)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [sessionId, orgId, userId, userName, action, details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    logError('Audit log error', e);
  }
}

async function getAIConfig(userId) {
  try {
    const r = await query(
      `SELECT o.ai_provider, o.ai_model, o.ai_api_key
       FROM organizations o
       JOIN organization_members om ON om.organization_id = o.id
       WHERE om.user_id = $1 LIMIT 1`,
      [userId]
    );
    if (!r.rows.length || !r.rows[0].ai_api_key) return null;
    return { provider: r.rows[0].ai_provider || 'openai', model: r.rows[0].ai_model, apiKey: r.rows[0].ai_api_key };
  } catch { return null; }
}

// LIST sessions
router.get('/', authenticate, async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    const { status, contact_id, deal_id, search } = req.query;
    let sql = `SELECT * FROM telehealth_sessions WHERE organization_id = $1 AND deleted_at IS NULL`;
    const params = [org.organization_id];
    let idx = 2;
    if (status) { sql += ` AND status = $${idx++}`; params.push(status); }
    if (contact_id) { sql += ` AND contact_id = $${idx++}`; params.push(contact_id); }
    if (deal_id) { sql += ` AND deal_id = $${idx++}`; params.push(deal_id); }
    if (search) { sql += ` AND (title ILIKE $${idx} OR contact_name ILIKE $${idx} OR reason ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    sql += ` ORDER BY created_at DESC LIMIT 100`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) {
    logError('List telehealth sessions error', e);
    res.status(500).json({ error: e.message });
  }
});

// GET single session
router.get('/:id', authenticate, async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    const r = await query(
      `SELECT * FROM telehealth_sessions WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [req.params.id, org.organization_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    const logs = await query(
      `SELECT * FROM telehealth_audit_logs WHERE session_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ ...r.rows[0], audit_logs: logs.rows });
  } catch (e) {
    logError('Get telehealth session error', e);
    res.status(500).json({ error: e.message });
  }
});

// CREATE session
router.post('/', authenticate, async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    const { title, reason, contact_id, contact_name, deal_id, deal_title, consent_given } = req.body;
    const r = await query(
      `INSERT INTO telehealth_sessions (organization_id, created_by, title, reason, contact_id, contact_name, deal_id, deal_title, consent_given)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [org.organization_id, req.userId, title, reason, contact_id || null, contact_name || null, deal_id || null, deal_title || null, consent_given || false]
    );
    await auditLog(r.rows[0].id, org.organization_id, req.userId, org.name, 'session_created');
    res.json(r.rows[0]);
  } catch (e) {
    logError('Create telehealth session error', e);
    res.status(500).json({ error: e.message });
  }
});

// UPDATE session (notes, reason, attachments, etc)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    const allowed = ['title', 'reason', 'notes', 'contact_id', 'contact_name', 'deal_id', 'deal_title', 'consent_given', 'attachments', 'status'];
    const sets = [];
    const params = [];
    let idx = 1;
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(key === 'attachments' ? JSON.stringify(req.body[key]) : req.body[key]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });
    sets.push(`updated_at = NOW()`);
    params.push(req.params.id, org.organization_id);
    const r = await query(
      `UPDATE telehealth_sessions SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *`,
      params
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    await auditLog(r.rows[0].id, org.organization_id, req.userId, org.name, 'session_updated', { fields: Object.keys(req.body) });
    res.json(r.rows[0]);
  } catch (e) {
    logError('Update telehealth session error', e);
    res.status(500).json({ error: e.message });
  }
});

// UPLOAD audio
router.post('/:id/audio', authenticate, upload.single('audio'), async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    if (!req.file) return res.status(400).json({ error: 'Arquivo de áudio obrigatório' });
    const reason = req.headers['x-session-reason'] || '';
    const notes = req.headers['x-session-notes'] || '';
    const duration = parseInt(req.headers['x-session-duration'] || '0');
    const audioUrl = `/uploads/telehealth/${req.file.filename}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const r = await query(
      `UPDATE telehealth_sessions SET
        audio_url = $1, audio_size = $2, audio_duration = $3, audio_mime = $4,
        reason = COALESCE(NULLIF($5,''), reason), notes = COALESCE(NULLIF($6,''), notes),
        status = 'processing', audio_expires_at = $7, updated_at = NOW()
       WHERE id = $8 AND organization_id = $9 RETURNING *`,
      [audioUrl, req.file.size, duration, req.file.mimetype, reason, notes, expiresAt, req.params.id, org.organization_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    await auditLog(r.rows[0].id, org.organization_id, req.userId, org.name, 'audio_uploaded', { size: req.file.size, duration });

    // Start async processing
    processSession(r.rows[0].id, req.userId, org.organization_id, org.name).catch(e => logError('Process session error', e));

    res.json(r.rows[0]);
  } catch (e) {
    logError('Upload telehealth audio error', e);
    res.status(500).json({ error: e.message });
  }
});

// RETRY processing
router.post('/:id/retry', authenticate, async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    const r = await query(
      `UPDATE telehealth_sessions SET status = 'processing', error_message = NULL, retry_count = retry_count + 1, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND status = 'error' RETURNING *`,
      [req.params.id, org.organization_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Sessão não encontrada ou não está em erro' });
    await auditLog(r.rows[0].id, org.organization_id, req.userId, org.name, 'retry_processing');
    processSession(r.rows[0].id, req.userId, org.organization_id, org.name).catch(e => logError('Retry process error', e));
    res.json(r.rows[0]);
  } catch (e) {
    logError('Retry telehealth error', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE session (soft)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    const r = await query(
      `UPDATE telehealth_sessions SET deleted_at = NOW() WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [req.params.id, org.organization_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    await auditLog(req.params.id, org.organization_id, req.userId, org.name, 'session_deleted');
    res.json({ success: true });
  } catch (e) {
    logError('Delete telehealth session error', e);
    res.status(500).json({ error: e.message });
  }
});

// GET audit logs for session
router.get('/:id/audit', authenticate, async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    const r = await query(
      `SELECT * FROM telehealth_audit_logs WHERE session_id = $1 AND organization_id = $2 ORDER BY created_at ASC`,
      [req.params.id, org.organization_id]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Async processing pipeline - transcription only (no auto-organize)
async function processSession(sessionId, userId, orgId, userName) {
  try {
    // Step 1: Transcription
    await query(`UPDATE telehealth_sessions SET status = 'transcribing', updated_at = NOW() WHERE id = $1`, [sessionId]);
    await auditLog(sessionId, orgId, userId, userName, 'transcription_started');

    const session = (await query(`SELECT * FROM telehealth_sessions WHERE id = $1`, [sessionId])).rows[0];
    if (!session || !session.audio_url) throw new Error('Sessão ou áudio não encontrado');

    const audioPath = path.join(process.cwd(), session.audio_url);
    if (!fs.existsSync(audioPath)) throw new Error('Arquivo de áudio não encontrado no disco');

    const aiConfig = await getAIConfig(userId);
    if (!aiConfig) throw new Error('Configuração de IA não encontrada. Configure o provedor de IA nas configurações da organização.');

    let transcript = '';

    // Check file size - chunk if > 20MB
    const stats = fs.statSync(audioPath);
    if (stats.size > 20 * 1024 * 1024) {
      const chunkDir = path.join(uploadDir, `chunks-${sessionId}`);
      if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir, { recursive: true });
      try {
        execSync(`ffmpeg -i "${audioPath}" -f segment -segment_time 300 -c copy "${chunkDir}/chunk_%03d.webm"`, { timeout: 120000 });
        const chunks = fs.readdirSync(chunkDir).sort();
        for (const chunk of chunks) {
          const chunkPath = path.join(chunkDir, chunk);
          const chunkTranscript = await transcribeAudio(chunkPath, aiConfig);
          transcript += chunkTranscript + ' ';
        }
      } finally {
        fs.rmSync(chunkDir, { recursive: true, force: true });
      }
    } else {
      transcript = await transcribeAudio(audioPath, aiConfig);
    }

    // Complete after transcription - no auto-organize
    await query(
      `UPDATE telehealth_sessions SET transcript = $1, status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [transcript, sessionId]
    );
    await auditLog(sessionId, orgId, userId, userName, 'transcription_completed');

  } catch (e) {
    logError(`Telehealth processing error session=${sessionId}`, e);
    await query(
      `UPDATE telehealth_sessions SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [e.message, sessionId]
    );
    await auditLog(sessionId, orgId, userId, userName, 'processing_error', { error: e.message });
  }
}

async function transcribeAudio(audioPath, aiConfig) {
  if (aiConfig.provider === 'openai' || !aiConfig.provider) {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', fs.createReadStream(audioPath));
    form.append('model', 'whisper-1');
    form.append('language', 'pt');
    form.append('prompt', 'Identifique e diferencie os participantes da reunião quando possível, usando formatos como "Participante 1:", "João:", etc.');

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiConfig.apiKey}`, ...form.getHeaders() },
      body: form,
    });
    if (!resp.ok) throw new Error(`Whisper error: ${resp.status} ${await resp.text()}`);
    const data = await resp.json();
    return data.text || '';
  }

  // Gemini fallback
  const audioData = fs.readFileSync(audioPath).toString('base64');
  const messages = [
    { role: 'user', content: [
      { type: 'text', text: 'Transcreva o áudio a seguir em português. Identifique e diferencie os participantes quando possível (ex: "Participante 1:", "João:"). Retorne apenas a transcrição.' },
      { type: 'input_audio', input_audio: { data: audioData, format: 'webm' } }
    ]}
  ];
  const result = await callAI(aiConfig, messages, { temperature: 0.1, maxTokens: 8000 });
  return result || '';
}

// On-demand AI analysis of transcript
const AI_PROMPTS = {
  resumo: {
    label: 'Resumo da Reunião',
    prompt: `Analise a transcrição a seguir e gere um resumo executivo claro e objetivo da reunião. 
Identifique os participantes mencionados, os principais temas discutidos e as conclusões.
Retorne um JSON: { "titulo": "...", "participantes": ["..."], "resumo": "...", "pontos_principais": ["..."] }`
  },
  ata: {
    label: 'Ata da Reunião',
    prompt: `Analise a transcrição e gere uma ata formal da reunião em formato JSON:
{ "titulo": "...", "data": "...", "participantes": ["..."], "pauta": ["..."], "discussoes": [{"tema": "...", "detalhes": "..."}], "deliberacoes": ["..."], "encerramento": "..." }`
  },
  pendencias: {
    label: 'Pendências',
    prompt: `Analise a transcrição e identifique todas as pendências, itens em aberto e compromissos assumidos. 
Retorne JSON: { "pendencias": [{"descricao": "...", "responsavel": "...", "prazo": "...", "prioridade": "alta|media|baixa"}] }`
  },
  tarefas: {
    label: 'Tarefas e Ações',
    prompt: `Analise a transcrição e extraia TODAS as tarefas, ações a serem tomadas e próximos passos mencionados.
Retorne JSON: { "tarefas": [{"titulo": "...", "descricao": "...", "responsavel": "...", "prazo": "...", "prioridade": "alta|media|baixa"}], "retornos": [{"descricao": "...", "data_sugerida": "...", "participantes": ["..."]}] }`
  },
};

// POST /:id/analyze - on-demand AI analysis
router.post('/:id/analyze', authenticate, async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    const { prompt_type } = req.body;
    if (!prompt_type || !AI_PROMPTS[prompt_type]) {
      return res.status(400).json({ error: 'Tipo de análise inválido', available: Object.keys(AI_PROMPTS) });
    }

    const session = (await query(
      `SELECT * FROM telehealth_sessions WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [req.params.id, org.organization_id]
    )).rows[0];
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
    if (!session.transcript) return res.status(400).json({ error: 'Sessão ainda não possui transcrição' });

    const aiConfig = await getAIConfig(req.userId);
    if (!aiConfig) return res.status(400).json({ error: 'Configuração de IA não encontrada' });

    const promptConfig = AI_PROMPTS[prompt_type];
    const messages = [
      { role: 'system', content: `${promptConfig.prompt}\nRetorne APENAS o JSON, sem markdown ou texto adicional.` },
      { role: 'user', content: `Motivo da reunião: ${session.reason || 'Não informado'}\nAnotações: ${session.notes || 'Nenhuma'}\n\nTranscrição:\n${session.transcript}` }
    ];

    const result = await callAI(aiConfig, messages, { temperature: 0.2, maxTokens: 4000 });
    let parsed;
    try {
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { raw: result };
    }

    // Save to structured_content (merge with existing)
    const existing = session.structured_content || {};
    existing[prompt_type] = parsed;
    await query(
      `UPDATE telehealth_sessions SET structured_content = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(existing), session.id]
    );

    await auditLog(session.id, org.organization_id, req.userId, org.name, `ai_analysis_${prompt_type}`, { prompt_type });

    res.json({ type: prompt_type, data: parsed });
  } catch (e) {
    logError('Telehealth analyze error', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
