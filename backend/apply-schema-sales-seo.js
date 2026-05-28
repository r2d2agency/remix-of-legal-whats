import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const schema = fs.readFileSync('backend/schema-sales-seo.sql', 'utf8');
        await pool.query(schema);
        console.log('Schema aplicado com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('Erro ao aplicar schema:', err);
        process.exit(1);
    }
}

run();
