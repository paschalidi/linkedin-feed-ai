import "dotenv/config";
import { syncRSSFeed } from "../app/(app)/sources/rss-actions";

async function testPointerSync() {
  // Find Pointer source ID
  const { Pool } = require("pg");
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const { rows } = await pool.query(
    "SELECT id FROM newsletter_sources WHERE url = $1",
    ["https://pointerio.substack.com/feed"]
  );
  
  if (rows.length === 0) {
    console.log("Pointer source not found");
    await pool.end();
    return;
  }
  
  const sourceId = rows[0].id;
  console.log("Syncing Pointer.io...\n");
  
  // Reset last_fetched_at to force full sync
  await pool.query("UPDATE newsletter_sources SET last_fetched_at = NULL WHERE id = $1", [sourceId]);
  await pool.end();
  
  const result = await syncRSSFeed(sourceId, "https://pointerio.substack.com/feed", { isFirstSync: true });

  console.log("\n=== Result ===");
  console.log(`Total RSS items: ${result.total}`);
  console.log(`Ingested: ${result.ingested}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);
  if (result.error) console.log(`Error: ${result.error}`);
}

testPointerSync().catch(e => {
  console.error(e);
  process.exit(1);
});
