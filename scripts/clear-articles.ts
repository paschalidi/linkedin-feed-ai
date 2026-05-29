import "dotenv/config";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const ssl = url?.includes("supabase.co") ? { rejectUnauthorized: false } : false;
const pool = new Pool({ connectionString: url, ssl });

async function clear() {
  console.log("Clearing remaining articles...");
  await pool.query("DELETE FROM article_chunks");
  await pool.query("DELETE FROM articles");
  console.log("Done.");
  await pool.end();
}

clear().catch(e => {
  console.error(e.message);
  process.exit(1);
});
