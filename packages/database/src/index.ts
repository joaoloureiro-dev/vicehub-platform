import './env.js';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
    throw new Error('[ViceHub DB] DATABASE_URL não definida');
}

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

export {
    DEFAULT_USER_ROLE,
    PERMISSIONS,
    PERMISSION_KEYS,
    ROLES,
    ROLE_KEYS,
    SYSTEM_MANAGE_PERMISSION,
    buildPermissionKey,
} from './rbac.js';

export type {
    PermissionDefinition,
    PermissionKey,
    RoleDefinition,
    RoleKey,
} from './rbac.js';
