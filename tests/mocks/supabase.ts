import { vi } from "vitest";

export function createMockSupabaseClient(data: Record<string, any[]>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              single: () => Promise.resolve({ data: data[table]?.[0] || null, error: null }),
              data: data[table] || [],
              error: null,
            }),
            data: data[table] || [],
            error: null,
          }),
          single: () => Promise.resolve({ data: data[table]?.[0] || null, error: null }),
          data: data[table] || [],
          error: null,
        }),
        order: () => ({
          data: data[table] || [],
          error: null,
        }),
        single: () => Promise.resolve({ data: data[table]?.[0] || null, error: null }),
        data: data[table] || [],
        error: null,
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: data[table]?.[0] || null, error: null }),
          data: data[table] || [],
          error: null,
        }),
        data: data[table] || [],
        error: null,
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
        error: null,
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
        error: null,
      }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "test-user-123", email: "test@example.com" } }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { session: { access_token: "test-token" } }, error: null }),
      signUp: () => Promise.resolve({ data: { user: { id: "test-user-123" } }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
  };
}

export function mockSupabaseServer(data: Record<string, any[]> = {}) {
  vi.mock("@/lib/supabase/server", () => ({
    createClient: () => Promise.resolve(createMockSupabaseClient(data)),
  }));
}
