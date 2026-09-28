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
    /*
      Os dois nomes vêm com o pedido, como na consulta a sério: é deles
      que o rasto de auditoria precisa para dizer que crew e que
      servidor.
    */
    findPendingPair: vi.fn().mockResolvedValue({
        id: 'af-1',
        crew: { name: 'Vice Kings' },
        server: { name: 'Vice City RP' },
    }),
    request: vi.fn().mockResolvedValue({ id: 'af-1' }),
    setStatus: vi.fn().mockResolvedValue({ id: 'af-1' }),
    activate: vi.fn().mockResolvedValue(true),
    listOfServer: vi.fn().mockResolvedValue([]),
    crewExists: vi.fn().mockResolvedValue({ id: 'crew-1' }),
    serverExists: vi.fn().mockResolvedValue({ id: 'server-1', name: 'Vice' }),
    countActiveOfServer: vi.fn().mockResolvedValue(0),
    countAheadOnServer: vi.fn().mockResolvedValue(0),
    listLeaderboardOfServer: vi.fn().mockResolvedValue({ linhas: [], total: 0 }),
});

/** Uma linha do quadro, como a consulta a devolve. */
const linha = (crewId: string, xp: bigint) => ({
    crewId,
    crew: { name: `Crew ${crewId}`, tag: crewId.slice(0, 4).toUpperCase(), xp },
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

    /**
     * **O lugar no quadro é o que este serviço existe para calcular.**
     *
     * A consulta traz as linhas por ordem; o lugar não é o índice
     * delas. Duas crews com o mesmo xp partilham-no — desempatá-las
     * por uma coisa que ninguém ganhou, como a data em que se
     * filiaram, seria inventar uma diferença — e a que vem a seguir
     * cai para o lugar que a sua posição na ordem lhe dá.
     */
    describe('o quadro de um servidor', () => {
        it('conta o lugar como quantas estão à frente, mais uma', async () => {
            repository.listLeaderboardOfServer.mockResolvedValue({
                linhas: [linha('a', 900n), linha('b', 400n), linha('c', 100n)],
                total: 3,
            });

            const quadro = await service.getLeaderboard('server-1', 1);

            expect(quadro.entries.map((e) => e.position)).toEqual([1, 2, 3]);
        });

        it('e duas empatadas partilham-no', async () => {
            repository.listLeaderboardOfServer.mockResolvedValue({
                linhas: [linha('a', 900n), linha('b', 900n), linha('c', 100n)],
                total: 3,
            });

            const quadro = await service.getLeaderboard('server-1', 1);

            expect(quadro.entries.map((e) => e.position)).toEqual([1, 1, 3]);
        });

        /**
         * Três empatadas em primeiro deixam a quarta em quarto, e não
         * em segundo. É assim que se lê uma classificação em qualquer
         * sítio onde se leia uma.
         */
        it('e o empate consome os lugares que ocupa', async () => {
            repository.listLeaderboardOfServer.mockResolvedValue({
                linhas: [
                    linha('a', 900n),
                    linha('b', 900n),
                    linha('c', 900n),
                    linha('d', 100n),
                ],
                total: 4,
            });

            const quadro = await service.getLeaderboard('server-1', 1);

            expect(quadro.entries.map((e) => e.position)).toEqual([1, 1, 1, 4]);
        });

        /**
         * **Uma página que começa a meio de um empate.**
         *
         * É o caso que o salto da paginação sozinho não sabe resolver:
         * a segunda metade do empate está na página seguinte, e
         * `skip + 1` dar-lhe-ia um lugar diferente do da primeira
         * metade — o mesmo xp com dois lugares diferentes, por causa de
         * onde calhou a quebra de página.
         *
         * Por isso o lugar da primeira linha da página vem de uma
         * contagem de quantas estão à frente dela.
         */
        it('não parte um empate ao mudar de página', async () => {
            repository.listLeaderboardOfServer.mockResolvedValue({
                linhas: [linha('z', 900n), linha('w', 100n)],
                total: 27,
            });
            /*
             * Vinte e quatro à frente das 900, por isso as 900 ocupam o
             * lugar 25. A página 2 começa na 26ª crew — a **segunda**
             * das 900 —, e essa fica em 25 como a primeira, que está na
             * página anterior. O salto sozinho dar-lhe-ia 26.
             *
             * A que vem a seguir cai para 27, e não para 26: o empate
             * de duas consome os lugares 25 e 26.
             */
            repository.countAheadOnServer.mockResolvedValue(24);

            const quadro = await service.getLeaderboard('server-1', 2);

            expect(repository.countAheadOnServer).toHaveBeenCalledWith(
                'server-1',
                900n,
            );
            expect(quadro.entries.map((e) => e.position)).toEqual([25, 27]);
        });

        it('pede a página que lhe pedirem', async () => {
            await service.getLeaderboard('server-1', 3);

            expect(repository.listLeaderboardOfServer).toHaveBeenCalledWith({
                serverId: 'server-1',
                skip: 50,
                take: 25,
            });
        });

        /** Sem ninguém a quem contar, não se conta. */
        it('não pergunta quem está à frente de uma página vazia', async () => {
            const quadro = await service.getLeaderboard('server-1', 9);

            expect(repository.countAheadOnServer).not.toHaveBeenCalled();
            expect(quadro.entries).toEqual([]);
            expect(quadro.pages).toBe(1);
        });

        it('diz o nível de cada crew, a partir do xp', async () => {
            repository.listLeaderboardOfServer.mockResolvedValue({
                /* 300 é a entrada do nível 3; 250 ainda é nível 2. */
                linhas: [linha('a', 300n), linha('b', 250n), linha('c', 0n)],
                total: 3,
            });

            const quadro = await service.getLeaderboard('server-1', 1);

            expect(quadro.entries.map((e) => e.level)).toEqual([3, 2, 1]);
        });

        /**
         * O total é o das crews que lá jogam, e não o das que já
         * pontuaram: um quadro é a lista de quem está, com as que ainda
         * não ganharam nada no fim.
         */
        it('conta as páginas pelo total', async () => {
            repository.listLeaderboardOfServer.mockResolvedValue({
                linhas: [linha('a', 10n)],
                total: 51,
            });

            const quadro = await service.getLeaderboard('server-1', 1);

            expect(quadro.total).toBe(51);
            expect(quadro.pages).toBe(3);
        });
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
                crew: { name: 'Vice Kings' },
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
                crew: { name: 'Vice Kings' },
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
                crew: { name: 'Vice Kings' },
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
                crew: { name: 'Vice Kings' },
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