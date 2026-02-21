import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import webpush from 'web-push';

const router = Router();

// Configure VAPID keys from environment
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@gleego.com.br';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Get VAPID public key (public endpoint - no auth needed)
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    // Get user's organization
    const orgResult = await query(
      'SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    const organizationId = orgResult.rows[0]?.organization_id || null;

    // Upsert subscription
    await query(
      `INSERT INTO push_subscriptions (user_id, organization_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent,
         updated_at = NOW()`,
      [req.user.id, organizationId, endpoint, keys.p256dh, keys.auth, req.headers['user-agent'] || null]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Unsubscribe
router.post('/unsubscribe', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });

    await query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// Get subscription status
router.get('/status', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, endpoint, created_at FROM push_subscriptions WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ subscriptions: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Push status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Send push to a specific user (internal use / admin)
router.post('/send', authenticate, async (req, res) => {
  try {
    const { userId, title, body, url, data } = req.body;
    const targetUserId = userId || req.user.id;

    const subs = await query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [targetUserId]
    );

    if (subs.rows.length === 0) {
      return res.status(404).json({ error: 'No push subscriptions found for user' });
    }

    const payload = JSON.stringify({
      title: title || 'Glee-go Whats',
      body: body || '',
      url: url || '/',
      data: data || {},
      timestamp: Date.now(),
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subs.rows) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;

        await query(
          `INSERT INTO push_notification_log (user_id, subscription_id, title, body, data, status)
           VALUES ($1, $2, $3, $4, $5, 'sent')`,
          [targetUserId, sub.id, title, body, JSON.stringify(data || {})]
        );
      } catch (err) {
        failed++;
        console.error('Push send error:', err.statusCode, err.body);

        // Remove expired/invalid subscriptions
        if (err.statusCode === 404 || err.statusCode === 410) {
          await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        }

        await query(
          `INSERT INTO push_notification_log (user_id, subscription_id, title, body, data, status, error)
           VALUES ($1, $2, $3, $4, $5, 'failed', $6)`,
          [targetUserId, sub.id, title, body, JSON.stringify(data || {}), err.message]
        );
      }
    }

    res.json({ success: true, sent, failed });
  } catch (error) {
    console.error('Push send error:', error);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

// Send push to all users in an organization
router.post('/broadcast', authenticate, async (req, res) => {
  try {
    const { title, body, url, data } = req.body;

    const orgResult = await query(
      'SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id;
    if (!orgId) return res.status(400).json({ error: 'No organization found' });

    const subs = await query(
      'SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE organization_id = $1',
      [orgId]
    );

    const payload = JSON.stringify({
      title: title || 'Glee-go Whats',
      body: body || '',
      url: url || '/',
      data: data || {},
      timestamp: Date.now(),
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subs.rows) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 404 || err.statusCode === 410) {
          await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        }
      }
    }

    res.json({ success: true, sent, failed, total: subs.rows.length });
  } catch (error) {
    console.error('Push broadcast error:', error);
    res.status(500).json({ error: 'Failed to broadcast' });
  }
});

// Helper function to send push from other modules
export async function sendPushToUser(userId, title, body, url = '/', data = {}) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  try {
    const subs = await query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    const payload = JSON.stringify({ title, body, url, data, timestamp: Date.now() });

    for (const sub of subs.rows) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        }
      }
    }
  } catch (error) {
    console.error('sendPushToUser error:', error);
  }
}

export default router;
