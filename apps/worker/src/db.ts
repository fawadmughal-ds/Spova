import { PrismaClient } from '@prisma/client';

export type Db = PrismaClient;

export function createDb(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}
