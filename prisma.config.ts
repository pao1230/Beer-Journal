import "dotenv/config";
import { defineConfig } from "prisma/config";
import { migrationDatabaseUrl } from "./src/lib/db-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // On Supabase this is the session pooler (port 5432); the IPv6-only direct host is swapped for it.
  datasource: {
    url: migrationDatabaseUrl(),
  },
});
