import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  // Reuse the client across hot reloads so development does not leak connections.
  globalForPrisma.prisma = prisma;
}

async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

export { connectDatabase };
export default prisma;