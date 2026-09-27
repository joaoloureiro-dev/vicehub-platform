import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LimiteDeErro } from '../src/components/limite-de-erro.js';
import { I18nProvider } from '../src/i18n/i18n.js';

/**
 * A página branca, que é a avaria que ninguém consegue reportar.
 *
 * Um erro a desenhar qualquer componente desmontava a árvore inteira, e
 * o que ficava era branco. Sem mensagem, sem botão, sem nada que dissesse
 * que tinha acontecido alguma coisa — indistinguível de a rede ter caído,
 * do telemóvel estar lento, ou de o produto não existir. Quem apanha
 * isso fecha o separador, e nunca ninguém fica a saber.
 */
const Rebenta = (): never => {
    throw new Error('rebentei de propósito');
};

const comIdioma = (idioma: string, filhos: React.ReactNode) => {
    window.localStorage.setItem('vicehub.idioma', idioma);

    return render(<I18nProvider>{filhos}</I18nProvider>);
};

/*
 * O React escreve o erro na consola por si, além do que a fronteira
 * escreve. Silenciar só o `error` mantém a saída do teste legível sem
 * esconder uma falha verdadeira: o que interessa provar é que a
 * fronteira **também** escreve, e isso é verificado com um espião.
 */
let consola: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    consola.mockRestore();
    window.localStorage.clear();
});

describe('o limite de erro', () => {
    it('deixa passar o que funciona', () => {
        comIdioma('en', <LimiteDeErro><p>tudo bem</p></LimiteDeErro>);

        expect(screen.getByText('tudo bem')).toBeTruthy();
    });

    it('mostra um ecrã em vez de uma página branca', () => {
        comIdioma('en', <LimiteDeErro><Rebenta /></LimiteDeErro>);

        expect(screen.getByRole('alert')).toBeTruthy();
        expect(screen.getByText('This screen broke')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Reload the page' })).toBeTruthy();
    });

    /**
     * E diz que a pessoa não partiu nada.
     *
     * É a única frase daquele ecrã que faz trabalho: quem vê uma
     * aplicação rebentar assume que carregou onde não devia, e a
     * seguir tem medo de voltar a carregar.
     */
    it('diz que a culpa não é de quem está a ler', () => {
        comIdioma('en', <LimiteDeErro><Rebenta /></LimiteDeErro>);

        expect(screen.getByText(/Nothing you did caused it/u)).toBeTruthy();
    });

    /**
     * E fala a língua do ecrã.
     *
     * A fronteira vive dentro do `I18nProvider` precisamente por isto.
     * É o único texto que a pessoa tem para perceber o que aconteceu, e
     * dá-lo em português a quem está a usar a plataforma em francês é a
     * mesma falta de educação que os emails tinham.
     */
    it.each([
        ['pt', 'Este ecrã avariou'],
        ['es', 'Esta pantalla se ha roto'],
        ['fr', 'Cet écran a planté'],
    ])('fala %s a quem escolheu %s', (idioma, titulo) => {
        comIdioma(idioma, <LimiteDeErro><Rebenta /></LimiteDeErro>);

        expect(screen.getByText(titulo)).toBeTruthy();
    });

    /**
     * E não engole o erro.
     *
     * Uma fronteira silenciosa é pior do que nenhuma: o ecrã deixa de
     * estar branco e, em troca, ninguém volta a saber o que aconteceu.
     */
    it('deixa o erro no log', () => {
        comIdioma('en', <LimiteDeErro><Rebenta /></LimiteDeErro>);

        const nosso = consola.mock.calls.filter(
            (chamada: unknown[]) => String(chamada[0]).includes('[ViceHub]'),
        );

        expect(nosso.length).toBeGreaterThan(0);
        expect(String(nosso[0]?.[1])).toContain('rebentei de propósito');
    });
});

/**
 * E os dois sítios onde ela tem de estar.
 *
 * Isto lê o código em vez de o correr, o que é o que os testes da folha
 * de estilo já fazem — e pela mesma razão: o que está aqui em causa não
 * é o que um componente faz, é **onde** está posto, e isso não se
 * observa a partir de dentro dele.
 *
 * Sem os dois, tudo o resto continua a passar. Foi assim que este teste
 * apareceu: tirar a fronteira de dentro da casca não fazia falhar um
 * único dos seiscentos e setenta testes.
 *
 * O que isto **não** vê: se alguém as trocar por outra coisa com o mesmo
 * nome, ou reescrever o ficheiro de outra maneira. Vê o caso que
 * aconteceu, que é alguém tirá-las por engano ao mexer à volta.
 */
const ler = (relativo: string): string =>
    readFileSync(path.resolve(import.meta.dirname, relativo), 'utf8');

describe('onde a fronteira está posta', () => {
    it('à volta da página, por dentro da casca', () => {
        const app = ler('../src/app.tsx');

        /*
         * À volta do `Suspense` e não ao lado: é o `Outlet` que desenha a
         * página, e é a página que rebenta. Posta por fora da casca, o
         * que cai com ela é a navegação — e a pessoa fica sem saída que
         * não seja recarregar.
         */
        expect(app).toMatch(
            /<LimiteDeErro>\s*<Suspense[\s\S]*?<Outlet \/>\s*<\/Suspense>\s*<\/LimiteDeErro>/u,
        );
    });

    it('e à volta de tudo, por dentro do idioma', () => {
        const main = ler('../src/main.tsx');

        expect(main).toMatch(/<I18nProvider>[\s\S]*<LimiteDeErro>/u);
        expect(main).toMatch(/<LimiteDeErro>[\s\S]*<BrowserRouter>/u);
    });
});
