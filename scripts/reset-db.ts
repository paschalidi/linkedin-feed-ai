import "dotenv/config";
import { Client } from "pg";

async function resetDatabase() {
  const databaseUrl = process.env.SUPABASE_DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ SUPABASE_DATABASE_URL is not set");
    console.error("Add it to .env.local");
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("⚠️  Dropping all tables...\n");

    const tables = [
      "generated_posts",
      "daily_ideas",
      "linkedin_profiles",
      "style_profiles",
      "articles",
      "newsletter_sources",
    ];

    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`  🗑️  Dropped ${table}`);
      } catch (err: any) {
        console.log(`  ⏭️  ${table} didn't exist`);
      }
    }

    console.log("\n✅ Database reset. Now run: npm run db:setup");
  } finally {
    await client.end();
  }
}

resetDatabase();
