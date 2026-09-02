import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient, SourceType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.resolve(__dirname, '../../../.env'),
    quiet: true,
});

/**
 * Dá e retira o cargo de administrador da plataforma.
 *
 * Existe porque a permissão `system:manage` não se alcança de outra
 * maneira: nenhuma rota a concede, e não podia conceder — a primeira
 * conta a poder nomear administradores seria a própria porta de entrada
 * que o cargo existe para guardar.
 *
 * A porta é, então, o acesso à base de dados. Quem corre isto já tem o
 * DATABASE_URL, ou seja, já pode fazer tudo o que o cargo permite; o
 * cargo apenas o passa a fazer pela API, e com rasto.
 *
 *     npm run admin:grant  -- pessoa@exemplo.com
 *     npm run admin:revoke -- pessoa@exemplo.com
 *     npm run admin:list
 */

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
    throw new Error('[ViceHub Admin] DATABASE_URL não definida.');
}

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
});

const ADMIN_ROLE_SLUG = 'admin';

/**
 * O email é normalizado como na autenticação: quem escrever o próprio
 * email com outra caixa tem de encontrar a mesma conta.
 */
const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const requireAdminRole = async (): Promise<string> => {
    const role = await prisma.role.findFirst({
        where: { slug: ADMIN_ROLE_SLUG, is_deleted: false },
        select: { id: true },
    });

    if (!role) {
        throw new Error(
            '[ViceHub Admin] O cargo "admin" não existe. Corre "npm run db:seed" primeiro.',
        );
    }

    return role.id;
};

const requireUser = async (email: string): Promise<{ id: string; username: string }> => {
    const user = await prisma.user.findFirst({
        where: { email: normalizeEmail(email), is_deleted: false },
        select: { id: true, username: true },
    });

    if (!user) {
        throw new Error(
            `[ViceHub Admin] Não existe conta com o email ${normalizeEmail(email)}. Regista-a primeiro pela API.`,
        );
    }

    return user;
};

const grant = async (email: string): Promise<void> => {
    const roleId = await requireAdminRole();
    const user = await requireUser(email);

    /**
     * O cargo de administrador é global: não pertence a nenhuma crew nem
     * servidor. Uma atribuição eliminada antes é reaproveitada em vez de
     * duplicada, para que o histórico não se multiplique.
     */
    const existente = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId, crewId: null, serverId: null },
        select: { id: true, is_deleted: true },
    });

    if (existente && !existente.is_deleted) {
        console.log(`[ViceHub Admin] ${user.username} já é administrador.`);
        return;
    }

    if (existente) {
        await prisma.userRole.update({
            where: { id: existente.id },
            data: {
                is_deleted: false,
                deleted_at: null,
                expires_at: null,
                version: { increment: 1 },
            },
        });
    } else {
        await prisma.userRole.create({
            data: { userId: user.id, roleId, source: SourceType.migration },
        });
    }

    console.log(`[ViceHub Admin] ${user.username} passou a administrador.`);
};

const revoke = async (email: string): Promise<void> => {
    const roleId = await requireAdminRole();
    const user = await requireUser(email);

    const resultado = await prisma.userRole.updateMany({
        where: {
            userId: user.id,
            roleId,
            crewId: null,
            serverId: null,
            is_deleted: false,
        },
        data: { is_deleted: true, deleted_at: new Date(), version: { increment: 1 } },
    });

    console.log(
        resultado.count === 0
            ? `[ViceHub Admin] ${user.username} não era administrador.`
            : `[ViceHub Admin] ${user.username} deixou de ser administrador.`,
    );
};

const list = async (): Promise<void> => {
    const roleId = await requireAdminRole();

    const atribuicoes = await prisma.userRole.findMany({
        where: { roleId, crewId: null, serverId: null, is_deleted: false },
        orderBy: { created_at: 'asc' },
        select: {
            created_at: true,
            user: { select: { username: true, email: true } },
        },
    });

    if (atribuicoes.length === 0) {
        console.log(
            '[ViceHub Admin] Não há administradores. Usa "npm run admin:grant -- <email>".',
        );
        return;
    }

    console.log(`[ViceHub Admin] ${atribuicoes.length} administrador(es):`);

    for (const atribuicao of atribuicoes) {
        console.log(
            `  ${atribuicao.user.username} <${atribuicao.user.email}>  desde ${atribuicao.created_at.toISOString().slice(0, 10)}`,
        );
    }
};

const main = async (): Promise<void> => {
    const [comando, email] = process.argv.slice(2);

    if (comando === 'list') {
        await list();
        return;
    }

    if (comando !== 'grant' && comando !== 'revoke') {
        throw new Error(
            '[ViceHub Admin] Uso: admin.ts <grant|revoke> <email> | admin.ts list',
        );
    }

    if (!email) {
        throw new Error(`[ViceHub Admin] Falta o email. Uso: admin.ts ${comando} <email>`);
    }

    await (comando === 'grant' ? grant(email) : revoke(email));
};

try {
    await main();
} catch (error: unknown) {
    console.error(
        error instanceof Error ? error.message : '[ViceHub Admin] Falhou:',
        error instanceof Error ? '' : error,
    );
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
