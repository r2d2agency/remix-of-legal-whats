import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  try {
    const res = await pool.query('SELECT COUNT(*) FROM flows');
    console.log('Flow count:', res.rows[0].count);
  } catch (err) {
    console.error('Test Error:', err.message);
  }
  process.exit(0);
}

test();
