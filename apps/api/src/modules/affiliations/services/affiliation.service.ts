import { MembershipStatus, crewAllowance } from '@vicehub/database';

import type { SubscriptionService } from '../../subscriptions/services/subscription.service.js';
import { AffiliationError } from '../errors/affiliation.errors.js';
import type { AffiliationRepository } from '../repositories/affiliation.repository.js';
import type {
    AffiliationEntry,
    CrewAllowance,
    CrewAffiliation,
} from '../types/affiliation.types.js';

/**
 * Serviço das filiações entre crews e servidores.
 *
 * Uma filiação diz que uma crew joga num servidor, e é a peça que falta
 * para a plataforma poder ser vendida a um servidor em vez de a um
 * jogador. Por isso mesmo não pode ser uma declaração de uma só parte:
 * se bastasse a crew dizer onde joga, pendurar-se no que outro paga
 * seria uma questão de escrever um identificador.
 *
 * Daí a forma: a crew pede, quem manda no servidor responde. As duas
 * pontas consentem, e qualquer das duas pode desfazer.
 */
export class AffiliationService {
    constructor(
        private readonly affiliationRepository: AffiliationRepository,
        private readonly subscriptionService: SubscriptionService,
    ) { }

    /**
     * Quantas crews este servidor pode ter, e quantas já tem.
     *
     * Serve os dois lados da mesma pergunta: o ecrã mostra-a antes de
     * ser preciso, e o `accept` faz-lha no momento em que decide.
     */
    async getCrewAllowance(serverId: string): Promise<CrewAllowance> {
        const [entitlement, used] = await Promise.all([
            this.subscriptionService.getEntitlement({ serverId }),
            this.affiliationRepository.countActiveOfServer(serverId),
        ]);

        const limit = crewAllowance(entitlement.plan);

        return {
            used,
            limit,
            /**
             * Um servidor pode estar **acima** do limite sem que nada
             * esteja errado: o plano acabou, ou desceu de escalão, e as
             * crews que já lá jogavam ficaram. Nunca se tira uma crew de
             * um servidor por causa de um pagamento — isso desfazia uma
             * relação que não é da plataforma. O que acontece é deixar
             * de poder aceitar mais.
             */
            canAcceptMore: limit === null || used < limit,
        };
    }

    /**
     * Onde a crew joga, e o que tem pendente.
     */
    async getCrewAffiliation(crewId: string): Promise<CrewAffiliation> {
        const [ativa, pendente] = await Promise.all([
            this.affiliationRepository.findActiveOfCrew(crewId),
            this.affiliationRepository.findPendingOfCrew(crewId),
        ]);

        return {
            servidor: ativa
                ? { id: ativa.serverId, name: ativa.server.name }
                : null,
            pedido: pendente
                ? { id: pendente.serverId, name: pendente.server.name }
                : null,
        };
    }

    /**
     * A crew pede para jogar num servidor.
     */
    async request(
        crewId: string,
        serverId: string,
        requestedBy: string,
    ): Promise<{ id: string }> {
        if (!(await this.affiliationRepository.crewExists(crewId))) {
            throw new AffiliationError('CREW_NOT_FOUND', 'Crew não encontrada.');
        }

        if (!(await this.affiliationRepository.serverExists(serverId))) {
            throw new AffiliationError(
                'SERVER_NOT_FOUND',
                'Servidor não encontrado.',
            );
        }

        /**
         * Mudar de servidor faz-se em dois passos, e de propósito: sair
         * é uma decisão da crew, e escondê-la dentro de um pedido a
         * outro servidor faria a crew perder o que tinha ao carregar
         * num botão que dizia outra coisa.
         */
        const ativa = await this.affiliationRepository.findActiveOfCrew(crewId);

        if (ativa) {
            throw new AffiliationError(
                'CREW_ALREADY_AFFILIATED',
                'Esta crew já joga num servidor. Para mudar, tem de sair primeiro.',
            );
        }

        const aberta = await this.affiliationRepository.findOpenPair(
            crewId,
            serverId,
        );

        if (aberta) {
            throw new AffiliationError(
                'AFFILIATION_ALREADY_REQUESTED',
                'Já existe um pedido por responder a este servidor.',
            );
        }

        return this.affiliationRepository.request(crewId, serverId, requestedBy);
    }

    /**
     * A crew desiste do pedido que fez.
     */
    async cancelRequest(crewId: string, canceledBy: string): Promise<void> {
        const pendente =
            await this.affiliationRepository.findPendingOfCrew(crewId);

        if (!pendente) {
            throw new AffiliationError(
                'AFFILIATION_NOT_FOUND',
                'Esta crew não tem nenhum pedido por responder.',
            );
        }

        await this.affiliationRepository.setStatus(
            pendente.id,
            MembershipStatus.left,
            canceledBy,
        );
    }

