import { query } from './backend/src/db.js';

async function test() {
  try {
    const res = await query('SELECT id, name FROM flows LIMIT 5');
    console.log('Flows:', JSON.stringify(res.rows, null, 2));
    
    const sessions = await query('SELECT conversation_id, flow_id, current_node_id, wait_reply_expires_at, is_active FROM flow_sessions WHERE is_active = true LIMIT 5');
    console.log('Active Sessions:', JSON.stringify(sessions.rows, null, 2));
  } catch (err) {
    console.error('Test Error:', err.message);
  }
  process.exit(0);
}

test();
