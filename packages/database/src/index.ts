import './env.js';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
    throw new Error('[ViceHub DB] DATABASE_URL não definida');
}

console.log('DATABASE_URL:', connectionString);

const adapter = new PrismaPg({
    connectionString,
});

export const prisma = new PrismaClient({
    adapter,
});

export type DatabaseClient = typeof prisma;

export {
    AuthProviderType,
    AuthSessionStatus,
    Prisma,
    RefreshTokenStatus,
    RoleScope,
    PermissionScope,
    SourceType,
} from '@prisma/client';