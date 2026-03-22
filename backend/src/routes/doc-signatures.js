import { Router } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Helper: get org id for user
async function getUserOrgId(userId) {
  const r = await query(
    `SELECT o.id FROM organizations o JOIN organization_members om ON om.organization_id = o.id WHERE om.user_id = $1 LIMIT 1`,
    [userId]
  );
  return r.rows[0]?.id || null;
}

// Helper: audit log
async function auditLog(documentId, action, { name, email, ip, userAgent, geolocation, details }) {
  await query(
    `INSERT INTO doc_signature_audit (document_id, action, actor_name, actor_email, ip_address, user_agent, geolocation, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [documentId, action, name || null, email || null, ip || null, userAgent || null, geolocation || null, JSON.stringify(details || {})]
  );
}

// Ensure tables exist
async function ensureTables() {
  try {
    await query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS has_doc_signatures BOOLEAN DEFAULT false`);
    
    await query(`CREATE TABLE IF NOT EXISTS doc_signature_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      file_url TEXT NOT NULL,
      signed_file_url TEXT,
      status VARCHAR(20) DEFAULT 'draft',
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      hash_sha256 VARCHAR(64),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS doc_signature_signers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID REFERENCES doc_signature_documents(id) ON DELETE CASCADE NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      cpf VARCHAR(14) NOT NULL,
      role VARCHAR(20) DEFAULT 'signer',
      sign_order INTEGER DEFAULT 1,
      status VARCHAR(20) DEFAULT 'pending',
      signature_url TEXT,
      signed_at TIMESTAMP WITH TIME ZONE,
      sign_token VARCHAR(128) UNIQUE NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      geolocation TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS doc_signature_positions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID REFERENCES doc_signature_documents(id) ON DELETE CASCADE NOT NULL,
      signer_id UUID REFERENCES doc_signature_signers(id) ON DELETE CASCADE NOT NULL,
      page INTEGER NOT NULL DEFAULT 1,
      x DECIMAL(10, 4) NOT NULL,
      y DECIMAL(10, 4) NOT NULL,
      width DECIMAL(10, 4) NOT NULL DEFAULT 200,
      height DECIMAL(10, 4) NOT NULL DEFAULT 80
    )`);

    await query(`CREATE TABLE IF NOT EXISTS doc_signature_audit (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID REFERENCES doc_signature_documents(id) ON DELETE CASCADE NOT NULL,
      action VARCHAR(100) NOT NULL,
      actor_name VARCHAR(255),
      actor_email VARCHAR(255),
      ip_address VARCHAR(45),
      user_agent TEXT,
      geolocation TEXT,
      details JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

    await query(`CREATE INDEX IF NOT EXISTS idx_doc_sig_signers_token ON doc_signature_signers(sign_token)`);

    // OTP verification table
    await query(`CREATE TABLE IF NOT EXISTS doc_signature_otp (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      signer_id UUID REFERENCES doc_signature_signers(id) ON DELETE CASCADE NOT NULL,
      code VARCHAR(6) NOT NULL,
      verified BOOLEAN DEFAULT false,
      attempts INTEGER DEFAULT 0,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

  } catch (e) {
    console.error('[doc-signatures] Table init error:', e.message);
  }
}

ensureTables();

// Encryption for SMTP passwords (must match email.js)
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'whatsale-email-key-32chars!!';
const ALGORITHM = 'aes-256-cbc';

function decryptPassword(encryptedPassword) {
  try {
    const [ivHex, encrypted] = encryptedPassword.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedPassword; // fallback: assume plain text
  }
}

// Helper: get SMTP config for org (with system fallback)
async function getSmtpConfig(orgId) {
  // 1. Try org SMTP
  if (orgId) {
    const r = await query(`SELECT * FROM email_smtp_configs WHERE organization_id = $1 AND is_active = true LIMIT 1`, [orgId]);
    if (r.rows[0]) return r.rows[0];
  }

  // 2. Try any active org SMTP
  const r2 = await query(`SELECT * FROM email_smtp_configs WHERE is_active = true LIMIT 1`);
  if (r2.rows[0]) return r2.rows[0];

  // 3. Fallback: system-level SMTP from system_settings
  const r3 = await query(`SELECT value FROM system_settings WHERE key = 'doc_signature_smtp'`);
  if (r3.rows[0]?.value) {
    try {
      const config = JSON.parse(r3.rows[0].value);
      return config; // has host, port, secure, username, password_encrypted, from_name, from_email
    } catch {}
  }

  return null;
}

  try {
    const transporter = createTransporter(smtpConfig);
    await transporter.sendMail({
      from: `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`,
      to: signerEmail,
      subject: `Código de verificação - ${docTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">Verificação de Identidade</h2>
          <p>Olá <strong>${signerName}</strong>,</p>
          <p>Você está acessando o documento <strong>"${docTitle}"</strong> para assinatura.</p>
          <p>Seu código de verificação é:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f4f4f5; padding: 16px 32px; border-radius: 8px; display: inline-block;">${code}</span>
          </div>
          <p style="color: #666; font-size: 13px;">Este código é válido por <strong>10 minutos</strong>. Não compartilhe com ninguém.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 11px; text-align: center;">Se você não solicitou este código, ignore este e-mail.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('[doc-signatures] OTP email error:', err.message);
    return false;
  }
}

// ===========================
// PUBLIC ROUTES (before auth)
// ===========================

// Step 1: Request OTP - sends verification code to signer's email
router.post('/sign/:token/request-otp', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await query(
      `SELECT s.*, d.title, d.description, d.status as doc_status, d.organization_id,
              o.name as org_name, o.logo_url as org_logo_url
       FROM doc_signature_signers s
       JOIN doc_signature_documents d ON d.id = s.document_id
       LEFT JOIN organizations o ON o.id = d.organization_id
       WHERE s.sign_token = $1`,
      [token]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Link inválido ou expirado' });

    const signer = result.rows[0];
    if (signer.doc_status !== 'pending') return res.status(400).json({ error: 'Documento não está disponível para assinatura' });
    if (signer.status === 'signed') return res.status(400).json({ error: 'Você já assinou este documento' });

    // Invalidate old OTPs
    await query(`UPDATE doc_signature_otp SET verified = true WHERE signer_id = $1 AND verified = false`, [signer.id]);

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await query(
      `INSERT INTO doc_signature_otp (signer_id, code, expires_at) VALUES ($1, $2, $3)`,
      [signer.id, code, expiresAt]
    );

    // Mask email for display
    const emailParts = signer.email.split('@');
    const maskedLocal = emailParts[0].slice(0, 2) + '***';
    const maskedEmail = `${maskedLocal}@${emailParts[1]}`;

    // Send email
    const sent = await sendOtpEmail(signer.email, signer.name, code, signer.title, signer.organization_id);
    if (!sent) return res.status(500).json({ error: 'Erro ao enviar código de verificação. Tente novamente.' });

    res.json({
      success: true,
      masked_email: maskedEmail,
      signer_name: signer.name,
      document_title: signer.title,
      document_description: signer.description || null,
      org_name: signer.org_name || null,
      org_logo_url: signer.org_logo_url || null,
    });
  } catch (error) {
    console.error('[doc-signatures] Request OTP error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Step 2: Verify OTP
router.post('/sign/:token/verify-otp', async (req, res) => {
  try {
    const { token } = req.params;
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Código é obrigatório' });

    const signerResult = await query(
      `SELECT s.id, s.status, d.status as doc_status
       FROM doc_signature_signers s
       JOIN doc_signature_documents d ON d.id = s.document_id
       WHERE s.sign_token = $1`,
      [token]
    );
    if (signerResult.rows.length === 0) return res.status(404).json({ error: 'Link inválido' });

    const signer = signerResult.rows[0];

    // Find valid OTP
    const otpResult = await query(
      `SELECT * FROM doc_signature_otp
       WHERE signer_id = $1 AND verified = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [signer.id]
    );

    if (otpResult.rows.length === 0) return res.status(400).json({ error: 'Código expirado. Solicite um novo.' });

    const otp = otpResult.rows[0];

    // Increment attempts
    await query(`UPDATE doc_signature_otp SET attempts = attempts + 1 WHERE id = $1`, [otp.id]);

    if (otp.attempts >= 5) {
      await query(`UPDATE doc_signature_otp SET verified = true WHERE id = $1`, [otp.id]);
      return res.status(400).json({ error: 'Muitas tentativas. Solicite um novo código.' });
    }

    if (otp.code !== code.trim()) {
      return res.status(400).json({ error: `Código incorreto. ${4 - otp.attempts} tentativa(s) restante(s).` });
    }

    // Mark as verified
    await query(`UPDATE doc_signature_otp SET verified = true WHERE id = $1`, [otp.id]);

    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('[doc-signatures] Verify OTP error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Get signing data by token (now requires OTP verification)
router.get('/sign/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await query(
      `SELECT s.*, d.title, d.description, d.file_url, d.status as doc_status, d.organization_id,
              o.name as org_name, o.logo_url as org_logo_url
       FROM doc_signature_signers s
       JOIN doc_signature_documents d ON d.id = s.document_id
       LEFT JOIN organizations o ON o.id = d.organization_id
       WHERE s.sign_token = $1`,
      [token]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Link inválido ou expirado' });
    
    const signer = result.rows[0];
    if (signer.doc_status !== 'pending') return res.status(400).json({ error: 'Documento não está mais disponível para assinatura' });
    if (signer.status === 'signed') return res.status(400).json({ error: 'Você já assinou este documento' });

    // Check if OTP was verified recently (last 30 minutes)
    const otpCheck = await query(
      `SELECT id FROM doc_signature_otp
       WHERE signer_id = $1 AND verified = true AND created_at > NOW() - INTERVAL '30 minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [signer.id]
    );
    if (otpCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Verificação de identidade necessária', require_otp: true });
    }

    // Get positions for this signer
    const posResult = await query(
      `SELECT * FROM doc_signature_positions WHERE signer_id = $1`,
      [signer.id]
    );

    res.json({
      document_title: signer.title,
      document_description: signer.description || null,
      file_url: signer.file_url,
      org_name: signer.org_name || null,
      org_logo_url: signer.org_logo_url || null,
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        cpf: signer.cpf,
        role: signer.role,
      },
      positions: posResult.rows,
    });
  } catch (error) {
    console.error('[doc-signatures] Get sign data error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Submit signature (public)
router.post('/sign/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { signature_image, cpf, full_name, geolocation } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!signature_image) return res.status(400).json({ error: 'Assinatura é obrigatória' });
    if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório' });

    // Validate signer
    const signerResult = await query(
      `SELECT s.*, d.id as doc_id, d.status as doc_status
       FROM doc_signature_signers s
       JOIN doc_signature_documents d ON d.id = s.document_id
       WHERE s.sign_token = $1`,
      [token]
    );
    if (signerResult.rows.length === 0) return res.status(404).json({ error: 'Link inválido' });

    const signer = signerResult.rows[0];
    if (signer.doc_status !== 'pending') return res.status(400).json({ error: 'Documento não disponível' });
    if (signer.status === 'signed') return res.status(400).json({ error: 'Já assinado' });

    // Validate CPF matches
    const cleanCpf = cpf.replace(/\D/g, '');
    const signerCleanCpf = signer.cpf.replace(/\D/g, '');
    if (cleanCpf !== signerCleanCpf) return res.status(400).json({ error: 'CPF não confere com o cadastrado' });

    // Update signer
    await query(
      `UPDATE doc_signature_signers 
       SET status = 'signed', signature_url = $1, signed_at = NOW(), 
           ip_address = $2, user_agent = $3, geolocation = $4
       WHERE id = $5`,
      [signature_image, ip, userAgent, geolocation || null, signer.id]
    );

    // Audit log
    await auditLog(signer.doc_id, 'signature_submitted', {
      name: full_name || signer.name,
      email: signer.email,
      ip, userAgent, geolocation,
      details: { cpf: cleanCpf, signer_role: signer.role }
    });

    // Check if all signers have signed
    const pendingResult = await query(
      `SELECT COUNT(*) as pending FROM doc_signature_signers WHERE document_id = $1 AND status = 'pending'`,
      [signer.doc_id]
    );

    if (parseInt(pendingResult.rows[0].pending) === 0) {
      await query(`UPDATE doc_signature_documents SET status = 'completed', updated_at = NOW() WHERE id = $1`, [signer.doc_id]);
      await auditLog(signer.doc_id, 'document_completed', {
        name: 'Sistema', email: 'system', ip, userAgent,
        details: { completed_at: new Date().toISOString() }
      });
    }

    // Return download URL so signer can download
    const docResult = await query(`SELECT file_url, signed_file_url FROM doc_signature_documents WHERE id = $1`, [signer.doc_id]);
    const downloadUrl = docResult.rows[0]?.signed_file_url || docResult.rows[0]?.file_url;

    res.json({ success: true, download_url: downloadUrl });
  } catch (error) {
    console.error('[doc-signatures] Submit signature error:', error);
    res.status(500).json({ error: 'Erro ao processar assinatura' });
  }
});

// ===========================
// AUTHENTICATED ROUTES
// ===========================
router.use(authenticate);

// List documents
router.get('/', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });

    const result = await query(
      `SELECT d.*, u.name as creator_name,
              (SELECT COUNT(*) FROM doc_signature_signers WHERE document_id = d.id) as signers_count,
              (SELECT COUNT(*) FROM doc_signature_signers WHERE document_id = d.id AND status = 'signed') as signed_count
       FROM doc_signature_documents d
       LEFT JOIN users u ON u.id = d.created_by
       WHERE d.organization_id = $1
       ORDER BY d.created_at DESC`,
      [orgId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[doc-signatures] List error:', error);
    res.status(500).json({ error: 'Erro ao listar documentos' });
  }
});

// Get document detail
router.get('/:id', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    const docResult = await query(
      `SELECT d.*, u.name as creator_name FROM doc_signature_documents d LEFT JOIN users u ON u.id = d.created_by WHERE d.id = $1 AND d.organization_id = $2`,
      [req.params.id, orgId]
    );
    if (docResult.rows.length === 0) return res.status(404).json({ error: 'Documento não encontrado' });

    const signersResult = await query(`SELECT * FROM doc_signature_signers WHERE document_id = $1 ORDER BY sign_order`, [req.params.id]);
    const positionsResult = await query(`SELECT * FROM doc_signature_positions WHERE document_id = $1`, [req.params.id]);
    const auditResult = await query(`SELECT * FROM doc_signature_audit WHERE document_id = $1 ORDER BY created_at DESC`, [req.params.id]);

    res.json({
      document: docResult.rows[0],
      signers: signersResult.rows,
      positions: positionsResult.rows,
      audit: auditResult.rows,
    });
  } catch (error) {
    console.error('[doc-signatures] Get detail error:', error);
    res.status(500).json({ error: 'Erro ao buscar documento' });
  }
});

// Create document
router.post('/', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });

    const { title, description, file_url } = req.body;
    if (!title || !file_url) return res.status(400).json({ error: 'Título e arquivo são obrigatórios' });

    const userResult = await query(`SELECT name, email FROM users WHERE id = $1`, [req.userId]);
    const user = userResult.rows[0];

    const result = await query(
      `INSERT INTO doc_signature_documents (organization_id, title, description, file_url, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orgId, title, description || null, file_url, req.userId]
    );

    const doc = result.rows[0];

    await auditLog(doc.id, 'document_created', {
      name: user?.name, email: user?.email,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      details: { title, file_url }
    });

    res.status(201).json(doc);
  } catch (error) {
    console.error('[doc-signatures] Create error:', error);
    res.status(500).json({ error: 'Erro ao criar documento' });
  }
});

// Add signer
router.post('/:id/signers', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    const docCheck = await query(`SELECT id, status FROM doc_signature_documents WHERE id = $1 AND organization_id = $2`, [req.params.id, orgId]);
    if (docCheck.rows.length === 0) return res.status(404).json({ error: 'Documento não encontrado' });
    if (docCheck.rows[0].status !== 'draft') return res.status(400).json({ error: 'Documento já enviado para assinatura' });

    const { name, email, cpf, role, sign_order } = req.body;
    if (!name || !email || !cpf) return res.status(400).json({ error: 'Nome, email e CPF são obrigatórios' });

    const signToken = crypto.randomBytes(48).toString('hex');

    const result = await query(
      `INSERT INTO doc_signature_signers (document_id, name, email, cpf, role, sign_order, sign_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.id, name, email, cpf, role || 'signer', sign_order || 1, signToken]
    );

    const userResult = await query(`SELECT name, email FROM users WHERE id = $1`, [req.userId]);
    await auditLog(req.params.id, 'signer_added', {
      name: userResult.rows[0]?.name, email: userResult.rows[0]?.email,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      details: { signer_name: name, signer_email: email, signer_cpf: cpf }
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[doc-signatures] Add signer error:', error);
    res.status(500).json({ error: 'Erro ao adicionar signatário' });
  }
});

// Remove signer
router.delete('/:id/signers/:signerId', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    const docCheck = await query(`SELECT id, status FROM doc_signature_documents WHERE id = $1 AND organization_id = $2`, [req.params.id, orgId]);
    if (docCheck.rows.length === 0) return res.status(404).json({ error: 'Documento não encontrado' });
    if (docCheck.rows[0].status !== 'draft') return res.status(400).json({ error: 'Não é possível alterar documento em andamento' });

    await query(`DELETE FROM doc_signature_signers WHERE id = $1 AND document_id = $2`, [req.params.signerId, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('[doc-signatures] Remove signer error:', error);
    res.status(500).json({ error: 'Erro ao remover signatário' });
  }
});

// Save signature positions
router.put('/:id/positions', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    const docCheck = await query(`SELECT id FROM doc_signature_documents WHERE id = $1 AND organization_id = $2`, [req.params.id, orgId]);
    if (docCheck.rows.length === 0) return res.status(404).json({ error: 'Documento não encontrado' });

    const { positions } = req.body;

    // Delete existing
    await query(`DELETE FROM doc_signature_positions WHERE document_id = $1`, [req.params.id]);

    // Insert new
    for (const pos of positions) {
      await query(
        `INSERT INTO doc_signature_positions (document_id, signer_id, page, x, y, width, height)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.params.id, pos.signer_id, pos.page, pos.x, pos.y, pos.width || 200, pos.height || 80]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[doc-signatures] Save positions error:', error);
    res.status(500).json({ error: 'Erro ao salvar posições' });
  }
});

