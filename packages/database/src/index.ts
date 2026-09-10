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
    AccountTokenPurpose,
    AuthProviderType,
    AuthSessionStatus,
    DistributionBasis,
    DistributionStatus,
    EventParticipantStatus,
    EventStatus,
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
    XpReason,
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
    entitlingSubscriptionFilter,
    isPerpetualPlan,
} from './plans.js';

export type { PlanDefinition, PlanKey } from './plans.js';

export {
    HEARTBEAT_JANELA_MS,
    estaOnline,
    filtroDeOnline,
} from './heartbeat.js';

export {
    NIVEL_MAXIMO,
    PRESENCAS_MINIMAS,
    PRESENCAS_QUE_CONTAM,
    XP_BASE_DO_EVENTO,
    XP_DE_QUEM_APARECEU,
    XP_POR_NIVEL,
    XP_POR_PRESENCA,
    nivelDoXp,
    progressoDeNivel,
    xpDeUmEvento,
    xpDoNivel,
} from './progression.js';

export type { Progresso } from './progression.js';

export {
    DEGRAUS_DE_EVENTOS,
    DEGRAUS_DE_NIVEL_DE_CREW,
    DEGRAUS_DE_PAGAMENTOS,
    DEGRAUS_DE_PRESENCAS,
    conquistaDeEventos,
    conquistaDeNivel,
    conquistaDePagamentos,
    conquistaDePresencas,
    degrausAlcancados,
} from './achievements.js';

export {
    PRUNE_MARGEM_MS,
    condicoesDePrune,
    contarParaPrune,
    prune,
} from './prune.js';

export type { PruneResultado } from './prune.js';

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
