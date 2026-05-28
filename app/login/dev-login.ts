import { createClient } from "@supabase/supabase-js";

const DEV_EMAIL = "dev@linkedin-feed-ai.local";
const DEV_PASSWORD = "devpassword123";

export async function ensureDevUser() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set.\n\n" +
      "To use Dev Login, add your secret key to .env:\n" +
      "1. Go to https://supabase.com/dashboard/project/_/settings/api\n" +
      "2. Under 'Secret API key', click 'Generate new secret key'\n" +
      "3. Copy the sb_secret_... key\n" +
      "4. Add it to your .env file: SUPABASE_SECRET_KEY=sb_secret_...\n\n" +
      "Or disable email confirmation in Supabase Authentication settings."
    );
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Check if user exists
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  const devUser = users.find((u) => u.email === DEV_EMAIL);

  if (!devUser) {
    // Create the dev user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { is_dev_user: true },
    });

    if (createError) {
      throw new Error(`Failed to create dev user: ${createError.message}`);
    }

    return { created: true, email: DEV_EMAIL, password: DEV_PASSWORD };
  }

  // Ensure email is confirmed
  if (!devUser.email_confirmed_at) {
    await supabaseAdmin.auth.admin.updateUserById(devUser.id, {
      email_confirm: true,
    });
  }

  return { created: false, email: DEV_EMAIL, password: DEV_PASSWORD };
}
