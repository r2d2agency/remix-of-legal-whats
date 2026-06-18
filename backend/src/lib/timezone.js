const BR_OFFSET = '-03:00';
const HAS_TIMEZONE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * Treat naive date/time strings as America/Sao_Paulo before inserting into TIMESTAMPTZ.
 * Examples: "2026-06-18T12:00" -> "2026-06-18T12:00:00-03:00"
 *           "2026-06-18 12:00" -> "2026-06-18T12:00:00-03:00"
 */
export function normalizeBrazilDateTime(value) {
  if (!value || value instanceof Date) return value || null;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed || HAS_TIMEZONE.test(trimmed)) return trimmed || null;

  const dateOnly = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) return `${dateOnly[1]}T00:00:00${BR_OFFSET}`;

  const dateTime = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2})(?:\.\d{1,6})?)?$/);
  if (dateTime) {
    const seconds = dateTime[3] || '00';
    return `${dateTime[1]}T${dateTime[2]}:${seconds}${BR_OFFSET}`;
  }

  return trimmed;
}