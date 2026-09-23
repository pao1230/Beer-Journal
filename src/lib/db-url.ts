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

function parse(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Supabase's direct host (db.<ref>.supabase.co) is IPv6-only, so Vercel can't reach it. The
 * session pooler can: it's the transaction pooler's host and user on port 5432.
 */
function sessionPoolerFor(directUrl: string, pooledUrls: (string | undefined)[]) {
  const ref = parse(directUrl)?.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (!ref) return null;
  for (const candidate of pooledUrls) {
    const u = candidate ? parse(candidate) : null;
    if (!u || !u.hostname.endsWith(".pooler.supabase.com") || u.username !== `postgres.${ref}`) continue;
    u.port = "5432";
    u.searchParams.delete("pgbouncer");
    return u.toString();
  }
  return null;
}

/** Migrations need a session (non-transaction-pooled) connection when one is available. */
export function migrationDatabaseUrl(env: Env = process.env) {
  const url = env.DIRECT_URL || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL || env.POSTGRES_URL || undefined;
  if (!url) return undefined;
  return sessionPoolerFor(url, [env.DATABASE_URL, env.POSTGRES_PRISMA_URL, env.POSTGRES_URL]) ?? url;
}
