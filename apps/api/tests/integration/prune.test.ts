import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PRUNE_MARGEM_MS, prisma, prune } from '@vicehub/database';

/**
 * A limpeza do que expirou, contra PostgreSQL a sério.
 *
 * Só aqui se vê a parte que pode correr mal: apagar uma sessão leva os
 * refresh tokens dela atrás por `onDelete: Cascade`, e é essa cascata —
 * que nenhum duplo em memória imita — que faria uma condição a mais
 * apagar em silêncio o que ainda fazia falta.
 *
 * O que ainda faz falta é isto: **um refresh token rodado é o que deteta
 * um roubo.** Se alguém apresentar um token já substituído, a API sabe
 * que existem duas cópias em circulação e derruba a família inteira.
 * Essa deteção lê a linha. Apagá-la cedo troca "sessão derrubada" por
 * "token inválido", e a sessão a sério continua aberta — sem que nada o
 * diga.
 */
describe('apagar o que expirou', () => {
    const marca = `prune${Date.now()}`;

    let userId: string;

    /** Quanto tempo atrás uma coisa tem de estar para ser apagada. */
    const expiradoHaMuito = () => new Date(Date.now() - PRUNE_MARGEM_MS - 60_000);
    const expiradoAgorinha = () => new Date(Date.now() - 60_000);
    const porExpirar = () => new Date(Date.now() + 86_400_000);

    const criarSessao = async (expiresAt: Date): Promise<string> => {
        const sessao = await prisma.authSession.create({
            data: { userId, expires_at: expiresAt },
            select: { id: true },
        });

        return sessao.id;
    };

    const criarRefreshToken = async (
        sessionId: string,
        expiresAt: Date,
        status: 'active' | 'rotated' | 'revoked' = 'active',
    ): Promise<string> => {
        const token = await prisma.refreshToken.create({
            data: {
                sessionId,
                token_hash: `${marca}-${Math.random()}`,
                expires_at: expiresAt,
                status,
            },
            select: { id: true },
        });

        return token.id;
    };

    beforeAll(async () => {
        const utilizador = await prisma.user.create({
            data: {
                email: `${marca}@vicehub.test`,
                username: marca.slice(0, 20),
            },
            select: { id: true },
        });

        userId = utilizador.id;
    });

    afterAll(async () => {
        await prisma.user.delete({ where: { id: userId } });
        await prisma.$disconnect();
    });

    /**
     * O caso que dá nome a tudo isto. O token está rodado — "já não
     * serve", diria quem escrevesse a condição pelo estado — mas serve
     * para derrubar a sessão se voltar a aparecer.
     */
    it('não apaga um refresh token rodado que ainda está dentro do prazo', async () => {
        const sessao = await criarSessao(porExpirar());
        const rodado = await criarRefreshToken(sessao, porExpirar(), 'rotated');

        await prune(prisma);

        expect(
            await prisma.refreshToken.findUnique({ where: { id: rodado } }),
        ).not.toBeNull();
    });

    /**
     * O mesmo pela outra porta: apagar a sessão levaria o token atrás
     * pela cascata, sem que a regra dos tokens tivesse dito nada.
     */
    it('não apaga uma sessão revogada cujos tokens ainda estão dentro do prazo', async () => {
        const sessao = await criarSessao(porExpirar());

        await prisma.authSession.update({
            where: { id: sessao },
            data: { status: 'revoked', revoked_at: new Date() },
        });

        const rodado = await criarRefreshToken(sessao, porExpirar(), 'rotated');

        await prune(prisma);

        expect(
            await prisma.authSession.findUnique({ where: { id: sessao } }),
        ).not.toBeNull();
        expect(
            await prisma.refreshToken.findUnique({ where: { id: rodado } }),
        ).not.toBeNull();
    });

    /**
     * A margem existe porque os relógios não são o mesmo e um pedido em
     * curso pode ter lido a linha um instante antes de ela expirar.
     */
    it('não apaga o que expirou agora mesmo', async () => {
        const sessao = await criarSessao(expiradoAgorinha());
        const token = await criarRefreshToken(sessao, expiradoAgorinha());

        await prune(prisma);

        expect(
            await prisma.refreshToken.findUnique({ where: { id: token } }),
        ).not.toBeNull();
    });

    it('apaga o que expirou há muito', async () => {
        const sessao = await criarSessao(expiradoHaMuito());
        const token = await criarRefreshToken(sessao, expiradoHaMuito());

        const resultado = await prune(prisma);

        expect(resultado.refreshTokens).toBeGreaterThan(0);
        expect(
            await prisma.refreshToken.findUnique({ where: { id: token } }),
        ).toBeNull();
        expect(
            await prisma.authSession.findUnique({ where: { id: sessao } }),
        ).toBeNull();
    });

    it('apaga um token de conta já usado', async () => {
        const token = await prisma.accountToken.create({
            data: {
                userId,
                purpose: 'password_reset',
                token_hash: `${marca}-usado-${Math.random()}`,
                created_at: expiradoHaMuito(),
                expires_at: porExpirar(),
                used_at: expiradoHaMuito(),
            },
            select: { id: true },
        });

        await prune(prisma);

        expect(
            await prisma.accountToken.findUnique({ where: { id: token.id } }),
        ).toBeNull();
    });

    it('não apaga um token de conta por usar e dentro do prazo', async () => {
        const token = await prisma.accountToken.create({
            data: {
                userId,
                purpose: 'email_verification',
                token_hash: `${marca}-vivo-${Math.random()}`,
                expires_at: porExpirar(),
            },
            select: { id: true },
        });

        await prune(prisma);

        expect(
            await prisma.accountToken.findUnique({ where: { id: token.id } }),
        ).not.toBeNull();
    });
});
