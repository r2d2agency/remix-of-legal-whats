/**
 * Group Secretary Diagnostic - in-memory circular buffer (500 events)
 * Tracks UAZAPI/W-API analysis pipeline for auditing.
 */

const MAX_EVENTS = 500;
const buffer = [];

/**
 * Record a diagnostic event.
 * @param {Object} evt
 * @param {string} evt.organizationId
 * @param {string} evt.provider - 'uazapi' | 'wapi' | 'evolution'
 * @param {string} evt.stage - 'webhook_received' | 'skipped' | 'ai_called' | 'detected' | 'no_detection' | 'error' | 'completed'
 * @param {string} [evt.level] - 'info' | 'warn' | 'error'
 * @param {string} [evt.messageId]
 * @param {string} [evt.conversationId]
 * @param {string} [evt.groupName]
 * @param {string} [evt.senderName]
 * @param {string} [evt.message]
 * @param {Object} [evt.details]
 * @param {string} [evt.error]
 */
export function recordSecretaryEvent(evt) {
  try {
    buffer.unshift({
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      timestamp: new Date().toISOString(),
      level: evt.level || (evt.error ? 'error' : 'info'),
      ...evt,
    });
    if (buffer.length > MAX_EVENTS) buffer.length = MAX_EVENTS;
  } catch {
    // ignore
  }
}

export function getSecretaryEvents({ organizationId, provider, stage, limit = 200 } = {}) {
  let out = buffer;
  if (organizationId) out = out.filter(e => e.organizationId === organizationId);
  if (provider) out = out.filter(e => e.provider === provider);
  if (stage) out = out.filter(e => e.stage === stage);
  return out.slice(0, Math.min(Number(limit) || 200, MAX_EVENTS));
}

export function clearSecretaryEvents({ organizationId } = {}) {
  if (!organizationId) {
    buffer.length = 0;
    return;
  }
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (buffer[i].organizationId === organizationId) buffer.splice(i, 1);
  }
}