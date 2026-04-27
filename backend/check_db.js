import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  try {
    const res = await pool.query(`
      SELECT 
        m.id, 
        m.timestamp, 
        m.content, 
        c.remote_jid 
      FROM chat_messages m 
      JOIN conversations c ON m.conversation_id = c.id 
      ORDER BY m.timestamp DESC 
      LIMIT 5
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
