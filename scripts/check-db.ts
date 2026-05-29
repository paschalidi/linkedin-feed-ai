import "dotenv/config";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const ssl = url?.includes("supabase.co") ? { rejectUnauthorized: false } : false;
const pool = new Pool({ connectionString: url, ssl });

async function check() {
  const { rows: sources } = await pool.query(
    "SELECT id, name, type, url FROM newsletter_sources"
  );
  console.log("Sources:");
  sources.forEach(s => console.log(`  - ${s.name} (${s.type}): ${s.url}`));

  const { rows: counts } = await pool.query(
    "SELECT source_id, COUNT(*) as cnt FROM articles WHERE source_id IS NOT NULL GROUP BY source_id"
  );
  console.log("\nArticles per source:");
  counts.forEach(c => {
    const source = sources.find(s => s.id === c.source_id);
    console.log(`  - ${source?.name || c.source_id}: ${c.cnt}`);
  });

  const { rows: total } = await pool.query("SELECT COUNT(*) as cnt FROM articles");
  console.log("\nTotal articles:", total[0].cnt);

  await pool.end();
}

check();
