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
    DistributionBasis,
    DistributionStatus,
    MembershipStatus,
    MembershipType,
    Prisma,
    RefreshTokenStatus,
    RoleScope,
    PermissionScope,
    SourceType,
    SubscriptionPlan,
    SubscriptionProvider,
    SubscriptionStatus,
    TransactionCategory,
    TransactionDirection,
    TransactionStatus,
} from '@prisma/client';

export {
    DEFAULT_ROLE_WEIGHTS,
    WEIGHTED_ROLE_KEYS,
    WEIGHT_WITHOUT_ROLE,
    weightOfRole,
} from './distribution-weights.js';

export type { WeightedRoleKey } from './distribution-weights.js';

export {
    ENTITLING_SUBSCRIPTION_STATUSES,
    PLANS,
    PLAN_KEYS,
    addPlanInterval,
} from './plans.js';

export type { PlanDefinition, PlanKey } from './plans.js';

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
