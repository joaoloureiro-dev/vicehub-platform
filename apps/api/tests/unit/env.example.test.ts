import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { NOMES_DAS_VARIAVEIS } from '../../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const exemplo = readFileSync(
    path.resolve(__dirname, '../../../../.env.example'),
    'utf8',
);

/**
 * Os nomes de variáveis mencionados no exemplo.
 *
 * Conta tanto as linhas ativas (`NOME=valor`) como as comentadas
 * (`# NOME=valor`): uma variável opcional está no exemplo comentada de
 * propósito, para quem lê saber que existe sem a ligar sem querer.
 */
const mencionadas = new Set(
    [...exemplo.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map(
        (correspondencia) => correspondencia[1] as string,
    ),
);

/**
 * O `.env.example` é a única lista do que a plataforma precisa para
 * arrancar, e é a primeira coisa que se lê antes de um deploy.
 *
 * Um exemplo incompleto é pior do que nenhum: quem o segue até ao fim
 * fica convencido de que configurou tudo, e descobre o que faltava
 * quando a API recusa arrancar — ou pior, quando arranca e há uma
 * funcionalidade calada.
 *
 * Por isso não se confia nele: confronta-se com o esquema.
 */
describe('o .env.example', () => {
    it('menciona todas as variáveis que a API lê', () => {
        const emFalta = NOMES_DAS_VARIAVEIS.filter(
            (nome) => !mencionadas.has(nome),
        );

        expect(emFalta).toEqual([]);
    });

    /**
     * E o contrário, que envelhece igual: uma variável apagada do código
     * fica no exemplo a pedir configuração que já não serve para nada, e
     * quem a preencher fica à espera de um efeito que não vem.
     */
    it('não inventa variáveis que a API não lê', () => {
        const conhecidas = new Set(NOMES_DAS_VARIAVEIS);

        const aMais = [...mencionadas].filter((nome) => !conhecidas.has(nome));

        expect(aMais).toEqual([]);
    });

    /**
     * As quatro que a API exige sempre têm de estar por preencher e não
     * comentadas: quem copia o exemplo para `.env` tem de ver logo o que
     * lhe falta, sem ter de descomentar linhas à procura.
     */
    it('deixa as obrigatórias à vista, não comentadas', () => {
        for (const nome of [
            'DATABASE_URL',
            'JWT_ACCESS_SECRET',
            'JWT_REFRESH_SECRET',
            'CORS_ALLOWED_ORIGINS',
        ]) {
            expect(exemplo).toMatch(new RegExp(`^${nome}=`, 'm'));
        }
    });

    /**
     * Nenhum segredo verdadeiro. O ficheiro vai para o repositório, que
     * é público.
     */
    it('não traz chaves verdadeiras lá dentro', () => {
        expect(exemplo).not.toMatch(/sk_live_[A-Za-z0-9]/);
        expect(exemplo).not.toMatch(/whsec_[A-Za-z0-9]/);
    });
});
