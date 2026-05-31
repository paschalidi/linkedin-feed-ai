"use server";

import { createClient } from "@supabase/supabase-js";

const ALLOWED_EMAIL = "paschalidi@outlook.com";

function getDevPassword(): string {
  const password = process.env.DEV_PASSWORD;
  if (!password) {
    throw new Error(
      "DEV_PASSWORD is not set.\n\n" +
      "Add a strong password to your .env file:\n" +
      "DEV_PASSWORD=your-very-strong-password-here"
    );
  }
  return password;
}

export async function ensureDevUser() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const devPassword = getDevPassword();

  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set.\n\n" +
      "To use Dev Login, add your secret key to .env:\n" +
      "1. Go to https://supabase.com/dashboard/project/_/settings/api\n" +
      "2. Under 'Secret API key', click 'Generate new secret key'\n" +
      "3. Copy the sb_secret_... key\n" +
      "4. Add it to your .env file: SUPABASE_SECRET_KEY=sb_secret_..."
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

  const devUser = users.find((u) => u.email === ALLOWED_EMAIL);

  if (!devUser) {
    // Create the dev user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: ALLOWED_EMAIL,
      password: devPassword,
      email_confirm: true,
      user_metadata: { is_dev_user: true },
    });

    if (createError) {
      throw new Error(`Failed to create dev user: ${createError.message}`);
    }

    return { created: true, email: ALLOWED_EMAIL, password: devPassword };
  }

  // Update password in case env var changed
  await supabaseAdmin.auth.admin.updateUserById(devUser.id, {
    password: devPassword,
  });

  // Ensure email is confirmed
  if (!devUser.email_confirmed_at) {
    await supabaseAdmin.auth.admin.updateUserById(devUser.id, {
      email_confirm: true,
    });
  }

  return { created: false, email: ALLOWED_EMAIL, password: devPassword };
}

export async function validateDevPassword(password: string): Promise<boolean> {
  try {
    const expected = getDevPassword();
    return password === expected;
  } catch {
    return false;
  }
}
