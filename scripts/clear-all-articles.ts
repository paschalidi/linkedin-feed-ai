import "dotenv/config";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const ssl = url?.includes("supabase.co") ? { rejectUnauthorized: false } : false;
const pool = new Pool({ connectionString: url, ssl });

async function clearAll() {
  console.log("Deleting all article chunks...");
  await pool.query("DELETE FROM article_chunks");
  
  console.log("Deleting all articles...");
  await pool.query("DELETE FROM articles");
  
  console.log("Resetting RSS source last_fetched_at...");
  await pool.query("UPDATE newsletter_sources SET last_fetched_at = NULL WHERE type = 'rss'");
  
  const { rows } = await pool.query("SELECT COUNT(*) as cnt FROM articles");
  console.log("\nTotal articles remaining:", rows[0].cnt);
  
  await pool.end();
}

clearAll();
