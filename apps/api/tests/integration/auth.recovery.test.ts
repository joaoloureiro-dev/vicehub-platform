import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { AuthRepository } from '../../src/modules/auth/repositories/auth.repository.js';

/**
 * Recuperar a conta, de ponta a ponta e contra PostgreSQL a sério.
 *
 * O que só aqui se prova: que a recuperação **derruba mesmo** as sessões
 * abertas. Quem recupera uma conta costuma fazê-lo por desconfiar de que
 * outra pessoa lá entrou; trocar a password sem expulsar essa pessoa
 * resolveria a metade errada do problema. Um duplo diria que os métodos
 * foram chamados — só um access token verdadeiro a levar 401 mostra que
 * a sessão caiu.
 *
 * Sem SMTP configurado o email fica no log, e é por isso que o token é
 * lido da base de dados: o que interessa verificar é a mecânica, não o
 * servidor de correio.
 */
describe('recuperação de conta', () => {
    let app: FastifyInstance;

    const marca = `rec${Date.now()}`;
    const email = `${marca}@vicehub.test`;
    const passwordOriginal = 'Sup3rS3cret!Pass';
    const passwordNova = 'Ou7roS3gredo!Forte';

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    const register = async (username: string, address: string) => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: { email: address, username, password: passwordOriginal },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().accessToken as string;
    };

    const login = (address: string, password: string) =>
        app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: { email: address, password },
        });

    const pedirRecuperacao = (address: string) =>
        app.inject({
            method: 'POST',
            url: '/api/v1/auth/password-reset',
            payload: { email: address },
        });

    /**
     * O segredo não fica na base de dados — só o seu resumo. Para o
     * teste seguir o fluxo é preciso o caminho inverso: gerar um segredo,
     * gravar-lhe o resumo, e usar o segredo como se tivesse chegado por
     * email.
     */
    /**
     * O resumo do segredo — o que a base de dados guarda, e a única
     * forma de lá encontrar um token a partir do que seguiu no email.
     */
    const resumo = (segredo: string): string =>
        crypto.createHash('sha256').update(segredo).digest('hex');

    const emitirTokenPara = async (
        userId: string,
        purpose: 'password_reset' | 'email_verification',
    ): Promise<string> => {
        const segredo = crypto.randomBytes(32).toString('base64url');

        await prisma.accountToken.create({
            data: {
                userId,
                purpose,
                token_hash: resumo(segredo),
                expires_at: new Date(Date.now() + 3_600_000),
            },
        });

        return segredo;
    };

    const confirmarRecuperacao = (token: string, password: string) =>
        app.inject({
            method: 'POST',
            url: '/api/v1/auth/password-reset/confirm',
            payload: { token, password },
        });

    describe('pedir o link', () => {
        /**
         * Se a resposta distinguisse os dois casos, qualquer pessoa
         * descobria quem está registado experimentando endereços.
         */
        it('responde igual para uma conta que existe e uma que não', async () => {
            await register(marca, email);

            const existente = await pedirRecuperacao(email);
            const inexistente = await pedirRecuperacao(
                `ninguem-${marca}@vicehub.test`,
            );

            expect(existente.statusCode).toBe(202);
            expect(inexistente.statusCode).toBe(202);
            expect(existente.body).toBe(inexistente.body);
        });

        it('só grava token para a conta que existe', async () => {
            const tokens = await prisma.accountToken.count({
                where: { user: { email }, purpose: 'password_reset' },
            });

            expect(tokens).toBeGreaterThan(0);
        });

        /**
         * O que fica gravado não serve para entrar em conta nenhuma: é
         * um resumo, não o segredo.
         */
        it('grava o resumo, nunca o segredo', async () => {
            const token = await prisma.accountToken.findFirstOrThrow({
                where: { user: { email }, purpose: 'password_reset' },
                orderBy: { created_at: 'desc' },
                select: { token_hash: true },
            });

            expect(token.token_hash).toMatch(/^[0-9a-f]{64}$/);
        });

        /**
         * Pedir outro link mata o anterior, para que um email antigo não
         * continue a abrir a conta.
         */
        it('pedir outro link invalida o anterior', async () => {
            const utilizador = await prisma.user.findFirstOrThrow({
                where: { email },
                select: { id: true },
            });

            const primeiro = await emitirTokenPara(utilizador.id, 'password_reset');

            await pedirRecuperacao(email);

            const resposta = await confirmarRecuperacao(primeiro, passwordNova);

            expect(resposta.statusCode, resposta.body).toBe(400);
            expect(resposta.json().code).toBe('INVALID_ACCOUNT_TOKEN');
        });
    });

    /**
     * O coração da coisa.
     */
    describe('a recuperação expulsa quem estava dentro', () => {
        const intruso = `${marca}i`;
        const emailIntruso = `${intruso}@vicehub.test`;

        let tokenDeQuemLaEstava: string;
        let userId: string;

        beforeAll(async () => {
            const acesso = await register(intruso, emailIntruso);

            tokenDeQuemLaEstava = acesso;

            userId = (
                await prisma.user.findFirstOrThrow({
                    where: { email: emailIntruso },
                    select: { id: true },
                })
            ).id;
        });

        it('a sessão aberta funciona antes da recuperação', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/me',
                headers: { authorization: `Bearer ${tokenDeQuemLaEstava}` },
            });

            expect(resposta.statusCode, resposta.body).toBe(200);
        });

        it('define a password nova a partir do link', async () => {
            const segredo = await emitirTokenPara(userId, 'password_reset');

            const resposta = await confirmarRecuperacao(segredo, passwordNova);

            expect(resposta.statusCode, resposta.body).toBe(204);
        });

        /**
         * Esta é a asserção que justifica a suite existir: o token que
         * funcionava há dois testes deixa de funcionar.
         */
        it('e a sessão que estava aberta deixa de funcionar', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/me',
                headers: { authorization: `Bearer ${tokenDeQuemLaEstava}` },
            });

            expect(resposta.statusCode, resposta.body).toBe(401);
        });

        it('as sessões ficam revogadas na base de dados', async () => {
            const ativas = await prisma.authSession.count({
                where: { userId, status: 'active', is_deleted: false },
            });

            expect(ativas).toBe(0);
        });

        it('a password antiga já não entra', async () => {
            const resposta = await login(emailIntruso, passwordOriginal);

            expect(resposta.statusCode).toBe(401);
        });

        it('a password nova entra', async () => {
            const resposta = await login(emailIntruso, passwordNova);

            expect(resposta.statusCode, resposta.body).toBe(200);
        });
    });

    describe('um link serve uma vez', () => {
        it('a segunda utilização é recusada', async () => {
            const conta = `${marca}u`;

            await register(conta, `${conta}@vicehub.test`);

            const userId = (
                await prisma.user.findFirstOrThrow({
                    where: { email: `${conta}@vicehub.test` },
                    select: { id: true },
                })
            ).id;

            const segredo = await emitirTokenPara(userId, 'password_reset');

            expect((await confirmarRecuperacao(segredo, passwordNova)).statusCode).toBe(
                204,
            );

            const segunda = await confirmarRecuperacao(segredo, 'Terceira!Pass9');

            expect(segunda.statusCode, segunda.body).toBe(400);
        });

        /**
         * Duas utilizações em paralelo é o caso que uma leitura antes da
         * escrita deixaria passar: ambas leriam "por usar", e a segunda
         * escreveria uma password que quem recuperou a conta não
         * escolheu.
         */
        it('duas utilizações ao mesmo tempo só contam uma vez', async () => {
            const conta = `${marca}p`;

            await register(conta, `${conta}@vicehub.test`);

            const userId = (
                await prisma.user.findFirstOrThrow({
                    where: { email: `${conta}@vicehub.test` },
                    select: { id: true },
                })
            ).id;

            const segredo = await emitirTokenPara(userId, 'password_reset');

            const [primeira, segunda] = await Promise.all([
                confirmarRecuperacao(segredo, passwordNova),
                confirmarRecuperacao(segredo, 'Terceira!Pass9'),
            ]);

            const estados = [primeira.statusCode, segunda.statusCode].sort();

            expect(estados).toEqual([204, 400]);

            /**
             * E a password que ficou é a do pedido que ganhou — não a do
             * que chegou tarde.
             */
            const entrou = await login(`${conta}@vicehub.test`, passwordNova);

            expect(entrou.statusCode, entrou.body).toBe(200);
        });
    });

    /**
     * O prazo.
     *
     * Um link de recuperação é uma chave para entrar na conta. Uma caixa
     * de correio comprometida ontem não deve abrir nada hoje, e é o
     * prazo que garante isso — a única parte da mecânica que o tempo
     * sozinho põe à prova.
     */
    describe('um link expirado não serve', () => {
        /**
         * Um token não pode nascer expirado: a base de dados exige
         * `expires_at > created_at`, e com razão — um pedido que
         * devolvesse um link morto pareceria ter corrido bem.
         *
         * Por isso o token nasce válido e é **envelhecido** a seguir,
         * recuando as duas datas em conjunto. É o que o tempo faz na
         * realidade, e mexer só no prazo bateria na mesma restrição.
         */
        const envelhecer = async (segredo: string): Promise<void> => {
            const agora = Date.now();

            await prisma.accountToken.updateMany({
                where: { token_hash: resumo(segredo) },
                data: {
                    created_at: new Date(agora - 7_200_000),
                    expires_at: new Date(agora - 3_600_000),
                },
            });
        };

        it('recusa a recuperação com um link fora do prazo', async () => {
            const conta = `${marca}e`;

            await register(conta, `${conta}@vicehub.test`);

            const userId = (
                await prisma.user.findFirstOrThrow({
                    where: { email: `${conta}@vicehub.test` },
                    select: { id: true },
                })
            ).id;

            const segredo = await emitirTokenPara(userId, 'password_reset');

            await envelhecer(segredo);

            const resposta = await confirmarRecuperacao(segredo, passwordNova);

            expect(resposta.statusCode, resposta.body).toBe(400);
            expect(resposta.json().code).toBe('INVALID_ACCOUNT_TOKEN');
        });

        it('e a password antiga continua a valer', async () => {
            const entrou = await login(
                `${marca}e@vicehub.test`,
                passwordOriginal,
            );

            expect(entrou.statusCode, entrou.body).toBe(200);
        });
    });

    /**
     * O uso único, verificado onde ele vive.
     *
     * Pela API isto não se distingue: a consulta que procura o token já
     * exclui os usados, por isso a segunda tentativa é recusada mesmo
     * que a escrita não tivesse condição nenhuma. A condição no `where`
     * da escrita é a defesa que resta quando dois pedidos leem ao mesmo
     * tempo — e essa só se põe à prova chamando o repositório
     * diretamente.
     */
    describe('gastar um token é uma operação de uma vez só', () => {
        it('a segunda tentativa de gastar o mesmo token não pega', async () => {
            const conta = `${marca}c`;

            await register(conta, `${conta}@vicehub.test`);

            const userId = (
                await prisma.user.findFirstOrThrow({
                    where: { email: `${conta}@vicehub.test` },
                    select: { id: true },
                })
            ).id;

            const segredo = await emitirTokenPara(userId, 'password_reset');

            const repositorio = new AuthRepository(prisma);

            const token = await repositorio.findUsableAccountToken(
                resumo(segredo),
                'password_reset',
            );

            expect(token).not.toBeNull();

            const primeira = await repositorio.consumeAccountToken(
                (token as { id: string }).id,
            );
            const segunda = await repositorio.consumeAccountToken(
                (token as { id: string }).id,
            );

            expect(primeira).toBe(true);
            expect(segunda).toBe(false);
        });

        /**
         * E duas tentativas em simultâneo: exatamente uma ganha.
         */
        it('duas tentativas ao mesmo tempo, exatamente uma ganha', async () => {
            const conta = `${marca}cc`;

            await register(conta, `${conta}@vicehub.test`);

            const userId = (
                await prisma.user.findFirstOrThrow({
                    where: { email: `${conta}@vicehub.test` },
                    select: { id: true },
                })
            ).id;

            const segredo = await emitirTokenPara(userId, 'password_reset');

            const repositorio = new AuthRepository(prisma);

            const token = (await repositorio.findUsableAccountToken(
                resumo(segredo),
                'password_reset',
            )) as { id: string };

            const resultados = await Promise.all([
                repositorio.consumeAccountToken(token.id),
                repositorio.consumeAccountToken(token.id),
            ]);

            expect(resultados.filter(Boolean)).toHaveLength(1);
        });
    });

    describe('um token não serve para o outro propósito', () => {
        /**
         * Confirmar um email e recuperar uma password são poderes
         * diferentes. Se um token servisse para os dois, bastaria pedir
         * a confirmação — que não abre nada — para trocar a password.
         */
        it('um token de confirmação de email não troca a password', async () => {
            const conta = `${marca}x`;

            await register(conta, `${conta}@vicehub.test`);

            const userId = (
                await prisma.user.findFirstOrThrow({
                    where: { email: `${conta}@vicehub.test` },
                    select: { id: true },
                })
            ).id;

            const segredo = await emitirTokenPara(userId, 'email_verification');

            const resposta = await confirmarRecuperacao(segredo, passwordNova);

            expect(resposta.statusCode, resposta.body).toBe(400);

            const entrou = await login(`${conta}@vicehub.test`, passwordOriginal);

            expect(entrou.statusCode, entrou.body).toBe(200);
        });

        it('um token de recuperação não confirma o email', async () => {
            const conta = `${marca}y`;

            await register(conta, `${conta}@vicehub.test`);

            const userId = (
                await prisma.user.findFirstOrThrow({
                    where: { email: `${conta}@vicehub.test` },
                    select: { id: true },
                })
            ).id;

            const segredo = await emitirTokenPara(userId, 'password_reset');

            const resposta = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/email-verification/confirm',
                payload: { token: segredo },
            });

            expect(resposta.statusCode, resposta.body).toBe(400);

            const utilizador = await prisma.user.findFirstOrThrow({
                where: { id: userId },
                select: { email_verified_at: true },
            });

            expect(utilizador.email_verified_at).toBeNull();
        });
    });

    describe('confirmar o email', () => {
        it('marca o endereço como confirmado', async () => {
            const conta = `${marca}v`;

            await register(conta, `${conta}@vicehub.test`);

            const userId = (
                await prisma.user.findFirstOrThrow({
                    where: { email: `${conta}@vicehub.test` },
                    select: { id: true },
                })
            ).id;

            const segredo = await emitirTokenPara(userId, 'email_verification');

            const resposta = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/email-verification/confirm',
                payload: { token: segredo },
            });

            expect(resposta.statusCode, resposta.body).toBe(204);

            const utilizador = await prisma.user.findFirstOrThrow({
                where: { id: userId },
                select: { email_verified_at: true },
            });

            expect(utilizador.email_verified_at).not.toBeNull();
        });

        it('pedir confirmação exige sessão', async () => {
            const resposta = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/email-verification',
            });

            expect(resposta.statusCode).toBe(401);
        });
    });

    describe('a password nova passa pelas regras do registo', () => {
        /**
         * Uma conta recuperada não deve ficar mais fraca do que era.
         */
        it('recusa uma password fraca', async () => {
            const conta = `${marca}w`;

            await register(conta, `${conta}@vicehub.test`);

            const userId = (
                await prisma.user.findFirstOrThrow({
                    where: { email: `${conta}@vicehub.test` },
                    select: { id: true },
                })
            ).id;

            const segredo = await emitirTokenPara(userId, 'password_reset');

            const resposta = await confirmarRecuperacao(segredo, '123');

            expect(resposta.statusCode, resposta.body).toBe(400);
        });
    });
});
