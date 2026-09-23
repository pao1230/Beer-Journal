type Env = Record<string, string | undefined>;

/**
 * node-postgres treats sslmode=require as full certificate verification, which fails against
 * Supabase's private CA. uselibpqcompat restores the standard meaning: encrypted, not verified.
 */
function withLibpqSsl(url: string) {
  if (/[?&]sslmode=require(&|$)/.test(url) && !/[?&]uselibpqcompat=/.test(url)) return `${url}&uselibpqcompat=true`;
  return url;
}

/** Runtime connection: DATABASE_URL, or the names Vercel's Supabase integration sets. */
export function appDatabaseUrl(env: Env = process.env) {
  const url = env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return withLibpqSsl(url);
}

/** Migrations need a session (non-transaction-pooled) connection when one is available. */
export function migrationDatabaseUrl(env: Env = process.env) {
  return env.DIRECT_URL || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL || env.POSTGRES_URL || undefined;
}
