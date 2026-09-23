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
});
