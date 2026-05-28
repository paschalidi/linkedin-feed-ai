import "dotenv/config";
import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";

async function runMigrations() {
  const databaseUrl = process.env.SUPABASE_DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ SUPABASE_DATABASE_URL is not set in .env");
    console.error("");
    console.error("To get your database URL:");
    console.error("1. Go to https://supabase.com/dashboard/project/_/settings/database");
    console.error("2. Under 'Connection string', select 'URI'");
    console.error("3. Copy the connection string");
    console.error("4. Add to .env.local: SUPABASE_DATABASE_URL=postgresql://postgres:...");
    console.error("");
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log("🔌 Connecting to database...");
    await client.connect();

    // Check if pgvector extension exists
    console.log("📦 Checking pgvector extension...");
    const extResult = await client.query(
      "SELECT * FROM pg_extension WHERE extname = 'vector'"
    );
    if (extResult.rows.length === 0) {
      console.log("⚠️  pgvector extension not found. Enabling...");
      await client.query("CREATE EXTENSION IF NOT EXISTS vector");
      console.log("✅ pgvector enabled");
    } else {
      console.log("✅ pgvector already enabled");
    }

    // Check if tables already exist
    console.log("🔍 Checking existing tables...");
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('newsletter_sources', 'articles', 'style_profiles', 'linkedin_profiles', 'daily_ideas', 'generated_posts')
    `);

    const existingTables = tablesResult.rows.map((r) => r.table_name);
    console.log(`Found ${existingTables.length} existing tables: ${existingTables.join(", ") || "none"}`);

    // Read and execute setup SQL
    const sqlPath = path.join(process.cwd(), "supabase", "setup.sql");
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ SQL file not found: ${sqlPath}`);
      process.exit(1);
    }

    console.log("📄 Reading setup.sql...");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    // Split SQL into individual statements
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`🚀 Executing ${statements.length} SQL statements...\n`);

    for (const statement of statements) {
      try {
        await client.query(statement + ";");
        // Log first line of statement for progress
        const firstLine = statement.split("\n")[0].trim().slice(0, 60);
        console.log(`  ✅ ${firstLine}...`);
      } catch (err: any) {
        // Ignore "already exists" errors
        if (err.message?.includes("already exists")) {
          const firstLine = statement.split("\n")[0].trim().slice(0, 60);
          console.log(`  ⏭️  ${firstLine}... (already exists)`);
        } else {
          console.error(`  ❌ Error: ${err.message}`);
          console.error(`     Statement: ${statement.slice(0, 100)}...`);
        }
      }
    }

    console.log("\n🎉 Database setup complete!");
    console.log("Tables created/verified:");
    console.log("  - newsletter_sources");
    console.log("  - articles");
    console.log("  - style_profiles");
    console.log("  - linkedin_profiles");
    console.log("  - daily_ideas");
    console.log("  - generated_posts");
    console.log("\nYou can now run: npm run dev");
  } catch (err: any) {
    console.error("\n❌ Database connection failed:");
    console.error(err.message);
    console.error("\nMake sure your SUPABASE_DATABASE_URL is correct.");
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