    /**
     * A crew sai do servidor onde joga.
     */
    async leave(crewId: string, leftBy: string): Promise<void> {
        const ativa = await this.affiliationRepository.findActiveOfCrew(crewId);

        if (!ativa) {
            throw new AffiliationError(
                'AFFILIATION_NOT_FOUND',
                'Esta crew não joga em nenhum servidor.',
            );
        }

        await this.affiliationRepository.setStatus(
            ativa.id,
            MembershipStatus.left,
            leftBy,
        );
    }

    /**
     * As crews de um servidor, por estado.
     */
    listOfServer(
        serverId: string,
        status: MembershipStatus,
    ): Promise<AffiliationEntry[]> {
        return this.affiliationRepository.listOfServer(serverId, status);
    }

    /**
     * O servidor aceita a crew que pediu.
     *
     * A crew pode ter entrado noutro servidor entretanto — o pedido fica
     * de pé enquanto ninguém lhe responder. Aceitar aí não pode passar:
     * seria uma crew a jogar em dois sítios, e mais tarde duas origens
     * de plano para a mesma crew. O índice único parcial da tabela diz o
     * mesmo, e é ele que trava dois servidores a aceitarem ao mesmo
     * tempo, coisa que esta verificação sozinha não apanha.
     */
    async accept(
        serverId: string,
        crewId: string,
        respondedBy: string,
    ): Promise<void> {
        const pedido = await this.requirePending(crewId, serverId);

        const ativa = await this.affiliationRepository.findActiveOfCrew(crewId);

        if (ativa) {
            throw new AffiliationError(
                'CREW_ALREADY_AFFILIATED',
                'Esta crew entretanto passou a jogar noutro servidor.',
            );
        }

        /**
         * O limite do plano, verificado no momento de aceitar e não no
         * de a crew se candidatar: candidatar-se continua a ser livre.
         * Um servidor cheio recebe os pedidos na mesma, e é isso que lhe
         * dá razão para subir de escalão — uma fila à porta é um
         * argumento melhor do que um número num ecrã de preços.
         *
         * Contar e escrever não vão numa transação, e é deliberado. Dois
         * pedidos a aceitar no mesmo instante podiam deixar o servidor
         * uma crew acima do limite — mas estar acima do limite já é um
         * estado que o desenho permite, porque nunca se tira uma crew a
         * ninguém. Trancar a linha do servidor para evitar uma corrida
         * cujo resultado é um estado válido não compraria nada.
         */
        const allowance = await this.getCrewAllowance(serverId);

        if (!allowance.canAcceptMore) {
            throw new AffiliationError(
                'SERVER_CREW_LIMIT_REACHED',
                'Este servidor já tem todas as crews que o plano dele permite.',
            );
        }

        const passou = await this.affiliationRepository.activate(
            pedido.id,
            respondedBy,
        );

        /**
         * Quem garante é esta: retirar a verificação acima e correr os
         * testes de integração dá exatamente as mesmas respostas,
         * porque o índice único apanha o mesmo caso — incluindo dois
         * servidores a aceitarem no mesmo instante, que a verificação
         * em memória nunca pode apanhar. A de cima fica por responder
         * sem gastar uma escrita falhada, e não por ser ela a impedir.
         */
        if (!passou) {
            throw new AffiliationError(
                'CREW_ALREADY_AFFILIATED',
                'Esta crew entretanto passou a jogar noutro servidor.',
            );
        }
    }

    async reject(
        serverId: string,
        crewId: string,
        respondedBy: string,
    ): Promise<void> {
        const pedido = await this.requirePending(crewId, serverId);

        await this.affiliationRepository.setStatus(
            pedido.id,
            MembershipStatus.rejected,
            respondedBy,
        );
    }

    /**
     * O servidor põe fora uma crew que lá jogava.
     */
    async remove(
        serverId: string,
        crewId: string,
        removedBy: string,
    ): Promise<void> {
        const ativa = await this.affiliationRepository.findActiveOfCrew(crewId);

        if (!ativa || ativa.serverId !== serverId) {
            throw new AffiliationError(
                'AFFILIATION_NOT_FOUND',
                'Esta crew não joga neste servidor.',
            );
        }

        await this.affiliationRepository.setStatus(
            ativa.id,
            MembershipStatus.left,
            removedBy,
        );
    }

    private async requirePending(crewId: string, serverId: string) {
        const pedido = await this.affiliationRepository.findPendingPair(
            crewId,
            serverId,
        );

        if (!pedido) {
            throw new AffiliationError(
                'AFFILIATION_NOT_PENDING',
                'Não há nenhum pedido por responder desta crew a este servidor.',
            );
        }

        return pedido;
    }
}
