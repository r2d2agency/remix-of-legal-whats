import { getRequestContext } from './request-context.js';

const LOG_BUFFER_MAX = 500;
const runtimeLogBuffer = []; // newest first

function safeJson(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    // Fallback in case of circular refs
    return JSON.stringify({ ts: new Date().toISOString(), level: 'error', event: 'logger.stringify_failed' });
  }
}

function pushRuntimeLog(line) {
  runtimeLogBuffer.unshift(line);
  if (runtimeLogBuffer.length > LOG_BUFFER_MAX) runtimeLogBuffer.length = LOG_BUFFER_MAX;
}

export function getRecentLogs({ limit = 100, eventPrefixes = [], level = null } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), LOG_BUFFER_MAX);
  return runtimeLogBuffer
    .filter((entry) => {
      const levelOk = !level || entry.level === level;
      const eventOk = !Array.isArray(eventPrefixes) || eventPrefixes.length === 0
        ? true
        : eventPrefixes.some((prefix) => String(entry.event || '').startsWith(prefix));
      return levelOk && eventOk;
    })
    .slice(0, safeLimit);
}

export function log(level, event, payload = {}) {
  const ctx = getRequestContext();
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(ctx || {}),
    ...payload,
  };

  pushRuntimeLog(line);

  // Always write structured logs as single-line JSON
  // eslint-disable-next-line no-console
  console.log(safeJson(line));
}

export function logInfo(event, payload) {
  log('info', event, payload);
}

export function logWarn(event, payload) {
  log('warn', event, payload);
}

export function logError(event, error, payload = {}) {
  const err = error || {};
  log('error', event, {
    ...payload,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      where: err.where,
      schema: err.schema,
      table: err.table,
      column: err.column,
      constraint: err.constraint,
      position: err.position,
      routine: err.routine,
    },
  });
}
