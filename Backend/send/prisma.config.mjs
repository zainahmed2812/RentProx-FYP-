// prisma.config.mjs
// Prisma 6 mein url schema.prisma mein hoti hai

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema:     'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
});
