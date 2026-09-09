import { IngestError } from '../errors/ingest.errors.js';
import type { IngestRepository } from '../repositories/ingest.repository.js';
import type { ApiKeyService } from './api-key.service.js';

/**
 * Quantas chaves ativas um servidor pode ter ao mesmo tempo.
 *
 * Mais do que uma é preciso — trocar de chave sem parar o servidor
 * exige ter as duas de pé por um bocado. Uma dúzia é folga que chegue
 * para isso e pouca para quem quisesse criá-las em massa.
 */
const MAXIMO_DE_CHAVES = 12;

export interface ChaveCriada {
    id: string;
    label: string;
    prefix: string;
    createdAt: Date;
    /**
     * A chave inteira, entregue **uma única vez**.
     *
     * Não volta a existir em lado nenhum: o que fica gravado é o resumo.
     * Quem a perder gera outra.
     */
    key: string;
}

/**
 * A ingestão: o que os servidores de FiveM mandam para cá.
 *
 * Uma chave identifica **um servidor**, e nunca uma pessoa. É a
 * distinção que mantém isto seguro: o que um script consegue fazer com
 * uma chave roubada é reportar mentiras sobre o servidor dele, e não
 * mexer em contas, tesourarias ou planos.
 */
export class IngestService {
    constructor(
        private readonly ingestRepository: IngestRepository,
        private readonly apiKeyService: ApiKeyService,
    ) { }

    /**
     * A que servidor pertence esta chave, se pertencer a algum.
     *
     * Devolve null para tudo o que não sirva — inexistente, revogada,
     * mal formada, segredo errado. Quem chama responde 401 sem
     * distinguir os casos: dizer *porquê* a uma chave errada é dizer a
     * quem tenta o que lhe falta acertar.
     */
    async resolveServer(
        apresentada: string,
    ): Promise<{ serverId: string; apiKeyId: string } | null> {
        const partes = this.apiKeyService.parse(apresentada);

        if (!partes) {
            return null;
        }

        const chave = await this.ingestRepository.findUsableByPrefix(
            partes.prefix,
        );

        if (!chave) {
            return null;
        }

        if (
            !this.apiKeyService.matches(
                chave.key_hash,
                this.apiKeyService.hash(partes.segredo),
            )
        ) {
            return null;
        }

        await this.ingestRepository.markUsed(chave.id);

        return { serverId: chave.serverId, apiKeyId: chave.id };
    }

    /**
     * Cria uma chave e devolve-a inteira, pela única vez.
     */
    async createKey(
        serverId: string,
        label: string,
        createdBy: string,
    ): Promise<ChaveCriada> {
        if (!(await this.ingestRepository.findServerName(serverId))) {
            throw new IngestError('SERVER_NOT_FOUND', 'Servidor não encontrado.');
        }

        const ativas = await this.ingestRepository.countActiveKeys(serverId);

        if (ativas >= MAXIMO_DE_CHAVES) {
            throw new IngestError(
                'TOO_MANY_API_KEYS',
                `Um servidor não pode ter mais de ${MAXIMO_DE_CHAVES} chaves ativas. Revoga alguma antes de criar outra.`,
            );
        }

        const gerada = this.apiKeyService.generate();

        const linha = await this.ingestRepository.createKey({
            serverId,
            label,
            prefix: gerada.prefix,
            keyHash: gerada.hash,
            createdBy,
        });

        return {
            id: linha.id,
            label: linha.label,
            prefix: linha.prefix,
            createdAt: linha.created_at,
            key: gerada.completa,
        };
    }

    listKeys(serverId: string) {
        return this.ingestRepository.listKeys(serverId);
    }

    /**
     * Revoga uma chave deste servidor.
     *
     * O `serverId` faz parte da procura de propósito: sem ele, quem
     * gerisse um servidor qualquer podia revogar a chave de outro
     * bastando conhecer-lhe o identificador.
     */
    async revokeKey(
        serverId: string,
        apiKeyId: string,
        revokedBy: string,
    ): Promise<void> {
        const chave = await this.ingestRepository.findKeyOfServer(
            apiKeyId,
            serverId,
        );

        if (!chave) {
            throw new IngestError(
                'API_KEY_NOT_FOUND',
                'Este servidor não tem nenhuma chave com este identificador.',
            );
        }

        /**
         * Revogar o que já está revogado não é um erro: o resultado
         * pedido já é o que está. Recusar obrigaria quem automatiza a
         * distinguir dois casos que para si são o mesmo.
         */
        if (chave.revoked_at !== null) {
            return;
        }

        await this.ingestRepository.revokeKey(apiKeyId, revokedBy);
    }

    /**
     * O servidor reporta que está de pé, e com quantas pessoas.
     */
    async heartbeat(serverId: string, playersOnline: number): Promise<void> {
        await this.ingestRepository.recordHeartbeat(serverId, playersOnline);
    }

    async describeServer(serverId: string) {
        const servidor = await this.ingestRepository.findServerName(serverId);

        if (!servidor) {
            throw new IngestError('SERVER_NOT_FOUND', 'Servidor não encontrado.');
        }

        return servidor;
    }
}
