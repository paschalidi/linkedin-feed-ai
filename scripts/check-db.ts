import "dotenv/config";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const ssl = url?.includes("supabase.co") ? { rejectUnauthorized: false } : false;
const pool = new Pool({ connectionString: url, ssl });

async function check() {
  const articles = await pool.query("SELECT COUNT(*) as cnt FROM articles");
  const chunks = await pool.query("SELECT COUNT(*) as cnt FROM article_chunks");
  console.log("Articles:", articles.rows[0].cnt);
  console.log("Chunks:", chunks.rows[0].cnt);
  
  const urls = await pool.query("SELECT url FROM articles LIMIT 5");
  if (urls.rows.length > 0) {
    console.log("URLs:", urls.rows.map(r => r.url));
  }
  
  await pool.end();
}

check().catch(e => {
  console.error(e.message);
  process.exit(1);
});
