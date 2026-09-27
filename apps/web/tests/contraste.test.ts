import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A regra que faz este tema funcionar de noite.
 *
 * O produto assentava em papel branco, e sobre branco os néons do
 * logótipo não se lêem: o magenta dava 3,30 de contraste e o ciano 1,81.
 * A solução era invertê-los — tinta escura por cima da cor —, e isso
 * obrigava a ter uma versão funda de cada néon para quando a cor tinha
 * de ser texto.
 *
 * Em fundo de noite a aritmética vira do avesso, e vira **a favor**: um
 * néon sobre `#0B0711` passa por si (o ciano dá 11,04, o magenta 6,04),
 * e as versões claras dos mesmos tons passam com folga larga. O que
 * deixa de passar é o contrário — tinta clara por cima de um néon
 * aceso —, e por isso a tinta que assenta nos preenchimentos é a **noite**.
 *
 * Continuam a ser duas metades, só que trocadas de lado:
 *
 * - os néons **acendem**, e por cima deles vai `--on-brand`, que é a cor
 *   da página;
 * - o que é **texto** usa as versões `-ink`, agora claras e não fundas,
 *   calculadas para passarem 4,5 sobre o mais claro dos fundos do tema.
 *
 * Isto é aritmética, não gosto, e por isso é verificável. Sem o teste, a
 * regra morre no dia em que alguém escrever `color: var(--ink)` dentro de
 * um botão de néon — que parece a coisa óbvia a fazer, e deixa a palavra
 * por ler sem dar erro nenhum.
 */
const CSS = readFileSync(
    path.resolve(import.meta.dirname, '../src/styles/theme.css'),
    'utf8',
);

/** O `:root`, que é onde os tokens são declarados e não usados. */
const RAIZ = ((): string => {
    const inicio = CSS.indexOf(':root {');

    expect(inicio, 'o :root não existe').toBeGreaterThan(-1);

    return CSS.slice(inicio, CSS.indexOf('\n}', inicio));
})();

/** O valor de um token, tal como está declarado no `:root`. */
const token = (nome: string): string => {
    const achado = RAIZ.match(new RegExp(`--${nome}:\\s*([^;]+);`, 'u'));

    expect(achado, `o token --${nome} não existe`).not.toBeNull();

    return (achado as RegExpMatchArray)[1]!.trim();
};

const canal = (v: number): number => {
    const s = v / 255;

    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminancia = (hex: string): number => {
    const n = Number.parseInt(hex.slice(1), 16);

    return (
        0.2126 * canal((n >> 16) & 255)
        + 0.7152 * canal((n >> 8) & 255)
        + 0.0722 * canal(n & 255)
    );
};

/** O contraste entre duas cores, pela fórmula das WCAG. */
const contraste = (a: string, b: string): number => {
    const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);

    return (claro! + 0.05) / (escuro! + 0.05);
};

/** O mínimo das WCAG para texto normal. */
const LEGIVEL = 4.5;

/**
 * Tinta que assenta por cima de uma cor, e não por cima da página.
 *
 * São as duas inversões do tema, e existem as duas por uma razão que se
 * escreve numa linha. Qualquer outro token usado como texto tem de se
 * ler sobre o fundo — é isso que o último teste verifica, e é por isso
 * que as exceções estão aqui em vez de estarem por dizer.
 */
const EXCEÇÕES: Readonly<Record<string, string>> = {
    'on-brand': 'a tinta dos preenchimentos de néon, onde o fundo é a cor',
};

