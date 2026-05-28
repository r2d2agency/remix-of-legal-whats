import { query } from '../db.js';

let salesSeoSchemaReadyPromise = null;

function normalizeSalesSeoText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function trackerMatchesMessage(messageContent, trackerPhrase) {
  const normalizedMessage = normalizeSalesSeoText(messageContent);
  const normalizedTrackerPhrase = normalizeSalesSeoText(trackerPhrase);

  if (!normalizedMessage || !normalizedTrackerPhrase) return false;

  return normalizedMessage.includes(normalizedTrackerPhrase);
}

async function ensureSalesSeoSchema() {
  if (!salesSeoSchemaReadyPromise) {
    salesSeoSchemaReadyPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS sales_seo_trackers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          phrase TEXT NOT NULL,
          connection_ids UUID[] DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS sales_seo_leads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          tracker_id UUID REFERENCES sales_seo_trackers(id) ON DELETE SET NULL,
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
          phone VARCHAR(50),
          entry_message TEXT,
          evolution_status INTEGER DEFAULT 1,
          ia_analysis JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        ALTER TABLE sales_seo_trackers ADD COLUMN IF NOT EXISTS connection_ids UUID[] DEFAULT '{}';
        ALTER TABLE sales_seo_trackers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
        ALTER TABLE sales_seo_trackers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

        ALTER TABLE sales_seo_leads ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES connections(id) ON DELETE SET NULL;
        ALTER TABLE sales_seo_leads ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
        ALTER TABLE sales_seo_leads ADD COLUMN IF NOT EXISTS entry_message TEXT;
        ALTER TABLE sales_seo_leads ADD COLUMN IF NOT EXISTS evolution_status INTEGER DEFAULT 1;
        ALTER TABLE sales_seo_leads ADD COLUMN IF NOT EXISTS ia_analysis JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE sales_seo_leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

        CREATE INDEX IF NOT EXISTS idx_sales_seo_trackers_org ON sales_seo_trackers(organization_id);
        CREATE INDEX IF NOT EXISTS idx_sales_seo_leads_org ON sales_seo_leads(organization_id);
        CREATE INDEX IF NOT EXISTS idx_sales_seo_leads_tracker ON sales_seo_leads(tracker_id);
        CREATE INDEX IF NOT EXISTS idx_sales_seo_leads_conv ON sales_seo_leads(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_sales_seo_leads_created ON sales_seo_leads(created_at DESC);
      `);
    })().catch((error) => {
      salesSeoSchemaReadyPromise = null;
      throw error;
    });
  }

  return salesSeoSchemaReadyPromise;
}

async function getConnectionOrganizationId(connectionId) {
  const result = await query(
    `SELECT organization_id FROM connections WHERE id = $1 LIMIT 1`,
    [connectionId]
  );

  return result.rows[0]?.organization_id || null;
}

/**
 * Verifica se a primeira mensagem de um contato corresponde a uma frase monitorada
 * e registra o lead se necessário.
 */
export async function detectSalesSeoLead(connectionId, conversationId, message, isFirstMessageInConversation = false) {
  try {
    if (!message || !message.content) return;
    if (message.fromMe) return;

    await ensureSalesSeoSchema();

    const contentStr = String(message.content).trim();
    const organizationId = await getConnectionOrganizationId(connectionId);

    if (!organizationId || !contentStr) return;
    
    const trackers = await query(
      `SELECT * FROM sales_seo_trackers 
       WHERE organization_id = $1
       AND is_active = true 
       AND (COALESCE(cardinality(connection_ids), 0) = 0 OR $2::uuid = ANY(connection_ids))
       ORDER BY created_at DESC`,
      [organizationId, connectionId]
    );

    const matchingTrackers = trackers.rows.filter((tracker) =>
      trackerMatchesMessage(contentStr, tracker.phrase)
    );

    if (matchingTrackers.length === 0) return;

    for (const tracker of matchingTrackers) {
      const existing = await query(
        `SELECT id FROM sales_seo_leads WHERE conversation_id = $1 AND tracker_id = $2 LIMIT 1`,
        [conversationId, tracker.id]
      );

      if (existing.rows.length > 0) continue;

      await query(
        `INSERT INTO sales_seo_leads (
          organization_id, tracker_id, conversation_id, connection_id, 
          phone, entry_message, evolution_status
        ) VALUES ($1, $2, $3, $4, $5, $6, 1)`,
        [
          organizationId,
          tracker.id,
          conversationId,
          connectionId,
          message.phone || null,
          message.content,
        ]
      );

      console.log(
        `[Sales SEO] Lead registrado para tracker: ${tracker.name} | conversa: ${conversationId} | primeira mensagem: ${isFirstMessageInConversation ? 'sim' : 'não'}`
      );
    }
  } catch (error) {
    console.error('[Sales SEO] Erro na detecção de lead:', error);
  }
}

/**
 * Atualiza o status de evolução do lead com base em novas mensagens
 */
export async function updateSalesSeoEvolution(conversationId, message) {
  try {
    await ensureSalesSeoSchema();

    // Se a mensagem for de resposta (fromMe), evolui o status para "Engajado" (2)
    // se o status atual for "Novo" (1)
    if (message.fromMe) {
      await query(
        `UPDATE sales_seo_leads 
         SET evolution_status = 2, updated_at = NOW()
         WHERE conversation_id = $1 AND evolution_status = 1`,
        [conversationId]
      );
    }
  } catch (error) {
    console.error('[Sales SEO] Erro ao atualizar evolução:', error);
  }
}
