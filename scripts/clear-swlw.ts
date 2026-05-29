import "dotenv/config";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const ssl = url?.includes("supabase.co") ? { rejectUnauthorized: false } : false;
const pool = new Pool({ connectionString: url, ssl });

async function clearSWLW() {
  const sourceId = "f8cd0f3b-28ed-463b-95c2-256afeadaa4e";

  console.log("Deleting SWLW chunks...");
  await pool.query(`
    DELETE FROM article_chunks 
    WHERE article_id IN (SELECT id FROM articles WHERE source_id = $1)
  `, [sourceId]);

  console.log("Deleting SWLW articles...");
  const result = await pool.query(
    "DELETE FROM articles WHERE source_id = $1 RETURNING id, title",
    [sourceId]
  );
  console.log(`Deleted ${result.rowCount} articles`);

  // Reset last_fetched_at so next sync treats it as first sync
  await pool.query(
    "UPDATE newsletter_sources SET last_fetched_at = NULL WHERE id = $1",
    [sourceId]
  );

  const { rows: total } = await pool.query("SELECT COUNT(*) as cnt FROM articles");
  console.log("\nTotal articles remaining:", total[0].cnt);

  await pool.end();
}

clearSWLW();
