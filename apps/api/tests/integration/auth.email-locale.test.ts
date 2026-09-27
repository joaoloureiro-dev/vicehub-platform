import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * O email sai na língua que o pedido disse, de ponta a ponta.
 *
 * Os testes unitários provam que as quatro versões existem e dizem
 * coisas diferentes. O que só aqui se prova é que o idioma **atravessa**
 * a rota, o schema, o controlador e o serviço até ao email — que é onde
 * um campo se perde sem dar erro nenhum: o Zod descarta o que o schema
 * não declara, e um `locale` que não estivesse lá desaparecia em
 * silêncio e toda a gente continuava a receber inglês.
 *
 * Sem SMTP configurado o email vai para o log, com o assunto no meio.
 * É de lá que ele é lido: o que interessa verificar é a língua, não o
 * servidor de correio.
 */
describe('a língua do email', () => {
    let app: FastifyInstance;

    const marca = `loc${Date.now()}`;
    const password = 'Sup3rS3cret!Pass';

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /** O assunto do último email que o mailer pôs no log. */
    const assuntoDoEmail = async (
        pedir: () => Promise<unknown>,
    ): Promise<string | undefined> => {
        const espia = vi.spyOn(app.log, 'info');

        try {
            await pedir();

            for (const chamada of [...espia.mock.calls].reverse()) {
                const carga = chamada[0] as { subject?: string } | undefined;

                if (carga?.subject !== undefined) {
                    return carga.subject;
                }
            }

            return undefined;
        } finally {
            espia.mockRestore();
        }
    };

    const registar = async (sufixo: string): Promise<string> => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${marca}${sufixo}@vicehub.test`,
                username: `${marca}${sufixo}`,
                password,
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return `${marca}${sufixo}@vicehub.test`;
    };

    it.each([
        ['en', 'Reset your ViceHub password'],
        ['pt', 'Recuperar a tua password do ViceHub'],
        ['es', 'Restablecer tu contraseña de ViceHub'],
        ['fr', 'Réinitialiser ton mot de passe ViceHub'],
    ])('a recuperação pedida em %s chega em %s', async (idioma, assunto) => {
        const email = await registar(idioma);

        const escrito = await assuntoDoEmail(() =>
            app.inject({
                method: 'POST',
                url: '/api/v1/auth/password-reset',
                payload: { email, locale: idioma },
            }),
        );

        expect(escrito).toBe(assunto);
    });

    /**
     * E um pedido sem idioma nenhum sai em inglês.
     *
     * É o caso de um cliente antigo, ou de um guião: a rota existia sem
     * este campo, e continuar a servi-los é a razão de ele ser opcional.
     * Sair em português seria escolher a língua de quem fez a plataforma
     * em vez da de quem a usa — que é o defeito que isto veio corrigir.
     */
    it('sem idioma, sai em inglês', async () => {
        const email = await registar('sem');

        const escrito = await assuntoDoEmail(() =>
            app.inject({
                method: 'POST',
                url: '/api/v1/auth/password-reset',
                payload: { email },
            }),
        );

        expect(escrito).toBe('Reset your ViceHub password');
    });

    /** E a confirmação do endereço segue a mesma regra. */
    it('a confirmação do email também', async () => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${marca}conf@vicehub.test`,
                username: `${marca}conf`,
                password,
            },
        });

        const token = resposta.json().accessToken as string;

        const escrito = await assuntoDoEmail(() =>
            app.inject({
                method: 'POST',
                url: '/api/v1/auth/email-verification',
                headers: { authorization: `Bearer ${token}` },
                payload: { locale: 'fr' },
            }),
        );

        expect(escrito).toBe('Confirme ton adresse e-mail sur ViceHub');
    });
});
