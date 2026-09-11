import { googleConfig } from '../../../config/env.js';
import { AuthError } from '../errors/auth.errors.js';

import {
    pedirAoFornecedor,
    type FederatedClient,
    type FederatedProfile,
} from './federated.client.js';

const AUTORIZACAO = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const EU = 'https://openidconnect.googleapis.com/v1/userinfo';

/**
 * O que se pede à Google.
 *
 * `openid` e `email` dão o identificador e o endereço com a indicação
 * de estar confirmado; `profile` dá o nome, que serve só para propor um
 * nome de utilizador. Nada de Drive, agenda ou contactos: o que se pede
 * aparece escrito no ecrã de autorização, e pedir o que não se usa é a
 * forma mais rápida de alguém carregar em "cancelar" — e, no caso da
 * Google, de a aplicação cair numa revisão de segurança que demora
 * semanas.
 */
const ESCOPOS = 'openid email profile';

/**
 * Fala com a Google.
 *
 * O desenho é o mesmo do Discord porque o protocolo é o mesmo. O que
 * muda são três coisas, e são precisamente as que este ficheiro existe
 * para guardar: os endereços, o nome do campo que diz se o email está
 * confirmado (`email_verified` e não `verified`), e o que se manda no
 * `prompt`.
 */
export class GoogleClient implements FederatedClient {
    buildAuthorizeUrl(state: string): string {
        const config = this.requireConfig();

        const parametros = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: 'code',
            scope: ESCOPOS,
            state,
            /**
             * `select_account` e **não** `none` como no Discord.
             *
             * Para a Google, `prompt=none` quer dizer "não mostres ecrã
             * nenhum", e se a pessoa não estiver com sessão iniciada lá
             * o regresso vem com `interaction_required` em vez de com um
             * código — ou seja, quem não tivesse a Google aberta nunca
             * conseguia entrar. `select_account` mostra a escolha de
             * conta, que é o que faz falta a quem tem mais do que uma.
             */
            prompt: 'select_account',
        });

        return `${AUTORIZACAO}?${parametros.toString()}`;
    }

    /**
     * Troca o código de uso único por um token de acesso.
     *
     * A resposta também traz um `id_token` assinado com o perfil lá
     * dentro, e lê-lo pouparia um pedido. Não se faz: lê-lo em condições
     * obriga a verificar a assinatura contra as chaves públicas da
     * Google, que rodam, e a versão descuidada — descodificar o JWT sem
     * verificar nada — aceitaria qualquer perfil que alguém inventasse.
     * Uma pergunta a mais pela rede é mais barata do que isso.
     */
    async exchangeCode(code: string): Promise<string> {
        const config = this.requireConfig();

        const resposta = await pedirAoFornecedor('a Google', TOKEN, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                grant_type: 'authorization_code',
                code,
                redirect_uri: config.redirectUri,
            }).toString(),
        });

        if (!resposta.ok) {
            throw new AuthError(
                'FEDERATED_EXCHANGE_FAILED',
                'A Google recusou o código de autorização.',
            );
        }

        const corpo = (await resposta.json()) as { access_token?: unknown };

        if (typeof corpo.access_token !== 'string') {
            throw new AuthError(
                'FEDERATED_EXCHANGE_FAILED',
                'A Google respondeu sem token de acesso.',
            );
        }

        return corpo.access_token;
    }

    async fetchUser(accessToken: string): Promise<FederatedProfile> {
        const resposta = await pedirAoFornecedor('a Google', EU, {
            headers: { authorization: `Bearer ${accessToken}` },
        });

        if (!resposta.ok) {
            throw new AuthError(
                'FEDERATED_EXCHANGE_FAILED',
                'A Google recusou dizer quem é o dono do token.',
            );
        }

        const corpo = (await resposta.json()) as {
            sub?: unknown;
            name?: unknown;
            given_name?: unknown;
            email?: unknown;
            email_verified?: unknown;
        };

        /**
         * O `sub` é o único campo que a Google garante sempre, e é o que
         * fica guardado como identidade. Sem ele não há a quem ligar a
         * conta na entrada seguinte.
         */
        if (typeof corpo.sub !== 'string') {
            throw new AuthError(
                'FEDERATED_EXCHANGE_FAILED',
                'A Google respondeu sem identificar o utilizador.',
            );
        }

        const email = typeof corpo.email === 'string' ? corpo.email : null;

        return {
            id: corpo.sub,
            /**
             * O nome pode não vir — basta a pessoa não conceder o
             * `profile`. Não é motivo para recusar a entrada: cai-se
             * para o nome próprio, depois para a parte do email antes do
             * `@`, e o que sobrar é a limpeza do nome que decide.
             */
            username: this.nomeDePartida(corpo.name, corpo.given_name, email),
            email,
            /**
             * A Google diz-nos isto como booleano no endereço do perfil
             * e como texto dentro do `id_token`. Aceitam-se os dois, e
             * tudo o resto conta como **não** confirmado: o que depende
             * deste campo é ligar-se a uma conta que já existe aqui.
             */
            emailVerified:
                corpo.email_verified === true || corpo.email_verified === 'true',
        };
    }

    private nomeDePartida(
        nome: unknown,
        proprio: unknown,
        email: string | null,
    ): string {
        if (typeof nome === 'string' && nome.length > 0) {
            return nome;
        }

        if (typeof proprio === 'string' && proprio.length > 0) {
            return proprio;
        }

        return email?.split('@')[0] ?? '';
    }

    private requireConfig() {
        if (googleConfig === null) {
            throw new AuthError(
                'FEDERATED_NOT_CONFIGURED',
                'Entrar com Google não está configurado nesta instalação.',
            );
        }

        return googleConfig;
    }
}
