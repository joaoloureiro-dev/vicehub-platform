import type { AuthProviderType } from '@vicehub/database';
import { randomBytes } from 'node:crypto';

import { AuthError } from '../errors/auth.errors.js';
import type {
    FederatedClient,
    FederatedProfile,
} from '../federated/federated.client.js';
import type { AuthRepository } from '../repositories/auth.repository.js';

import { normalizeEmail } from './email.js';

/**
 * Quantas variações de um nome se tentam antes de desistir dele.
 *
 * Nomes de fora repetem-se, e o nosso é único. Ao fim destas o nome
 * passa a levar aleatoriedade em vez de um número — tentar
 * indefinidamente seria uma consulta por cada tentativa.
 */
const TENTATIVAS_DE_NOME = 5;

export interface FederatedLoginOutcome {
    userId: string;
    /** Se a conta foi criada agora, para quem chama poder distinguir. */
    criada: boolean;
}

/**
 * Entrar por outro sítio — Discord, Google, ou o que venha a seguir.
 *
 * O que aqui se decide é uma coisa só: **a que conta pertence esta
 * identidade**. As três respostas possíveis, por ordem:
 *
 * 1. Já esteve cá — há uma identidade ligada, e entra nessa conta.
 * 2. Nunca cá esteve, mas o email já tem conta — liga-se a essa, e só
 *    **se o fornecedor confirmar o endereço**.
 * 3. Nem uma coisa nem outra — cria conta.
 *
 * O `se` do ponto 2 é a regra que não se pode perder de vista: sem ele,
 * registar noutro sítio o email de outra pessoa dava entrada na conta
 * dela aqui. O Discord deixa mudar de email sem confirmar, e há contas
 * de Google de domínio próprio onde o endereço nunca foi confirmado —
 * `verified`/`email_verified` é precisamente a diferença.
 *
 * A decisão é a mesma para todos os fornecedores de propósito: é a
 * parte onde um engano dá a conta de alguém a outra pessoa, e não deve
 * haver duas cópias dela para manter em dia.
 */
export class FederatedAuthService {
    constructor(
        private readonly authRepository: AuthRepository,
        private readonly client: FederatedClient,
        /** Com que valor fica gravada a identidade. */
        private readonly provider: AuthProviderType,
        /** Como o fornecedor se chama nas mensagens de erro. */
        private readonly fornecedor: string,
    ) { }

    /**
     * O segredo que liga a ida ao fornecedor ao regresso.
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
        return this.client.buildAuthorizeUrl(state);
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
                'FEDERATED_STATE_MISMATCH',
                `${this.fornecedor} devolveu um regresso que não corresponde a nenhum pedido feito aqui.`,
            );
        }
    }

    /**
     * Troca o código pelo perfil do fornecedor e resolve a conta.
     */
    async resolveAccount(code: string): Promise<FederatedLoginOutcome> {
        const accessToken = await this.client.exchangeCode(code);
        const perfil = await this.client.fetchUser(accessToken);

        const existente = await this.authRepository.findByProviderIdentity(
            this.provider,
            perfil.id,
        );

        if (existente) {
            return { userId: existente.user.id, criada: false };
        }

        return this.ligarOuCriar(perfil);
    }

    private async ligarOuCriar(
        perfil: FederatedProfile,
    ): Promise<FederatedLoginOutcome> {
        /**
         * Sem endereço confirmado não se cria conta nem se liga a
         * nenhuma. Criar sem email deixaria uma conta sem forma de
         * recuperação; ligar sem confirmação é o buraco descrito acima.
         */
        if (perfil.email === null || !perfil.emailVerified) {
            throw new AuthError(
                'FEDERATED_EMAIL_UNUSABLE',
                `${this.fornecedor} não deu um email confirmado, e sem isso não é possível entrar por aqui.`,
            );
        }

        const email = normalizeEmail(perfil.email);

        const daCasa = await this.authRepository.findByEmail(email);

        if (daCasa) {
            await this.authRepository.linkProvider({
                userId: daCasa.id,
                provider: this.provider,
                providerUserId: perfil.id,
                providerEmail: email,
            });

            return { userId: daCasa.id, criada: false };
        }

        const defaultRoleId = await this.authRepository.findDefaultRoleId();

        const utilizador = await this.authRepository.createFederatedUser({
            email,
            username: await this.escolherUsername(perfil.username),
            defaultRoleId,
            provider: this.provider,
            providerUserId: perfil.id,
            emailVerified: true,
        });

        return { userId: utilizador.id, criada: true };
    }

    /**
     * Um nome livre a partir do nome que veio de fora.
     *
     * O nosso é único e o de lá não, por isso o primeiro que se tenta é
     * o de lá e os seguintes levam sufixo. O nome também tem de caber
     * nas nossas regras — um nome de Discord ou de Google pode ter
     * caracteres que aqui não valem —, e por isso é limpo antes de ser
     * tentado.
     */
    private async escolherUsername(deFora: string): Promise<string> {
        const base = limparUsername(deFora);

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
 * Reduz um nome vindo de fora ao que as nossas regras aceitam.
 *
 * Exportada para ser testada sozinha: é a parte com mais casos de
 * fronteira e a que menos precisa de base de dados.
 */
export const limparUsername = (deFora: string): string => {
    const limpo = deFora
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
