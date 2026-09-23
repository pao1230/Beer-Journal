import "dotenv/config";
import { defineConfig } from "prisma/config";
import { migrationDatabaseUrl } from "./src/lib/db-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // On Supabase, DIRECT_URL (or the integration's POSTGRES_URL_NON_POOLING) is the session pooler, port 5432.
  datasource: {
    url: migrationDatabaseUrl(),
  },
});
