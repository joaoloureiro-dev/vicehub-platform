import { AuthProviderType } from '@vicehub/database';
import { randomBytes } from 'node:crypto';

import { normalizeEmail } from './email.js';
import type { DiscordClient, DiscordUser } from '../discord/discord.client.js';
import { AuthError } from '../errors/auth.errors.js';
import type { AuthRepository } from '../repositories/auth.repository.js';

/**
 * Quantas variações de um nome se tentam antes de desistir dele.
 *
 * Nomes de Discord repetem-se, e o nosso é único. Ao fim destas o nome
 * passa a levar aleatoriedade em vez de um número — tentar
 * indefinidamente seria uma consulta por cada tentativa.
 */
const TENTATIVAS_DE_NOME = 5;

export interface DiscordLoginOutcome {
    userId: string;
    /** Se a conta foi criada agora, para quem chama poder distinguir. */
    criada: boolean;
}

/**
 * Entrar com Discord.
 *
 * O que aqui se decide é uma coisa só: **a que conta pertence esta
 * identidade do Discord**. As três respostas possíveis, por ordem:
 *
 * 1. Já esteve cá — há uma identidade ligada, e entra nessa conta.
 * 2. Nunca cá esteve, mas o email já tem conta — liga-se a essa, e só
 *    **se o Discord confirmar o endereço**.
 * 3. Nem uma coisa nem outra — cria conta.
 *
 * O `se` do ponto 2 é a regra que não se pode perder de vista: sem ele,
 * registar no Discord o email de outra pessoa dava entrada na conta
 * dela aqui. O Discord deixa mudar de email sem confirmar, e o campo
 * `verified` é precisamente a diferença.
 */
export class DiscordAuthService {
    constructor(
        private readonly authRepository: AuthRepository,
        private readonly discordClient: DiscordClient,
    ) { }

    /**
     * O segredo que liga a ida ao Discord ao regresso.
     *
     * Sem ele, qualquer pessoa podia mandar-te um link de retorno com o
     * código dela e deixar-te a usar a plataforma na conta dela sem
     * dares por isso — o que parece inofensivo até reparares que tudo
     * o que lá escreves fica na conta de outra pessoa.
     */
    generateState(): string {
        return randomBytes(32).toString('base64url');
    }

    buildAuthorizeUrl(state: string): string {
        return this.discordClient.buildAuthorizeUrl(state);
    }

    /**
     * Confirma que este regresso corresponde à ida.
     *
     * Comparação de comprimento constante não é precisa aqui: o valor
     * não é um segredo partilhado a adivinhar por tentativas, é um
     * emparelhamento de uso único que o próprio browser guardou.
     */
    assertState(recebido: string | undefined, esperado: string | undefined): void {
        if (
            recebido === undefined ||
            esperado === undefined ||
            recebido !== esperado
        ) {
            throw new AuthError(
                'DISCORD_STATE_MISMATCH',
                'Este regresso do Discord não corresponde a nenhum pedido feito aqui.',
            );
        }
    }

    /**
     * Troca o código pelo utilizador do Discord e resolve a conta.
     */
    async resolveAccount(code: string): Promise<DiscordLoginOutcome> {
        const accessToken = await this.discordClient.exchangeCode(code);
        const discord = await this.discordClient.fetchUser(accessToken);

        const existente = await this.authRepository.findByProviderIdentity(
            AuthProviderType.discord,
            discord.id,
        );

        if (existente) {
            return { userId: existente.user.id, criada: false };
        }

        return this.ligarOuCriar(discord);
    }

    private async ligarOuCriar(
        discord: DiscordUser,
    ): Promise<DiscordLoginOutcome> {
        /**
         * Sem endereço confirmado não se cria conta nem se liga a
         * nenhuma. Criar sem email deixaria uma conta sem forma de
         * recuperação; ligar sem confirmação é o buraco descrito acima.
         */
        if (discord.email === null || !discord.emailVerified) {
            throw new AuthError(
                'DISCORD_EMAIL_UNUSABLE',
                'O Discord não deu um email confirmado, e sem isso não é possível entrar por aqui.',
            );
        }

        const email = normalizeEmail(discord.email);

        const daCasa = await this.authRepository.findByEmail(email);

        if (daCasa) {
            await this.authRepository.linkProvider({
                userId: daCasa.id,
                provider: AuthProviderType.discord,
                providerUserId: discord.id,
                providerEmail: email,
            });

            return { userId: daCasa.id, criada: false };
        }

        const defaultRoleId = await this.authRepository.findDefaultRoleId();

        const utilizador = await this.authRepository.createFederatedUser({
            email,
            username: await this.escolherUsername(discord.username),
            defaultRoleId,
            provider: AuthProviderType.discord,
            providerUserId: discord.id,
            emailVerified: true,
        });

        return { userId: utilizador.id, criada: true };
    }

    /**
     * Um nome livre a partir do nome de Discord.
     *
     * O nosso é único e o do Discord não, por isso o primeiro que se
     * tenta é o dele e os seguintes levam sufixo. O nome também tem de
     * caber nas nossas regras — um nome de Discord pode ter caracteres
     * que aqui não valem —, e por isso é limpo antes de ser tentado.
     */
    private async escolherUsername(doDiscord: string): Promise<string> {
        const base = limparUsername(doDiscord);

        for (let tentativa = 0; tentativa < TENTATIVAS_DE_NOME; tentativa += 1) {
            const candidato =
                tentativa === 0 ? base : `${base}${tentativa + 1}`;

            if (!(await this.authRepository.usernameTaken(candidato))) {
                return candidato;
            }
        }

        /**
         * Cinco nomes ocupados seguidos são pouco provável e possível.
         * O aleatório termina a busca em vez de a arrastar, e quem ficar
         * com um nome destes pode mudá-lo depois.
         */
        return `${base}${randomBytes(3).toString('hex')}`;
    }
}

/**
 * Reduz um nome de Discord ao que as nossas regras aceitam.
 *
 * Exportada para ser testada sozinha: é a parte com mais casos de
 * fronteira e a que menos precisa de base de dados.
 */
export const limparUsername = (doDiscord: string): string => {
    const limpo = doDiscord
        .toLowerCase()
        .replaceAll(/[^a-z0-9_]/g, '')
        .slice(0, 20);

    /**
     * Um nome que fique curto de mais — ou vazio, se era todo feito de
     * caracteres que aqui não valem — leva um prefixo em vez de ser
     * recusado: quem se chama "★" no Discord não tem culpa nenhuma.
     */
    return limpo.length >= 3 ? limpo : `vice${randomBytes(3).toString('hex')}`;
};
