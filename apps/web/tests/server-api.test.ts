import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listServers, setServerMemberRole } from '../src/servers/server.api.js';
import { queryDoDiretorio } from '../src/lib/membership.js';

const responde = (body: unknown = {}): Response =>
    ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response;

describe('cliente dos servidores', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(responde());
        vi.stubGlobal('fetch', fetchMock);
    });

    const endereco = () => String(fetchMock.mock.calls[0]?.[0]);

    describe('o filtro de online', () => {
        /**
         * A API lê `onlineOnly` como texto e trata qualquer valor
         * presente como filtro ativo. Enviar `false` esconderia os
         * servidores offline sem ninguém ter pedido isso.
         */
        it('não envia o filtro quando está desligado', async () => {
            await listServers({ onlineOnly: false });

            expect(endereco()).toBe('/api/v1/servers');
        });

        it('envia o filtro quando está ligado', async () => {
            await listServers({ onlineOnly: true });

            expect(endereco()).toBe('/api/v1/servers?onlineOnly=true');
        });

        it('combina o filtro com a pesquisa', async () => {
            await listServers({ search: 'vice', onlineOnly: true, page: 2 });

            const query = new URL(endereco(), 'http://x').searchParams;

            expect(query.get('search')).toBe('vice');
            expect(query.get('onlineOnly')).toBe('true');
            expect(query.get('page')).toBe('2');
        });
    });

    it('altera o cargo com PUT', async () => {
        await setServerMemberRole('s1', 'u2', 'server_moderator');

        expect(endereco()).toBe('/api/v1/servers/s1/members/u2/role');
        expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('PUT');
    });
});

/**
 * A construção da query é partilhada pelos dois diretórios, e é onde
 * está a regra que mais facilmente se perde de vista.
 */
describe('a query de um diretório', () => {
    it('deixa de fora o que está vazio ou desligado', () => {
        expect(
            queryDoDiretorio({
                search: '',
                page: 1,
                onlineOnly: false,
                sort: undefined,
                regiao: null,
            }),
        ).toBe('');
    });

    it('mantém o que foi mesmo escolhido', () => {
        expect(queryDoDiretorio({ search: 'vice', page: 3 })).toBe(
            '?search=vice&page=3',
        );
    });

    /**
     * A primeira página é o que a API assume, e mandá-la explicitamente
     * só torna os endereços mais compridos sem mudar nada.
     */
    it('não envia a primeira página', () => {
        expect(queryDoDiretorio({ page: 1, sort: 'name' })).toBe('?sort=name');
    });

    it('escapa o que o utilizador escreveu', () => {
        const cauda = queryDoDiretorio({ search: 'a & b' });

        expect(cauda).not.toContain(' ');
        expect(new URL(cauda, 'http://x').searchParams.get('search')).toBe('a & b');
    });
});
