import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('CRITICAL: DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

export const query = (text, params) => pool.query(text, params);
export default pool;
