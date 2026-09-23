import { describe, expect, it } from "vitest";
import { appDatabaseUrl, migrationDatabaseUrl } from "./db-url";

describe("appDatabaseUrl", () => {
  it("prefers DATABASE_URL and leaves plain URLs alone", () => {
    expect(appDatabaseUrl({ DATABASE_URL: "postgres://a@h:6543/db", POSTGRES_URL: "postgres://b@h/db" })).toBe("postgres://a@h:6543/db");
  });
  it("falls back to the Supabase integration names, ignoring empty values", () => {
    expect(appDatabaseUrl({ DATABASE_URL: "", POSTGRES_PRISMA_URL: "postgres://p@h/db" })).toBe("postgres://p@h/db");
    expect(appDatabaseUrl({ POSTGRES_URL: "postgres://u@h/db" })).toBe("postgres://u@h/db");
  });
  it("gives sslmode=require its libpq meaning", () => {
    expect(appDatabaseUrl({ DATABASE_URL: "postgres://u@h/db?sslmode=require&supa=base-pooler.x" })).toBe(
      "postgres://u@h/db?sslmode=require&supa=base-pooler.x&uselibpqcompat=true",
    );
    expect(appDatabaseUrl({ DATABASE_URL: "postgres://u@h/db?sslmode=require&uselibpqcompat=false" })).toMatch(/uselibpqcompat=false$/);
    expect(appDatabaseUrl({ DATABASE_URL: "postgres://u@h/db?sslmode=verify-full" })).toBe("postgres://u@h/db?sslmode=verify-full");
  });
  it("fails loudly when nothing is configured", () => {
    expect(() => appDatabaseUrl({})).toThrow(/DATABASE_URL is not set/);
  });
});

describe("migrationDatabaseUrl", () => {
  it("uses the session connection first, then the app URL", () => {
    expect(migrationDatabaseUrl({ DIRECT_URL: "d", DATABASE_URL: "a" })).toBe("d");
    expect(migrationDatabaseUrl({ DIRECT_URL: "", POSTGRES_URL_NON_POOLING: "n", DATABASE_URL: "a" })).toBe("n");
    expect(migrationDatabaseUrl({ DATABASE_URL: "a" })).toBe("a");
    expect(migrationDatabaseUrl({})).toBeUndefined();
  });
  it("swaps Supabase's IPv6-only direct host for the session pooler", () => {
    const pooled = "postgres://postgres.abc123:p%40ss@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true";
    const session = "postgres://postgres.abc123:p%40ss@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require";
    const direct = "postgres://postgres:p%40ss@db.abc123.supabase.co:5432/postgres?sslmode=require";
    expect(migrationDatabaseUrl({ POSTGRES_URL_NON_POOLING: direct, POSTGRES_PRISMA_URL: pooled })).toBe(session);
    expect(migrationDatabaseUrl({ DIRECT_URL: direct, DATABASE_URL: pooled })).toBe(session);
  });
  it("keeps the direct host when no pooler URL for the same project is set", () => {
    const direct = "postgres://postgres:pw@db.abc123.supabase.co:5432/postgres";
    expect(migrationDatabaseUrl({ DIRECT_URL: direct })).toBe(direct);
    expect(migrationDatabaseUrl({ DIRECT_URL: direct, DATABASE_URL: "postgres://postgres.other:pw@aws-0-x.pooler.supabase.com:6543/postgres" })).toBe(direct);
  });
  it("leaves a session pooler DIRECT_URL alone", () => {
    const session = "postgres://postgres.abc123:pw@aws-0-x.pooler.supabase.com:5432/postgres";
    expect(migrationDatabaseUrl({ DIRECT_URL: session, DATABASE_URL: "postgres://postgres.abc123:pw@aws-0-x.pooler.supabase.com:6543/postgres" })).toBe(session);
  });
});
