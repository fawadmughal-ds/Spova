/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runSeed } from '../src/seed/seed';

for (const c of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(c)) {
    loadDotenv({ path: c });
    break;
  }
}

const prisma = new PrismaClient();
runSeed(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
