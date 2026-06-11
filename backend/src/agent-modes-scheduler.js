import { query } from './db.js';
import { logInfo, logError } from './logger.js';

// Runs every minute: deactivates expired auto-replies and applies schedule windows.
export function startAgentModesScheduler() {
  const tick = async () => {
    try {
      // 1. Deactivate expired (paused_until < now)
      const exp = await query(
        `UPDATE ai_agent_autoreply_config
            SET is_active = false, paused_until = NULL, updated_at = NOW()
          WHERE is_active = true AND paused_until IS NOT NULL AND paused_until <= NOW()
          RETURNING agent_id`
      );
      if (exp.rowCount > 0) logInfo('agent_modes.scheduler.expired', { count: exp.rowCount });

      // 2. Schedule windows (Brazil timezone)
      const cfgs = await query(
        `SELECT agent_id, is_active, schedule_windows
           FROM ai_agent_autoreply_config
          WHERE schedule_enabled = true`
      );
      if (cfgs.rows.length === 0) return;

      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const day = now.getDay();
      const hhmm = now.getHours() * 60 + now.getMinutes();

      for (const c of cfgs.rows) {
        const windows = Array.isArray(c.schedule_windows) ? c.schedule_windows : [];
        const inWindow = windows.some((w) => {
          if (!w?.days?.includes?.(day)) return false;
          const [sh, sm] = String(w.start || '00:00').split(':').map(Number);
          const [eh, em] = String(w.end || '23:59').split(':').map(Number);
          const s = sh * 60 + sm, e = eh * 60 + em;
          return s <= e ? hhmm >= s && hhmm < e : (hhmm >= s || hhmm < e);
        });
        if (inWindow !== c.is_active) {
          await query(
            `UPDATE ai_agent_autoreply_config SET is_active = $1, updated_at = NOW() WHERE agent_id = $2`,
            [inWindow, c.agent_id]
          );
          logInfo('agent_modes.scheduler.window', { agent_id: c.agent_id, is_active: inWindow });
        }
      }
    } catch (e) {
      logError('agent_modes.scheduler.tick', e);
    }
  };
  // First run quickly, then every minute
  setTimeout(tick, 5000);
  setInterval(tick, 60_000);
  console.log('⏰ Agent Modes scheduler started (1 min)');
}