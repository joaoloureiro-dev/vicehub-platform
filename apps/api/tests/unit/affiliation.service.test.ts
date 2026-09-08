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
    let service: AffiliationService;

    beforeEach(() => {
        repository = createRepositoryMock();
        service = new AffiliationService(repository as never);
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
});
