import "dotenv/config";
import { syncRSSFeed } from "../app/(app)/sources/rss-actions";

async function testSmartSync() {
  const sourceId = "f8cd0f3b-28ed-463b-95c2-256afeadaa4e";
  const feedUrl = "https://swlw-rss.netlify.app/issues.rss";

  console.log("Smart sync: fetching RSS and classifying items...\n");
  const result = await syncRSSFeed(sourceId, feedUrl, { isFirstSync: true });

  console.log("\n=== Result ===");
  console.log(`Total RSS items: ${result.total}`);
  console.log(`Ingested: ${result.ingested}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);
  if (result.error) console.log(`Error: ${result.error}`);
}

testSmartSync().catch(e => {
  console.error(e);
  process.exit(1);
});
