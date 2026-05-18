import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  try {
    const res = await pool.query('SELECT current_node_id, wait_reply_expires_at, is_active FROM flow_sessions WHERE is_active = true');
    console.log('Active Sessions:', JSON.stringify(res.rows, null, 2));
    
    // Check if any expired
    const expired = await pool.query('SELECT id, wait_reply_expires_at FROM flow_sessions WHERE is_active = true AND wait_reply_expires_at <= NOW()');
    console.log('Expired Sessions:', JSON.stringify(expired.rows, null, 2));
  } catch (err) {
    console.error('Test Error:', err.message);
  }
  process.exit(0);
}

test();
