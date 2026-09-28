import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    FORA_DO_MAPA,
    FORA_DO_RASTREIO,
    ROTAS_PUBLICAS,
    mapaDoSitio,
    robots,
} from '../src/lib/sitio-publico.js';

/**
 * O que sai para fora bate certo com o que existe cá dentro.
 *
 * O cartão de um link, o mapa do sítio e o `robots.txt` são lidos por
 * quem nunca abriu a aplicação — motores de busca, o X, o Discord — e
 * por isso ninguém dá por eles quando ficam errados. Um mapa que promete
 * uma página que já não existe dá 404 num resultado de pesquisa meses
 * depois; uma página nova que fica de fora nunca aparece em lado nenhum.
 *
 * Este teste liga as três coisas ao router, que é onde as páginas
 * existem de verdade.
 */
const RAIZ = join(import.meta.dirname, '..');

const APP = readFileSync(join(RAIZ, 'src/app.tsx'), 'utf8');
const HTML = readFileSync(join(RAIZ, 'index.html'), 'utf8');

/**
 * As rotas do router, partidas em duas pelo `RequireAuth`.
 *
 * Tudo o que está escrito antes do guardião é público; o que vem
 * depois exige sessão, ou traz um identificador no caminho. É uma
 * leitura pela ordem do ficheiro e não pela árvore de componentes — o
 * que a torna simples de ler e ruidosa de contornar, que é a troca
 * certa aqui.
 */
const guardiao = APP.indexOf('<RequireAuth />');

const caminhosEm = (texto: string): string[] =>
    [...texto.matchAll(/path="([^"]+)"/gu)]
        .map((achado) => achado[1] as string)
        .filter((caminho) => !caminho.includes(':') && caminho !== '*');

const publicas = caminhosEm(APP.slice(0, guardiao));
const privadas = caminhosEm(APP.slice(guardiao));

describe('o sítio público', () => {
    it('o router tem um RequireAuth para dividir as duas metades', () => {
        expect(guardiao).toBeGreaterThan(0);
    });

    /**
     * Uma página pública nova está no mapa, ou está escrito porque
     * não está. As duas hipóteses são decisões; o que não pode haver é
     * uma terceira, que é ninguém ter reparado.
     */
    it('cada página pública está no mapa ou tem razão escrita para não estar', () => {
        const esquecidas = publicas.filter(
            (rota) =>
                !(ROTAS_PUBLICAS as readonly string[]).includes(rota)
                && FORA_DO_MAPA[rota] === undefined,
        );

        expect(esquecidas).toEqual([]);
    });

    it('e as razões são razões, não uma lista vazia', () => {
        const semRazao = Object.entries(FORA_DO_MAPA).filter(
            ([, razao]) => razao.trim().length < 20,
        );

        expect(semRazao.map(([rota]) => rota)).toEqual([]);
    });

    /**
     * E ao contrário: o mapa não promete o que o router não tem.
     */
    it('e o mapa não nomeia uma página que não existe', () => {
        const inventadas = ROTAS_PUBLICAS.filter(
            (rota) => !publicas.includes(rota),
        );

        expect(inventadas).toEqual([]);
    });

    /**
     * **E nunca uma página de conta.** É o erro que custa mais caro
     * dos três: pôr no mapa uma página que exige sessão manda um
     * motor de busca — e quem clicar no resultado — para um ecrã que
     * não é dele.
     */
    it('e nunca uma página que exija sessão', () => {
        const privadasNoMapa = privadas.filter((rota) =>
            (ROTAS_PUBLICAS as readonly string[]).includes(rota));

        expect(privadasNoMapa).toEqual([]);
    });

    it('e essas ficam fora do rastreio', () => {
        const porTapar = privadas.filter(
            (rota) =>
                !FORA_DO_RASTREIO.some((prefixo) => rota.startsWith(prefixo)),
        );

        expect(porTapar).toEqual([]);
    });

    /**
     * E o que se recusa a rastrear não engole uma página pública pelo
     * caminho: `Disallow: /mercado` tapava o mercado inteiro em vez da
     * caixa de conversas.
     */
    it('e nenhum desses prefixos tapa uma página pública', () => {
        const demais = ROTAS_PUBLICAS.filter((rota) =>
            FORA_DO_RASTREIO.some((prefixo) => rota.startsWith(prefixo)));

        expect(demais).toEqual([]);
    });
});

