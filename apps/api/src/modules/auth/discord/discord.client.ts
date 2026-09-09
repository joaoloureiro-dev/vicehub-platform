import { discordConfig } from '../../../config/env.js';
import { AuthError } from '../errors/auth.errors.js';

const AUTORIZACAO = 'https://discord.com/oauth2/authorize';
const TOKEN = 'https://discord.com/api/oauth2/token';
const EU = 'https://discord.com/api/users/@me';

/**
 * O que se pede ao Discord.
 *
 * `identify` dá o identificador e o nome; `email` dá o endereço e se
 * está confirmado. Não se pede mais nada — nem servidores, nem amigos:
 * o que se pede aparece escrito no ecrã de autorização, e pedir o que
 * não se usa é a forma mais rápida de alguém carregar em "cancelar".
 */
const ESCOPOS = 'identify email';

/**
 * Quanto tempo se espera pelo Discord antes de desistir.
 *
 * Sem limite, um Discord lento prendia um pedido nosso até o browser
 * desistir, e quem entrasse não ficava a saber porquê.
 */
const ESPERA_MS = 10_000;

export interface DiscordUser {
    id: string;
    username: string;
    email: string | null;
    /** Se o Discord confirmou o endereço. É disto que depende ligar contas. */
    emailVerified: boolean;
}

/**
 * Fala com o Discord.
 *
 * Separado do serviço para que a decisão — quem entra, quem se liga a
 * que conta — seja testável sem rede, e para que o que aqui se faz seja
 * apenas HTTP.
 */
export class DiscordClient {
    /**
     * O endereço para onde se manda quem carrega em "entrar com Discord".
     */
    buildAuthorizeUrl(state: string): string {
        const config = this.requireConfig();

        const parametros = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: 'code',
            scope: ESCOPOS,
            state,
            /**
             * Sem isto, quem já autorizou uma vez volta a ver o ecrã de
             * consentimento a cada entrada. `none` só o mostra quando há
             * de facto algo por autorizar.
             */
            prompt: 'none',
        });

        return `${AUTORIZACAO}?${parametros.toString()}`;
    }

    /**
     * Troca o código de uso único por um token de acesso.
     *
     * O token não é guardado em lado nenhum: serve para a única pergunta
     * que se lhe faz a seguir — quem és tu. Guardá-lo seria guardar uma
     * chave para a conta de Discord de outra pessoa sem precisar dela.
     */
    async exchangeCode(code: string): Promise<string> {
        const config = this.requireConfig();

        const resposta = await this.pedir(TOKEN, {
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
                'DISCORD_EXCHANGE_FAILED',
                'O Discord recusou o código de autorização.',
            );
        }

        const corpo = (await resposta.json()) as { access_token?: unknown };

        if (typeof corpo.access_token !== 'string') {
            throw new AuthError(
                'DISCORD_EXCHANGE_FAILED',
                'O Discord respondeu sem token de acesso.',
            );
        }

        return corpo.access_token;
    }

    /**
     * Quem é o dono deste token.
     */
    async fetchUser(accessToken: string): Promise<DiscordUser> {
        const resposta = await this.pedir(EU, {
            headers: { authorization: `Bearer ${accessToken}` },
        });

        if (!resposta.ok) {
            throw new AuthError(
                'DISCORD_EXCHANGE_FAILED',
                'O Discord recusou dizer quem é o dono do token.',
            );
        }

        const corpo = (await resposta.json()) as {
            id?: unknown;
            username?: unknown;
            email?: unknown;
            verified?: unknown;
        };

        if (typeof corpo.id !== 'string' || typeof corpo.username !== 'string') {
            throw new AuthError(
                'DISCORD_EXCHANGE_FAILED',
                'O Discord respondeu sem identificar o utilizador.',
            );
        }

        return {
            id: corpo.id,
            username: corpo.username,
            email: typeof corpo.email === 'string' ? corpo.email : null,
            /**
             * Ausente conta como não confirmado. É a leitura segura: o
             * que depende disto é ligar-se a uma conta que já existe.
             */
            emailVerified: corpo.verified === true,
        };
    }

    private async pedir(url: string, init: RequestInit): Promise<Response> {
        try {
            return await fetch(url, {
                ...init,
                signal: AbortSignal.timeout(ESPERA_MS),
            });
        } catch {
            throw new AuthError(
                'DISCORD_UNAVAILABLE',
                'Não foi possível falar com o Discord.',
            );
        }
    }

    private requireConfig() {
        if (discordConfig === null) {
            throw new AuthError(
                'DISCORD_NOT_CONFIGURED',
                'Entrar com Discord não está configurado nesta instalação.',
            );
        }

        return discordConfig;
    }
}
