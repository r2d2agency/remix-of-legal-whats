// Wait Reply Timeout Scheduler
// Checks for flow sessions waiting for a reply that have timed out
import { query } from './db.js';

/**
 * Resume a flow from the timeout handle of a wait_reply node
 */
async function resumeFlowTimeout(session) {
  try {
    const { flow_id: flowId, conversation_id: conversationId, current_node_id: currentNodeId } = session;
    const variables = typeof session.variables === 'string'
      ? JSON.parse(session.variables || '{}')
      : (session.variables || {});

    console.log(`[WaitReply] Timeout for conversation ${conversationId}, node ${currentNodeId}`);

    // Clear wait_reply metadata
    await query(
      `UPDATE flow_sessions SET wait_reply_expires_at = NULL, wait_reply_variable = NULL, updated_at = NOW()
       WHERE conversation_id = $1 AND is_active = true`,
      [conversationId]
    );

    // Find the "timeout" edge from the current node
    const edgesResult = await query(
      'SELECT * FROM flow_edges WHERE flow_id = $1 AND source_node_id = $2',
      [flowId, currentNodeId]
    );

    const timeoutEdge = edgesResult.rows.find(e => e.source_handle === 'timeout') || null;

    if (!timeoutEdge) {
      console.log(`[WaitReply] No timeout edge found for node ${currentNodeId}, completing flow`);
      await query(
        `UPDATE flow_sessions SET is_active = false, completed_at = NOW() WHERE conversation_id = $1 AND is_active = true`,
        [conversationId]
      );
      return;
    }

    const nextNodeId = timeoutEdge.target_node_id;

    // Update session to next node
    await query(
      `UPDATE flow_sessions 
       SET variables = $1, current_node_id = $2, updated_at = NOW()
       WHERE conversation_id = $3 AND is_active = true`,
      [JSON.stringify(variables), nextNodeId, conversationId]
    );

    // Dynamically import to avoid circular deps
    const { default: flowExecutorModule } = await import('./flow-executor.js');
    // Use the resumeFlowFromNode approach - we call executeFlow from the timeout node
    // Since resumeFlowFromNode is not exported, we re-implement a lightweight version

    // Get conversation + connection info
    const convResult = await query(
      `SELECT c.*, conn.api_url, conn.api_key, conn.instance_name, conn.instance_id, conn.wapi_token, conn.provider
       FROM conversations c
       JOIN connections conn ON conn.id = c.connection_id
       WHERE c.id = $1`,
      [conversationId]
    );

    if (convResult.rows.length === 0) {
      console.error(`[WaitReply] Conversation ${conversationId} not found`);
      return;
    }

    // We need to continue the flow - use continueFlowWithInput trick:
    // Set session to nextNodeId and call the flow executor's resume logic
    // Since we can't call internal functions, we'll use a direct approach
    
    const { continueFlowAfterTimeout } = await import('./flow-executor.js');
    if (typeof continueFlowAfterTimeout === 'function') {
      await continueFlowAfterTimeout(conversationId, flowId, nextNodeId, variables);
    } else {
      // Fallback: mark as complete if function not available
      console.log(`[WaitReply] continueFlowAfterTimeout not available, completing session`);
      await query(
        `UPDATE flow_sessions SET is_active = false, completed_at = NOW() WHERE conversation_id = $1 AND is_active = true`,
        [conversationId]
      );
    }

    console.log(`[WaitReply] Timeout handled for conversation ${conversationId}, moved to node ${nextNodeId}`);
  } catch (error) {
    console.error(`[WaitReply] Error handling timeout:`, error);
  }
}

/**
 * Check for expired wait_reply sessions and trigger timeout path
 */
export async function executeWaitReplyTimeouts() {
  try {
    // Find active sessions where wait_reply has expired
    const result = await query(
      `SELECT fs.*, f.id as flow_id_check
       FROM flow_sessions fs
       JOIN flows f ON f.id = fs.flow_id
       WHERE fs.is_active = true 
         AND fs.wait_reply_expires_at IS NOT NULL 
         AND fs.wait_reply_expires_at <= NOW()
       LIMIT 20`
    );

    if (result.rows.length === 0) return;

    console.log(`[WaitReply] Found ${result.rows.length} expired wait_reply sessions`);

    for (const session of result.rows) {
      await resumeFlowTimeout(session);
      // Small delay between processing
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (error) {
    console.error('[WaitReply] Scheduler error:', error);
  }
}