describe('os ficheiros que se geram', () => {
    it('o mapa nomeia todas as rotas públicas, com o domínio à frente', () => {
        const mapa = mapaDoSitio('https://exemplo.test');

        for (const rota of ROTAS_PUBLICAS) {
            expect(mapa).toContain(
                `<loc>https://exemplo.test${rota === '/' ? '/' : rota}</loc>`,
            );
        }
    });

    it('e o robots aponta para o mapa no mesmo domínio', () => {
        expect(robots('https://exemplo.test')).toContain(
            'Sitemap: https://exemplo.test/sitemap.xml',
        );
    });

    /**
     * Um domínio escrito com barra no fim dava `exemplo.test//crews`,
     * que é um endereço diferente do da página.
     */
    it('e uma barra a mais no domínio não passa para os endereços', () => {
        expect(mapaDoSitio('https://exemplo.test/')).toContain(
            '<loc>https://exemplo.test/crews</loc>',
        );
    });
});

describe('o cartão de um link partilhado', () => {
    const conteudoDe = (etiqueta: string): string | undefined =>
        new RegExp(
            `<meta (?:name|property)="${etiqueta}" content="([^"]*)">`,
            'u',
        ).exec(HTML)?.[1];

    it('diz o que é preciso para aparecer com imagem', () => {
        expect(conteudoDe('og:title')).toBeTruthy();
        expect(conteudoDe('og:image')).toBeTruthy();
        expect(conteudoDe('twitter:card')).toBe('summary_large_image');
    });

    /**
     * **Uma descrição, escrita uma vez.** São três etiquetas lidas por
     * três programas diferentes, e três textos ligeiramente diferentes
     * é a maneira mais certa de dois deles envelhecerem.
     */
    it('e a descrição é a mesma nas três etiquetas', () => {
        const descricao = conteudoDe('description');

        expect(descricao).toBeTruthy();
        expect(conteudoDe('og:description')).toBe(descricao);
        expect(conteudoDe('twitter:description')).toBe(descricao);
    });

    /**
     * Os endereços têm de ser absolutos, e quem os torna absolutos é a
     * compilação. Um `%ENDERECO%` que sobrasse aqui chegava ao cartão
     * como texto.
     */
    it('e os endereços do cartão são substituídos ao compilar', () => {
        expect(conteudoDe('og:image')).toMatch(/^%ENDERECO%\//u);
        expect(conteudoDe('og:url')).toMatch(/^%ENDERECO%\//u);
    });

    it('e a imagem do cartão existe', () => {
        const imagem = (conteudoDe('og:image') ?? '').replace('%ENDERECO%/', '');

        expect(() =>
            readFileSync(join(RAIZ, 'public', imagem))).not.toThrow();
    });

    /**
     * E tem as medidas que diz ter. Um cartão declarado 1200×630 e
     * entregue noutra medida é recortado por quem o mostra, e o
     * recorte cai sempre no título.
     */
    it('e tem mesmo as medidas que declara', () => {
        const imagem = (conteudoDe('og:image') ?? '').replace('%ENDERECO%/', '');
        const bytes = readFileSync(join(RAIZ, 'public', imagem));

        /* O IHDR de um PNG: largura e altura, oito bytes a partir do 16. */
        const largura = bytes.readUInt32BE(16);
        const altura = bytes.readUInt32BE(20);

        expect(largura / altura).toBeCloseTo(
            Number(conteudoDe('og:image:width'))
            / Number(conteudoDe('og:image:height')),
            2,
        );
    });
});
