import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createCrew,
    listCrews,
    setMemberRole,
} from '../src/crews/crew.api.js';

const responde = (body: unknown = {}): Response =>
    ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response;

describe('cliente das crews', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(responde());
        vi.stubGlobal('fetch', fetchMock);
    });

    const endereco = () => String(fetchMock.mock.calls[0]?.[0]);
    const opcoes = () => fetchMock.mock.calls[0]?.[1] as RequestInit;

    describe('o diretório', () => {
        /**
         * A API só devolve destaques quando não há pesquisa: uma
         * pesquisa é uma intenção concreta, e responder-lhe com
         * colocação paga tornaria os resultados pouco fiáveis. Enviar
         * `search=` vazio faria a API tratar a pesquisa como existente e
         * os destaques desapareciam sem ninguém ter pesquisado nada.
         */
        it('não envia uma pesquisa vazia', async () => {
            await listCrews({ search: '' });

            expect(endereco()).toBe('/api/v1/crews');
        });

        it('não envia a primeira página', async () => {
            await listCrews({ page: 1 });

            expect(endereco()).toBe('/api/v1/crews');
        });

        it('envia a pesquisa quando ela existe', async () => {
            await listCrews({ search: 'vice' });

            expect(endereco()).toBe('/api/v1/crews?search=vice');
        });

        it('escapa o que o utilizador escreveu', async () => {
            await listCrews({ search: 'vice & kings' });

            expect(endereco()).not.toContain(' ');
            expect(
                new URL(endereco(), 'http://x').searchParams.get('search'),
            ).toBe('vice & kings');
        });

        it('envia a página quando não é a primeira', async () => {
            await listCrews({ page: 3 });

            expect(endereco()).toBe('/api/v1/crews?page=3');
        });
    });

    describe('os métodos que a API espera', () => {
        /**
         * A rota do cargo é PUT, não PATCH. Com o método errado a API
         * responde 404, que é o género de erro que se confunde com "a
         * crew não existe".
         */
        it('altera o cargo com PUT', async () => {
            await setMemberRole('crew-1', 'user-2', 'crew_officer');

            expect(endereco()).toBe('/api/v1/crews/crew-1/members/user-2/role');
            expect(opcoes().method).toBe('PUT');
            expect(JSON.parse(opcoes().body as string)).toEqual({
                role: 'crew_officer',
            });
        });

        it('cria a crew com POST', async () => {
            await createCrew({ name: 'Vice Kings', tag: 'VICE', description: null });

            expect(endereco()).toBe('/api/v1/crews');
            expect(opcoes().method).toBe('POST');
        });
    });
});
