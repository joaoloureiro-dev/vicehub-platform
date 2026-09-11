import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GoogleClient } from '../../src/modules/auth/federated/google.client.js';

/**
 * O cliente da Google.
 *
 * A decisão sobre a conta é partilhada e testada à parte; o que aqui se
 * prova é só o que é próprio da Google — os escopos que se pedem, o
 * `prompt` que se manda, e a leitura de uma resposta que usa outros
 * nomes de campos que o Discord.
 */
describe('GoogleClient', () => {
    /**
     * A configuração é lida uma vez, quando o módulo do ambiente é
     * importado. Para a ter, põem-se as variáveis e volta a importar-se.
     */
    const comConfiguracao = async (): Promise<GoogleClient> => {
        vi.stubEnv('GOOGLE_CLIENT_ID', 'cliente-de-teste');
        vi.stubEnv('GOOGLE_CLIENT_SECRET', 'segredo-de-teste');
        vi.stubEnv(
            'GOOGLE_REDIRECT_URI',
            'http://localhost:3000/api/v1/auth/google/callback',
        );
        vi.resetModules();

        const { GoogleClient: Carregado } = await import(
            '../../src/modules/auth/federated/google.client.js'
        );

        return new Carregado();
    };

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    describe('para onde se manda quem quer entrar', () => {
        it('pede apenas identidade, email e nome', async () => {
            const client = await comConfiguracao();

            const url = new URL(client.buildAuthorizeUrl('o-state'));

            expect(url.origin + url.pathname).toBe(
                'https://accounts.google.com/o/oauth2/v2/auth',
            );
            expect(url.searchParams.get('scope')).toBe('openid email profile');
            expect(url.searchParams.get('state')).toBe('o-state');
            expect(url.searchParams.get('response_type')).toBe('code');
            expect(url.searchParams.get('client_id')).toBe('cliente-de-teste');
        });

        /**
         * **A diferença que dá cabo da entrada se for copiada do
         * Discord.** Para a Google, `prompt=none` quer dizer "não
         * mostres ecrã nenhum": quem não tivesse sessão iniciada lá
         * voltava com `interaction_required` e nunca entrava.
         */
        it('pede a escolha de conta, e não uma autorização silenciosa', async () => {
            const client = await comConfiguracao();

            const url = new URL(client.buildAuthorizeUrl('o-state'));

            expect(url.searchParams.get('prompt')).toBe('select_account');
        });

        /**
         * Sem configuração não há botão nenhum no ecrã de entrada, mas a
         * rota existe à mesma — e o que ela responde é que esta
         * instalação não tem isto ligado, e não um 500.
         */
        it('recusa-se a construir o endereço sem configuração', async () => {
            const { GoogleClient: Carregado } = await import(
                '../../src/modules/auth/federated/google.client.js'
            );

            expect(() => new Carregado().buildAuthorizeUrl('x')).toThrowError(
                expect.objectContaining({ code: 'FEDERATED_NOT_CONFIGURED' }),
            );
        });
    });

    describe('o que a Google responde sobre quem entrou', () => {
        const responder = (perfil: Record<string, unknown>) => {
            vi.stubGlobal(
                'fetch',
                vi.fn(() =>
                    Promise.resolve(
                        new Response(JSON.stringify(perfil), {
                            status: 200,
                            headers: { 'content-type': 'application/json' },
                        }),
                    ),
                ),
            );
        };

        it('lê o sub como identidade e o email_verified como confirmação', async () => {
            const client = await comConfiguracao();

            responder({
                sub: '11223344',
                name: 'Vice Guy',
                email: 'vice@gmail.test',
                email_verified: true,
            });

            expect(await client.fetchUser('token')).toEqual({
                id: '11223344',
                username: 'Vice Guy',
                email: 'vice@gmail.test',
                emailVerified: true,
            });
        });

        /**
         * A Google diz isto como booleano no endereço do perfil e como
         * texto dentro do `id_token`. Aceitar só um dos dois deixava
         * metade das contas sem conseguir ligar-se a uma que já existe.
         */
        it('aceita a confirmação escrita como texto', async () => {
            const client = await comConfiguracao();

            responder({
                sub: '1',
                email: 'texto@gmail.test',
                email_verified: 'true',
            });

            expect((await client.fetchUser('token')).emailVerified).toBe(true);
        });

        /**
         * **Tudo o resto conta como não confirmado.** É a leitura
         * segura: o que depende deste campo é ligar esta identidade a
         * uma conta que já existe aqui.
         */
        it.each([undefined, false, 'false', 'sim', 1, null])(
            'trata %s como email por confirmar',
            async (valor) => {
                const client = await comConfiguracao();

                responder({
                    sub: '1',
                    email: 'duvida@gmail.test',
                    email_verified: valor,
                });

                expect((await client.fetchUser('token')).emailVerified).toBe(
                    false,
                );
            },
        );

        /**
         * O nome só serve para propor um de utilizador. Não o conceder
         * não é motivo para recusar a entrada a ninguém.
         */
        it('cai para o nome próprio, e depois para o email, quando não há nome', async () => {
            const client = await comConfiguracao();

            responder({
                sub: '1',
                given_name: 'Vice',
                email: 'vice@gmail.test',
                email_verified: true,
            });

            expect((await client.fetchUser('token')).username).toBe('Vice');

            responder({
                sub: '1',
                email: 'sonome@gmail.test',
                email_verified: true,
            });

            expect((await client.fetchUser('token')).username).toBe('sonome');
        });

        /**
         * Sem `sub` não há a quem ligar a conta na entrada seguinte, e é
         * o único campo que a Google garante sempre.
         */
        it('recusa uma resposta sem sub', async () => {
            const client = await comConfiguracao();

            responder({ email: 'sem@gmail.test', email_verified: true });

            await expect(client.fetchUser('token')).rejects.toMatchObject({
                code: 'FEDERATED_EXCHANGE_FAILED',
            });
        });

        /**
         * A Google em baixo não é avaria nossa, e um erro de rede a
         * escapar daqui subia como 500.
         */
        it('traduz uma falha de rede em vez de a deixar subir', async () => {
            const client = await comConfiguracao();

            vi.stubGlobal(
                'fetch',
                vi.fn(() => Promise.reject(new Error('sem rede'))),
            );

            await expect(client.fetchUser('token')).rejects.toMatchObject({
                code: 'FEDERATED_UNAVAILABLE',
            });
        });
    });
});
