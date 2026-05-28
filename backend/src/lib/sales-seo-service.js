import { query } from '../db.js';

/**
 * Verifica se a primeira mensagem de um contato corresponde a uma frase monitorada
 * e registra o lead se necessário.
 */
export async function detectSalesSeoLead(connectionId, conversationId, message, isFirstMessageInConversation = false) {
  try {
    if (!message || typeof message.content !== 'string') return;
    if (message.fromMe) return;

    const cleanContent = message.content.trim();
    
    // Busca rastreadores ativos para esta organização ou frase
    // Nota: Usamos ILIKE para permitir correspondência parcial (ex: frase contida na mensagem)
    const trackers = await query(
      `SELECT * FROM sales_seo_trackers 
       WHERE is_active = true 
       AND $1 ILIKE '%' || TRIM(phrase) || '%'
       AND (cardinality(connection_ids) = 0 OR $2 = ANY(connection_ids))`,
      [cleanContent, connectionId]
    );

    if (trackers.rows.length === 0) return;

    for (const tracker of trackers.rows) {
      // Verifica se já existe um lead para esta conversa e este rastreador
      const existing = await query(
        `SELECT id FROM sales_seo_leads WHERE conversation_id = $1 AND tracker_id = $2`,
        [conversationId, tracker.id]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO sales_seo_leads (
            organization_id, tracker_id, conversation_id, connection_id, 
            phone, entry_message, evolution_status
          ) VALUES ($1, $2, $3, $4, $5, $6, 1)`,
          [
            tracker.organization_id,
            tracker.id,
            conversationId,
            connectionId,
            message.phone,
            message.content,
          ]
        );
        console.log(`[Sales SEO] Lead registrado para tracker: ${tracker.name}`);
      }
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
