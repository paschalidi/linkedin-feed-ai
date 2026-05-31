"use server";

import { createClient } from "@supabase/supabase-js";

const ALLOWED_EMAIL = "paschalidi@outlook.com";

function getDevPassword(): string {
  const password = process.env.DEV_PASSWORD;
  if (!password) {
    throw new Error(
      "DEV_PASSWORD environment variable is not set. " +
      "Add it to .env.local for local dev or to Vercel env vars for production."
    );
  }
  return password.trim();
}

export async function signInWithDevPassword(inputPassword: string) {
  "use server";

  // 1. Check env var exists
  const expectedPassword = getDevPassword();

  // 2. Validate password
  if (inputPassword.trim() !== expectedPassword) {
    throw new Error("Invalid password.");
  }

  // 3. Ensure Supabase secret key exists
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. Check your environment variables."
    );
  }

  // 4. Ensure user exists in Supabase
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

  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  const devUser = users.find((u) => u.email === ALLOWED_EMAIL);

  if (!devUser) {
    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: ALLOWED_EMAIL,
      password: expectedPassword,
      email_confirm: true,
      user_metadata: { is_dev_user: true },
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }
  } else {
    // Update password in case env var changed
    await supabaseAdmin.auth.admin.updateUserById(devUser.id, {
      password: expectedPassword,
    });

    if (!devUser.email_confirmed_at) {
      await supabaseAdmin.auth.admin.updateUserById(devUser.id, {
        email_confirm: true,
      });
    }
  }

  return { email: ALLOWED_EMAIL, password: expectedPassword };
}
