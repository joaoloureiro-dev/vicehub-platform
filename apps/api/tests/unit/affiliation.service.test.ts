import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MembershipStatus } from '@vicehub/database';

import { AffiliationError } from '../../src/modules/affiliations/errors/affiliation.errors.js';
import { AffiliationService } from '../../src/modules/affiliations/services/affiliation.service.js';

/**
 * O duplo declara tudo o que o serviço usa. Acrescentar um método ao
 * repositório sem o declarar aqui deixa de compilar, em vez de passar
 * despercebido.
 */
const createRepositoryMock = () => ({
    findActiveOfCrew: vi.fn().mockResolvedValue(null),
    findPendingOfCrew: vi.fn().mockResolvedValue(null),
    findOpenPair: vi.fn().mockResolvedValue(null),
    findPendingPair: vi.fn().mockResolvedValue({ id: 'af-1' }),
    request: vi.fn().mockResolvedValue({ id: 'af-1' }),
    setStatus: vi.fn().mockResolvedValue({ id: 'af-1' }),
    activate: vi.fn().mockResolvedValue(true),
    listOfServer: vi.fn().mockResolvedValue([]),
    crewExists: vi.fn().mockResolvedValue({ id: 'crew-1' }),
    serverExists: vi.fn().mockResolvedValue({ id: 'server-1', name: 'Vice' }),
    countActiveOfServer: vi.fn().mockResolvedValue(0),
});

/**
 * O plano do servidor, que é o que decide quantas crews ele pode ter.
 * Sem plano, por omissão: é o caso de quase toda a gente.
 */
const createSubscriptionMock = () => ({
    getEntitlement: vi.fn().mockResolvedValue({
        owner: { serverId: 'server-1' },
        isPremium: false,
        isLifetime: false,
        plan: null,
        activeUntil: null,
        via: null,
    }),
});

const expectAffiliationError = async (
    promise: Promise<unknown>,
    code: string,
): Promise<void> => {
    await expect(promise).rejects.toBeInstanceOf(AffiliationError);
    await expect(promise).rejects.toMatchObject({ code });
};