describe('as cores do tema', () => {
    /** Os três fundos onde o produto põe texto. */
    const FUNDOS = ['ground', 'surface', 'wash'] as const;

    const papel = token('ground');

    /**
     * O mais claro dos três é o caso difícil, e é contra ele que tudo
     * se mede. Pinado ao `--ground` sozinho, o teste passava e os campos
     * de formulário — que são `--wash` — ficavam de fora.
     */
    const maisClaro = [...FUNDOS]
        .map(token)
        .sort((a, b) => luminancia(b) - luminancia(a))[0]!;

    it('assenta em noite, e não em papel', () => {
        /*
         * Em número e não em hexadecimal: o tom da noite pode ser
         * afinado, o que não pode é a página aclarar até o resto do
         * tema deixar de fazer sentido. `0.05` de luminância é mais
         * escuro do que qualquer cinzento a que se chame cinzento.
         */
        expect(luminancia(papel)).toBeLessThan(0.05);
    });

    /**
     * E o painel assenta por cima da página, nunca por baixo. É o que
     * dá o relevo do tema sem precisar de uma moldura em todo o cartão.
     */
    it('põe os painéis acima da página, e não abaixo', () => {
        expect(luminancia(token('surface'))).toBeGreaterThan(luminancia(papel));
        expect(luminancia(token('wash'))).toBeGreaterThan(
            luminancia(token('surface')),
        );
    });

    /**
     * As versões claras existem exatamente para isto. Se uma delas
     * deixar de passar, deixou de servir para o que foi feita.
     */
    it.each([
        'ink',
        'muted',
        'faint',
        'magenta-ink',
        'violet-ink',
        'cyan-ink',
        'ok-ink',
        'danger-ink',
        'sunset-ink',
    ])('--%s lê-se sobre o mais claro dos fundos', (nome) => {
        expect(contraste(token(nome), maisClaro)).toBeGreaterThanOrEqual(LEGIVEL);
    });

    /**
     * E a tinta que assenta por cima do néon serve para os seis, porque
     * é uma só. Um botão que mudasse de cor de letra conforme o fundo
     * daria dois botões em vez de um.
     */
    it.each(['magenta', 'violet', 'cyan', 'ok', 'danger', 'sunset'])(
        'a tinta da marca lê-se por cima de --%s',
        (nome) => {
            expect(contraste(token('on-brand'), token(nome)))
                .toBeGreaterThanOrEqual(LEGIVEL);
        },
    );

    /**
     * E o degradê é verificado paragem a paragem, porque as cores dele
     * não são tokens.
     *
     * É o buraco que os testes de cima não tapam: `--brand` traz três
     * hexadecimais escritos dentro da própria declaração, e uma paragem
     * afinada a olho no meio de um degradê não aparece em lista nenhuma
     * de tokens. O meio deste passa a 4,71 — é a paragem mais apertada
     * do tema, e é a que mais convida a ser mexida.
     */
    it.each([
        ['brand', 'on-brand', 'o que acende, com a página recortada nas letras'],
        ['brand-ink', 'papel', 'o que vai recortado nas letras da marca'],
    ])('cada paragem de --%s se lê', (degrade, contra) => {
        const paragens = [...token(degrade).matchAll(/#[0-9a-f]{6}/giu)]
            .map((achado) => achado[0]);

        expect(paragens.length, 'um degradê sem paragens').toBeGreaterThan(1);

        for (const paragem of paragens) {
            expect(
                contraste(paragem, contra === 'papel' ? maisClaro : token(contra)),
                `a paragem ${paragem} de --${degrade}`,
            ).toBeGreaterThanOrEqual(LEGIVEL);
        }
    });

    /**
     * E o degradê tem duas versões pela mesma razão. O que acende é para
     * preencher; o que se lê é o claro, e é ele que vai recortado nas
     * letras da marca.
     */
    it('recorta nas letras o degradê que se lê, e não o que acende', () => {
        const inicio = CSS.indexOf('.brand strong {');

        expect(inicio, 'a regra do nome da marca não existe').toBeGreaterThan(-1);

        const corpo = CSS.slice(inicio, CSS.indexOf('}', inicio));

        expect(corpo).toContain('var(--brand-ink)');
    });

    /**
     * O caso que nunca deve voltar: uma cor que não se lê no sítio onde
     * está a ser lida.
     *
     * A versão anterior deste teste tinha uma lista de seis néons
     * proibidos como texto. Em fundo de noite essa lista passou a estar
     * errada — os néons lêem-se —, e uma lista de nomes nunca cobria o
     * token que alguém acrescentasse amanhã. Isto mede: percorre a folha
     * inteira, tira cada token que lá aparece como cor de letra, e faz a
     * conta. É o que o torna útil daqui a um ano, quando houver ecrãs que
     * hoje não existem.
     */
    it('nunca usa como texto uma cor que não se leia', () => {
        /*
         * `(^|[^-a-z])` porque `border-color:` e `background-color:`
         * acabam nas mesmas sete letras, e sem isto um filete contava
         * como texto.
         */
        const usados = new Set(
            [...CSS.matchAll(/(^|[^-a-z])color:\s*var\(--([a-z-]+)\)/gu)]
                .map((achado) => achado[2] as string),
        );

        const ilegiveis = [...usados]
            .filter((nome) => !(nome in EXCEÇÕES))
            .filter((nome) => contraste(token(nome), maisClaro) < LEGIVEL);

        expect(
            ilegiveis,
            'sobre o fundo do tema isto não se lê: usa a versão -ink',
        ).toEqual([]);
    });

    /**
     * E as duas exceções continuam a ser duas. Uma exceção que já não
     * corresponde a nada é pior do que nenhuma: fica escrita, lê-se como
     * permissão, e deixa passar o caso seguinte.
     */
    it('e as inversões escritas são as que existem', () => {
        const usados = [...CSS.matchAll(/(^|[^-a-z])color:\s*var\(--([a-z-]+)\)/gu)]
            .map((achado) => achado[2] as string);

        const mortas = Object.keys(EXCEÇÕES).filter(
            (nome) => !usados.includes(nome),
        );

        expect(mortas, 'esta inversão já não existe na folha').toEqual([]);
    });
});
