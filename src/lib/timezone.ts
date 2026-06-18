// Helpers to keep datetime-local <input> values consistent with America/Sao_Paulo (-03:00).
// Brazil has no DST since 2019, so a fixed offset is safe and avoids the +/-3h drift
// that happens when a naive "YYYY-MM-DDTHH:mm" string is stored in a timestamptz column.

const BR_OFFSET = "-03:00";

/** Convert a datetime-local string ("YYYY-MM-DDTHH:mm") to ISO with BR offset before sending to the API. */
export function localInputToBrISO(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  // Already has timezone info
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return value;
  const v = value.length === 16 ? `${value}:00` : value; // ensure seconds
  return `${v}${BR_OFFSET}`;
}

/** Convert a Date object to a datetime-local string in Brazil time without using toISOString(). */
export function dateToBrLocalInput(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** Convert an ISO timestamp (UTC or with TZ) to a datetime-local string in BR time for <input type="datetime-local">. */
export function isoToBrLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Format in America/Sao_Paulo regardless of the user's browser timezone.
  return dateToBrLocalInput(d);
}