describe('AffiliationService', () => {
    let repository: ReturnType<typeof createRepositoryMock>;
    let subscriptions: ReturnType<typeof createSubscriptionMock>;
    let service: AffiliationService;

    beforeEach(() => {
        repository = createRepositoryMock();
        subscriptions = createSubscriptionMock();
        service = new AffiliationService(
            repository as never,
            subscriptions as never,
        );
    });

    describe('pedir', () => {
        it('grava o pedido com quem o fez', async () => {
            await service.request('crew-1', 'server-1', 'user-1');

            expect(repository.request).toHaveBeenCalledWith(
                'crew-1',
                'server-1',
                'user-1',
            );
        });

        it('recusa quando a crew não existe', async () => {
            repository.crewExists.mockResolvedValue(null);

            await expectAffiliationError(
                service.request('crew-1', 'server-1', 'user-1'),
                'CREW_NOT_FOUND',
            );
        });

        it('recusa quando o servidor não existe', async () => {
            repository.serverExists.mockResolvedValue(null);

            await expectAffiliationError(
                service.request('crew-1', 'server-1', 'user-1'),
                'SERVER_NOT_FOUND',
            );

            expect(repository.request).not.toHaveBeenCalled();
        });

        /**
         * Mudar de servidor são dois passos de propósito: sair é uma
         * decisão da crew, e escondê-la dentro de um pedido a outro
         * servidor faria a crew perder o que tinha ao carregar num botão
         * que dizia outra coisa.
         */
        it('recusa enquanto a crew já joga algures', async () => {
            repository.findActiveOfCrew.mockResolvedValue({
                id: 'af-0',
                serverId: 'server-9',
                server: { name: 'Outro' },
            });

            await expectAffiliationError(
                service.request('crew-1', 'server-1', 'user-1'),
                'CREW_ALREADY_AFFILIATED',
            );

            expect(repository.request).not.toHaveBeenCalled();
        });

        it('recusa um segundo pedido ao mesmo servidor', async () => {
            repository.findOpenPair.mockResolvedValue({
                id: 'af-0',
                status: MembershipStatus.pending,
            });

            await expectAffiliationError(
                service.request('crew-1', 'server-1', 'user-1'),
                'AFFILIATION_ALREADY_REQUESTED',
            );
        });
    });

    describe('aceitar', () => {
        it('passa o pedido a ativo', async () => {
            await service.accept('server-1', 'crew-1', 'dono');

            expect(repository.activate).toHaveBeenCalledWith('af-1', 'dono');
        });

        it('recusa quando não há pedido por responder', async () => {
            repository.findPendingPair.mockResolvedValue(null);

            await expectAffiliationError(
                service.accept('server-1', 'crew-1', 'dono'),
                'AFFILIATION_NOT_PENDING',
            );

            expect(repository.activate).not.toHaveBeenCalled();
        });

        /**
         * O pedido fica de pé enquanto ninguém lhe responder, e a crew
         * pode ter entrado noutro servidor pelo meio.
         */
        it('recusa quando a crew entretanto passou a jogar noutro sítio', async () => {
            repository.findActiveOfCrew.mockResolvedValue({
                id: 'af-0',
                serverId: 'server-9',
                server: { name: 'Outro' },
            });

            await expectAffiliationError(
                service.accept('server-1', 'crew-1', 'dono'),
                'CREW_ALREADY_AFFILIATED',
            );

            expect(repository.activate).not.toHaveBeenCalled();
        });

        /**
         * A recusa da base de dados é uma recusa, e não uma avaria: dois
         * servidores a aceitarem no mesmo instante passam os dois pela
         * verificação acima, e quem decide é o índice único.
         */
        it('transforma a recusa do índice único numa recusa do domínio', async () => {
            repository.activate.mockResolvedValue(false);

            await expectAffiliationError(
                service.accept('server-1', 'crew-1', 'dono'),
                'CREW_ALREADY_AFFILIATED',
            );
        });
    });

    describe('recusar e desfazer', () => {
        it('marca o pedido como recusado', async () => {
            await service.reject('server-1', 'crew-1', 'dono');

            expect(repository.setStatus).toHaveBeenCalledWith(
                'af-1',
                MembershipStatus.rejected,
                'dono',
            );
        });

        it('a saída da crew marca a filiação como terminada', async () => {
            repository.findActiveOfCrew.mockResolvedValue({
                id: 'af-2',
                serverId: 'server-1',
                server: { name: 'Vice' },
            });

            await service.leave('crew-1', 'lider');

            expect(repository.setStatus).toHaveBeenCalledWith(
                'af-2',
                MembershipStatus.left,
                'lider',
            );
        });

        it('recusa a saída de quem não joga em lado nenhum', async () => {
            await expectAffiliationError(
                service.leave('crew-1', 'lider'),
                'AFFILIATION_NOT_FOUND',
            );
        });

        /**
         * Um servidor só põe fora as crews que jogam nele. Sem esta
         * verificação, quem gerisse um servidor qualquer podia expulsar
         * uma crew de outro.
         */
        it('um servidor não põe fora uma crew que joga noutro', async () => {
            repository.findActiveOfCrew.mockResolvedValue({
                id: 'af-3',
                serverId: 'server-9',
                server: { name: 'Outro' },
            });

            await expectAffiliationError(
                service.remove('server-1', 'crew-1', 'dono'),
                'AFFILIATION_NOT_FOUND',
            );

            expect(repository.setStatus).not.toHaveBeenCalled();
        });

        it('a desistência do pedido não mexe numa filiação ativa', async () => {
            await expectAffiliationError(
                service.cancelRequest('crew-1', 'lider'),
                'AFFILIATION_NOT_FOUND',
            );
        });
    });

    describe('o estado da crew', () => {
        it('separa o servidor onde joga do pedido por responder', async () => {
            repository.findActiveOfCrew.mockResolvedValue(null);
            repository.findPendingOfCrew.mockResolvedValue({
                id: 'af-4',
                serverId: 'server-1',
                server: { name: 'Vice' },
            });

            expect(await service.getCrewAffiliation('crew-1')).toEqual({
                servidor: null,
                pedido: { id: 'server-1', name: 'Vice' },
            });
        });
    });

    /**
     * O limite de crews do plano do servidor.
     *
     * A regra é curta e as suas pontas soltas é que são interessantes:
     * quem não paga tem um número pequeno, o escalão de topo não tem
     * número nenhum, e um servidor que caiu abaixo do que já tem
     * **guarda o que tem** e apenas deixa de poder aceitar mais.
     */
    describe('o limite de crews do plano', () => {
        const comPlano = (plan: string | null) => {
            subscriptions.getEntitlement.mockResolvedValue({
                owner: { serverId: 'server-1' },
                isPremium: plan !== null,
                isLifetime: plan === 'lifetime',
                plan,
                activeUntil: null,
                via: null,
            });
        };

        it('deixa aceitar quem ainda tem lugar', async () => {
            comPlano('server_base');
            repository.countActiveOfServer.mockResolvedValue(9);

            await service.accept('server-1', 'crew-1', 'user-1');

            expect(repository.activate).toHaveBeenCalled();
        });

        /**
         * O 402 é a resposta certa: quem pede tem autorização, o que
         * falta é o plano dar para mais uma.
         */
        it('recusa a que passa do limite, e não grava nada', async () => {
            comPlano('server_base');
            repository.countActiveOfServer.mockResolvedValue(10);

            await expectAffiliationError(
                service.accept('server-1', 'crew-1', 'user-1'),
                'SERVER_CREW_LIMIT_REACHED',
            );

            expect(repository.activate).not.toHaveBeenCalled();
        });

        it('um servidor sem plano nenhum também tem lugar para algumas', async () => {
            comPlano(null);
            repository.countActiveOfServer.mockResolvedValue(2);

            await service.accept('server-1', 'crew-1', 'user-1');

            expect(repository.activate).toHaveBeenCalled();
        });

        it('e para na terceira', async () => {
            comPlano(null);
            repository.countActiveOfServer.mockResolvedValue(3);

            await expectAffiliationError(
                service.accept('server-1', 'crew-1', 'user-1'),
                'SERVER_CREW_LIMIT_REACHED',
            );
        });

        it('o escalão sem limite não tem limite nenhum', async () => {
            comPlano('server_unlimited');
            repository.countActiveOfServer.mockResolvedValue(4_000);

            await service.accept('server-1', 'crew-1', 'user-1');

            expect(repository.activate).toHaveBeenCalled();
        });

        /**
         * O vitalício foi um gesto a quem apoiou a plataforma no
         * princípio. Limitá-lo a três crews era retirar com uma mão o
         * que se deu com a outra.
         */
        it('o vitalício não leva com o limite de quem não paga', async () => {
            comPlano('lifetime');
            repository.countActiveOfServer.mockResolvedValue(80);

            await service.accept('server-1', 'crew-1', 'user-1');

            expect(repository.activate).toHaveBeenCalled();
        });

        /**
         * Só as ativas ocupam lugar. Se os pedidos por responder
         * contassem, bastava a alguém candidatar-se para o servidor
         * deixar de poder aceitar seja quem for — a caixa de entrada
         * enchia o próprio limite.
         */
        it('pergunta ao repositório apenas pelas crews ativas', async () => {
            comPlano('server_base');

            await service.accept('server-1', 'crew-1', 'user-1');

            expect(repository.countActiveOfServer).toHaveBeenCalledWith(
                'server-1',
            );
        });
    });

    /**
     * O mesmo número, antes de ser preciso: é o que o ecrã mostra a quem
     * gere o servidor, para que ninguém carregue em aceitar e leve com
     * uma recusa que podia ter lido.
     */
    describe('a folga do plano, para o ecrã', () => {
        it('diz quantas tem e quantas pode ter', async () => {
            subscriptions.getEntitlement.mockResolvedValue({
                owner: { serverId: 'server-1' },
                isPremium: true,
                isLifetime: false,
                plan: 'server_base',
                activeUntil: null,
                via: null,
            });
            repository.countActiveOfServer.mockResolvedValue(7);

            await expect(
                service.getCrewAllowance('server-1'),
            ).resolves.toEqual({ used: 7, limit: 10, canAcceptMore: true });
        });

        /**
         * Um servidor pode estar acima do limite sem que nada esteja
         * errado: o plano acabou, ou desceu de escalão, e as crews que
         * já lá jogavam ficaram. Nunca se tira uma crew a ninguém por
         * causa de um pagamento.
         */
        it('um servidor acima do limite continua a dizer a verdade', async () => {
            subscriptions.getEntitlement.mockResolvedValue({
                owner: { serverId: 'server-1' },
                isPremium: false,
                isLifetime: false,
                plan: null,
                activeUntil: null,
                via: null,
            });
            repository.countActiveOfServer.mockResolvedValue(12);

            await expect(
                service.getCrewAllowance('server-1'),
            ).resolves.toEqual({ used: 12, limit: 3, canAcceptMore: false });
        });

        it('sem limite, pode sempre aceitar mais', async () => {
            subscriptions.getEntitlement.mockResolvedValue({
                owner: { serverId: 'server-1' },
                isPremium: true,
                isLifetime: false,
                plan: 'server_unlimited',
                activeUntil: null,
                via: null,
            });
            repository.countActiveOfServer.mockResolvedValue(900);

            await expect(
                service.getCrewAllowance('server-1'),
            ).resolves.toEqual({ used: 900, limit: null, canAcceptMore: true });
        });
    });
});