import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error — a varredura é uma ferramenta, não código da aplicação:
// não tem tipos e não entra no `tsconfig`. O que dela se lê aqui são duas
// listas de texto.
import { DE_FORA, ECRAS } from '../scripts/varrer.mjs';

/**
 * A varredura vê o produto todo.
 *
 * Ela existe porque quatro defeitos seguidos passaram por mil e
 * novecentos testes e apareceram no primeiro quarto de hora a olhar
 * para o ecrã. Serve de pouco se um ecrã novo ficar de fora dela — e
 * um ecrã que ninguém volta a olhar é exactamente onde o quinto
 * aparece.
 *
 * Este teste é a ligação: as rotas estão em `app.tsx`, a lista de
 * ecrãs está na ferramenta, e quando as duas deixam de bater certo é
 * aqui que se sabe. Quem acrescenta uma rota acrescenta um ecrã, ou
 * escreve porque é que ele fica de fora.
 */
const APP = readFileSync(
    path.resolve(import.meta.dirname, '../src/app.tsx'),
    'utf8',
);

const rotasDaAplicacao = (): string[] => {
    const encontradas = [...APP.matchAll(/path="([^"]+)"/gu)].map(
        (uma) => uma[1] as string,
    );

    expect(encontradas.length, 'não encontrei rotas nenhumas').toBeGreaterThan(10);

    return [...new Set(encontradas)];
};

/** O endereço que a varredura abre, com os identificadores tirados. */
const semIdentificadores = (endereco: string): string =>
    endereco
        .replace(/\/[0-9a-f]{8}-[0-9a-f-]+/gu, '/:id')
        .replace(/\/[^/]*\d[^/]*/gu, '/:id');

describe('a varredura', () => {
    it('abre todas as rotas da aplicação, ou diz porque não', () => {
        const semente = {
            crewId: '11111111-1111-1111-1111-111111111111',
            serverId: '22222222-2222-2222-2222-222222222222',
            eventoId: '33333333-3333-3333-3333-333333333333',
            anuncioId: '44444444-4444-4444-4444-444444444444',
            conversaId: '55555555-5555-5555-5555-555555555555',
            topicoId: '66666666-6666-6666-6666-666666666666',
            username: 'alguem1',
        };

        const abertas = new Set(
            (ECRAS as { rota: (s: typeof semente) => string }[]).map((ecra) =>
                semIdentificadores(ecra.rota(semente)),
            ),
        );

        const emFalta = rotasDaAplicacao()
            .filter((rota) => !(rota in (DE_FORA as Record<string, string>)))
            .filter((rota) => !abertas.has(rota.replace(/:\w+/gu, ':id')));

        expect(emFalta).toEqual([]);
    });

    /**
     * E ao contrário: um ecrã na lista cuja rota já não existe é uma
     * medição a ser feita a uma página que manda para a entrada.
     */
    it('e não abre endereços que já não são rotas', () => {
        const rotas = new Set(
            rotasDaAplicacao().map((rota) => rota.replace(/:\w+/gu, ':id')),
        );

        const semente = {
            crewId: '11111111-1111-1111-1111-111111111111',
            serverId: '22222222-2222-2222-2222-222222222222',
            eventoId: '33333333-3333-3333-3333-333333333333',
            anuncioId: '44444444-4444-4444-4444-444444444444',
            conversaId: '55555555-5555-5555-5555-555555555555',
            topicoId: '66666666-6666-6666-6666-666666666666',
            username: 'alguem1',
        };

        const perdidos = (ECRAS as { nome: string; rota: (s: typeof semente) => string }[])
            .filter((ecra) => !rotas.has(semIdentificadores(ecra.rota(semente))))
            .map((ecra) => ecra.nome);

        expect(perdidos).toEqual([]);
    });

    /** Cada exclusão tem de dizer porquê: uma lista de rotas sem razão é um esquecimento. */
    it('e cada exclusão diz porquê', () => {
        for (const [rota, razao] of Object.entries(
            DE_FORA as Record<string, string>,
        )) {
            expect(razao.length, `${rota} não diz porque fica de fora`).toBeGreaterThan(10);
        }
    });
});
