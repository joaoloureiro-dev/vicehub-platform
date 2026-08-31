import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient, SourceType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { PERMISSIONS, ROLES } from '../src/rbac.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carrega o .env da raiz do monorepo, tal como o prisma.config.ts.
 *
 * O seed corre por tsx e não passa pelo carregamento de configuração do
 * Prisma, por isso tem de ler o ficheiro por si. Sem isto só funcionava
 * quando a variável já estivesse definida na shell.
 */
dotenv.config({
    path: path.resolve(__dirname, '../../../.env'),
    quiet: true,
});

/**
 * Seed dos cargos e permissões base do ViceHub.
 *
 * As definições vêm do catálogo em src/rbac.ts, o mesmo que a API usa
 * para verificar permissões. Não há aqui uma segunda lista que possa
 * divergir da primeira.
 *
 * É idempotente: correr várias vezes deixa a base de dados no mesmo
 * estado. Nada é eliminado, para que uma execução acidental não apague
 * atribuições existentes.
 */

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
    throw new Error('[ViceHub Seed] DATABASE_URL não definida.');
}

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
});

const seedPermissions = async (): Promise<Map<string, string>> => {
    const permissionIds = new Map<string, string>();

    for (const [key, permission] of Object.entries(PERMISSIONS)) {
        const record = await prisma.permission.upsert({
            where: {
                slug_scope: {
                    slug: permission.slug,
                    scope: permission.scope,
                },
            },
            /**
             * Nome e descrição são atualizados, mas o estado de soft
             * delete não é tocado: se alguém desativou uma permissão, o
             * seed não a ressuscita sem querer.
             */
            update: {
                name: permission.name,
                description: permission.description,
            },
            create: {
                slug: permission.slug,
                scope: permission.scope,
                name: permission.name,
                description: permission.description,
                source: SourceType.migration,
            },
        });

        permissionIds.set(key, record.id);
    }

    return permissionIds;
};

const seedRoles = async (permissionIds: Map<string, string>): Promise<void> => {
    for (const role of Object.values(ROLES)) {
        const record = await prisma.role.upsert({
            where: {
                slug_scope: {
                    slug: role.slug,
                    scope: role.scope,
                },
            },
            update: {
                name: role.name,
                description: role.description,
                is_system: true,
            },
            create: {
                slug: role.slug,
                scope: role.scope,
                name: role.name,
                description: role.description,
                is_system: true,
                source: SourceType.migration,
            },
        });

        for (const permissionKey of role.permissions) {
            const permissionId = permissionIds.get(permissionKey);

            if (!permissionId) {
                throw new Error(
                    `[ViceHub Seed] O cargo ${role.slug} refere a permissão ${permissionKey}, que não existe no catálogo.`,
                );
            }

            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: record.id,
                        permissionId,
                    },
                },
                update: {},
                create: {
                    roleId: record.id,
                    permissionId,
                    source: SourceType.migration,
                },
            });
        }
    }
};

const main = async (): Promise<void> => {
    const permissionIds = await seedPermissions();

    await seedRoles(permissionIds);

    console.log(
        `[ViceHub Seed] ${permissionIds.size} permissões e ${Object.keys(ROLES).length} cargos garantidos.`,
    );
};

try {
    await main();
} catch (error: unknown) {
    console.error('[ViceHub Seed] Falhou:', error);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