// Send for signature
router.post('/:id/send', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    const docCheck = await query(
      `SELECT d.*, (SELECT COUNT(*) FROM doc_signature_signers WHERE document_id = d.id) as signers_count
       FROM doc_signature_documents d WHERE d.id = $1 AND d.organization_id = $2`,
      [req.params.id, orgId]
    );
    if (docCheck.rows.length === 0) return res.status(404).json({ error: 'Documento não encontrado' });
    
    const doc = docCheck.rows[0];
    if (doc.status !== 'draft') return res.status(400).json({ error: 'Documento já foi enviado' });
    if (parseInt(doc.signers_count) === 0) return res.status(400).json({ error: 'Adicione pelo menos um signatário' });

    await query(`UPDATE doc_signature_documents SET status = 'pending', updated_at = NOW() WHERE id = $1`, [req.params.id]);

    const userResult = await query(`SELECT name, email FROM users WHERE id = $1`, [req.userId]);
    await auditLog(req.params.id, 'document_sent', {
      name: userResult.rows[0]?.name, email: userResult.rows[0]?.email,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      details: { signers_count: doc.signers_count }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[doc-signatures] Send error:', error);
    res.status(500).json({ error: 'Erro ao enviar documento' });
  }
});

// Cancel document
router.post('/:id/cancel', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    await query(`UPDATE doc_signature_documents SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, [req.params.id, orgId]);

    const userResult = await query(`SELECT name, email FROM users WHERE id = $1`, [req.userId]);
    await auditLog(req.params.id, 'document_cancelled', {
      name: userResult.rows[0]?.name, email: userResult.rows[0]?.email,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[doc-signatures] Cancel error:', error);
    res.status(500).json({ error: 'Erro ao cancelar documento' });
  }
});

// Download / get signed PDF url
router.get('/:id/download', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    const result = await query(
      `SELECT file_url, signed_file_url, status FROM doc_signature_documents WHERE id = $1 AND organization_id = $2`,
      [req.params.id, orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Documento não encontrado' });
    
    const doc = result.rows[0];
    res.json({ url: doc.signed_file_url || doc.file_url });
  } catch (error) {
    console.error('[doc-signatures] Download error:', error);
    res.status(500).json({ error: 'Erro ao baixar documento' });
  }
});

export default router;
