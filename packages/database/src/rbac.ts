import { PermissionScope, RoleScope } from '@prisma/client';

/**
 * Catálogo de cargos e permissões do ViceHub.
 *
 * É a única fonte de verdade sobre o modelo de autorização: alimenta o
 * seed da base de dados e é o que a API usa para se referir a
 * permissões. Mantê-lo num só sítio evita que o que está gravado e o
 * que o código exige possam divergir.
 *
 * Vive no package de dados, e não na API, porque é a API que depende
 * dos dados e não o contrário.
 */

export interface PermissionDefinition {
    scope: PermissionScope;
    slug: string;
    name: string;
    description: string;
}

/**
 * As permissões são identificadas no código por `escopo:slug`, que
 * corresponde à restrição de unicidade do modelo Permission.
 */
export const PERMISSIONS = {
    'user:read': {
        scope: PermissionScope.user,
        slug: 'read',
        name: 'Ver utilizadores',
        description: 'Consultar perfis de utilizadores.',
    },
    'user:update': {
        scope: PermissionScope.user,
        slug: 'update',
        name: 'Editar utilizadores',
        description: 'Alterar dados de qualquer utilizador.',
    },
    'user:delete': {
        scope: PermissionScope.user,
        slug: 'delete',
        name: 'Eliminar utilizadores',
        description: 'Eliminar contas de utilizador.',
    },
    'user:assign_role': {
        scope: PermissionScope.user,
        slug: 'assign_role',
        name: 'Atribuir cargos',
        description: 'Atribuir e remover cargos a utilizadores.',
    },
    'crew:read': {
        scope: PermissionScope.crew,
        slug: 'read',
        name: 'Ver crews',
        description: 'Consultar informação de crews.',
    },
    'crew:manage': {
        scope: PermissionScope.crew,
        slug: 'manage',
        name: 'Gerir a crew',
        description: 'Alterar dados e definições da crew.',
    },
    'crew:manage_members': {
        scope: PermissionScope.crew,
        slug: 'manage_members',
        name: 'Gerir membros da crew',
        description: 'Convidar, aceitar e remover membros da crew.',
    },
    'server:read': {
        scope: PermissionScope.server,
        slug: 'read',
        name: 'Ver servidores',
        description: 'Consultar informação de servidores.',
    },
    'server:manage': {
        scope: PermissionScope.server,
        slug: 'manage',
        name: 'Gerir o servidor',
        description: 'Alterar dados e definições do servidor.',
    },
    'treasury:read': {
        scope: PermissionScope.treasury,
        slug: 'read',
        name: 'Ver a tesouraria',
        description: 'Consultar saldos e transações.',
    },
    'treasury:transfer': {
        scope: PermissionScope.treasury,
        slug: 'transfer',
        name: 'Movimentar fundos',
        description: 'Executar transferências a partir da tesouraria.',
    },
    'system:manage': {
        scope: PermissionScope.system,
        slug: 'manage',
        name: 'Administrar a plataforma',
        description: 'Acesso administrativo total à plataforma.',
    },
} as const satisfies Record<string, PermissionDefinition>;

/**
 * Identificador de uma permissão tal como é usado no código.
 *
 * Sendo um tipo derivado do catálogo, uma permissão mal escrita é
 * apanhada na compilação e não em runtime com um pedido recusado sem
 * razão aparente.
 */
export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

/**
 * Permissão que concede acesso administrativo total.
 *
 * Existe para que uma permissão nova não deixe o administrador de fora
 * por esquecimento de atualizar o cargo.
 */
export const SYSTEM_MANAGE_PERMISSION: PermissionKey = 'system:manage';

export interface RoleDefinition {
    scope: RoleScope;
    slug: string;
    name: string;
    description: string;
    permissions: readonly PermissionKey[];
}

export const ROLES = {
    admin: {
        scope: RoleScope.global,
        slug: 'admin',
        name: 'Administrador',
        description: 'Acesso total à plataforma.',
        permissions: ['system:manage'],
    },
    moderator: {
        scope: RoleScope.global,
        slug: 'moderator',
        name: 'Moderador',
        description: 'Modera utilizadores e conteúdos da comunidade.',
        permissions: ['user:read', 'user:update', 'crew:read', 'server:read'],
    },
    player: {
        scope: RoleScope.global,
        slug: 'player',
        name: 'Jogador',
        description: 'Cargo atribuído a qualquer utilizador registado.',
        permissions: ['user:read', 'crew:read', 'server:read'],
    },
    crew_leader: {
        scope: RoleScope.crew,
        slug: 'crew_leader',
        name: 'Líder de crew',
        description: 'Controlo total sobre a crew, incluindo a tesouraria.',
        permissions: [
            'crew:read',
            'crew:manage',
            'crew:manage_members',
            'treasury:read',
            'treasury:transfer',
        ],
    },
    crew_officer: {
        scope: RoleScope.crew,
        slug: 'crew_officer',
        name: 'Oficial de crew',
        description: 'Gere membros e consulta a tesouraria da crew.',
        permissions: ['crew:read', 'crew:manage_members', 'treasury:read'],
    },
    crew_member: {
        scope: RoleScope.crew,
        slug: 'crew_member',
        name: 'Membro de crew',
        description: 'Participa na crew sem poderes de gestão.',
        permissions: ['crew:read'],
    },
    server_owner: {
        scope: RoleScope.server,
        slug: 'server_owner',
        name: 'Dono do servidor',
        description: 'Controlo total sobre o servidor.',
        permissions: ['server:read', 'server:manage'],
    },
} as const satisfies Record<string, RoleDefinition>;

export type RoleKey = keyof typeof ROLES;

export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

/**
 * Cargo atribuído a qualquer conta criada pelo registo.
 *
 * Sem ele, um utilizador novo ficaria sem permissão nenhuma. Atribuir
 * um cargo real, em vez de tratar o caso à parte no código, mantém a
 * autorização auditável: quem tem o quê lê-se na base de dados.
 */
export const DEFAULT_USER_ROLE: RoleKey = 'player';

/**
 * Constrói a chave de uma permissão a partir dos campos guardados.
 *
 * É o inverso do catálogo e permite comparar o que vem da base de dados
 * com o que o código pede.
 */
export const buildPermissionKey = (
    scope: PermissionScope,
    slug: string,
): string => `${scope}:${slug}`;
