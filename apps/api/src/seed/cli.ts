import { PrismaClient } from '@prisma/client';
import { runSeed } from './seed';

// Compiled entry used by the Docker image: `node dist/seed/cli.js` (env already injected by the host).
const prisma = new PrismaClient();
runSeed(prisma, { demoClient: process.env.SEED_DEMO_CLIENT === 'true' || process.env.NODE_ENV !== 'production' })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
