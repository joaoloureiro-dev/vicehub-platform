import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Route, Routes } from 'react-router';

import { AuthProvider } from '../src/auth/auth.context.js';
import { ForumPage } from '../src/forum/pages/forum.page.js';
import { TopicPage } from '../src/forum/pages/topic.page.js';
import { montarEcra, t } from './helpers.js';

/**
 * As partes do fórum, no ecrã.
 *
 * Que o filtro filtra é da API e tem o seu teste contra PostgreSQL. O
 * que aqui se guarda é o que o ecrã faz com ele:
 *
 * - que a categoria vai no **endereço**, como a procura, porque uma
 *   parte do fórum é uma coisa que se manda a alguém — «a tua pergunta
 *   é das crews, é aqui»;
 * - que a procura e a categoria se cruzam em vez de se apagarem uma à
 *   outra;
 * - que uma categoria escrita à mão que não existe dá o fórum todo, e
 *   não um ecrã de erro por causa de uma letra trocada;
 * - e que a lista vazia diz coisas diferentes consoante o fórum esteja
 *   vazio, a categoria esteja vazia, ou a procura não tenha dado nada.
 */
const json = (body: unknown): Response =>
    ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response;

const topico = (id: string, title: string, category: string) => ({
    id,
    title,
    category,
    excerpt: 'um excerto',
    author: { id: 'a', username: 'kestrel', avatarUrl: null },
    replyCount: 0,
    isLocked: false,
    isAnswered: false,
    createdAt: '2026-09-01T10:00:00.000Z',
    lastActivityAt: '2026-09-01T10:00:00.000Z',
});

const TODOS = [
    topico('1', 'Noite de corridas', 'general'),
    topico('2', 'A crew procura gente', 'crews'),
    topico('3', 'O servidor caiu outra vez', 'servers'),
];

const pagina = (topicos: typeof TODOS) => ({
    topics: topicos,
    page: 1,
    pages: 1,
    total: topicos.length,
});

/**
 * O duplo nomeia as rotas que conhece e rebenta nas outras, e responde
 * ao pedido da lista lendo o endereço como a API o leria: filtra pela
 * categoria quando lá vem uma, e pela palavra quando lá vem uma. Um
 * duplo que devolvesse sempre a mesma lista deixava passar um ecrã que
 * pede a coisa errada.
 */
const responder = (): ReturnType<typeof vi.fn> => {
    const chamadas = vi.fn((entrada: string, init?: { method?: string }) => {
        const endereco = String(entrada);

        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                json({
                    accessToken: 'token',
                    user: {
                        id: 'u1',
                        email: 'quem@vicehub.test',
                        username: 'quem',
                    },
                }),
            );
        }

        if (endereco.includes('/forum/moderation')) {
            return Promise.resolve(json({ canModerate: false }));
        }

        if (endereco.includes('/forum/topics') && init?.method === 'POST') {
            return Promise.resolve(json({ id: 'novo' }));
        }

        if (endereco.includes('/forum/topics?')) {
            const query = new URLSearchParams(endereco.split('?')[1] ?? '');
            const categoria = query.get('category');
            const procura = query.get('q');

            return Promise.resolve(
                json(
                    pagina(
                        TODOS.filter(
                            (linha) =>
                                (categoria === null
                                    || linha.category === categoria)
                                && (procura === null
                                    || linha.title.includes(procura)),
                        ),
                    ),
                ),
            );
        }

        throw new Error(`pedido não previsto: ${endereco}`);
    });

    vi.stubGlobal('fetch', chamadas);

    return chamadas;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

const abrir = (entrada = '/forum') =>
    montarEcra(<AuthProvider><ForumPage /></AuthProvider>, entrada);

/**
 * As abas, e nada mais.
 *
 * Os nomes das categorias aparecem em três sítios no mesmo ecrã — nas
 * abas, na caixa de seleção de quem pergunta, e na pílula de cada
 * linha. Uma procura pelo texto encontrava os três, e um teste que
 * passasse por encontrar o errado não provava nada.
 */
const abas = () =>
    within(screen.getByRole('navigation', { name: t.forum.partesDoForum }));

/** E a lista, também sem as abas nem a caixa. */
const lista = () => within(screen.getByRole('list'));

/**
 * O corpo com que uma pergunta foi publicada.
 *
 * Procura pelo endereço **e** pelo método: o `/auth/refresh` também vai
 * por POST e sem corpo nenhum, e procurar só pelo método encontrava-o a
 * ele.
 */
const publicada = (chamadas: ReturnType<typeof vi.fn>): { category?: string } => {
    const pedido = chamadas.mock.calls.find(
        (argumentos) =>
            String(argumentos[0]).includes('/forum/topics')
            && (argumentos[1] as { method?: string } | undefined)?.method
                === 'POST',
    );

    return JSON.parse(String((pedido?.[1] as { body?: string }).body)) as {
        category?: string;
    };
};

/** O último pedido da lista, que é o que conta depois de um clique. */
const ultimaLista = (chamadas: ReturnType<typeof vi.fn>): string =>
    [...chamadas.mock.calls]
        .map((argumentos) => String(argumentos[0]))
        .filter((endereco) => endereco.includes('/forum/topics?'))
        .at(-1) ?? '';

describe('as partes do fórum', () => {
    it('mostra as cinco, e uma para ver tudo', async () => {
        responder();
        abrir();

        expect(await screen.findByText(t.forum.todasAsCategorias)).toBeTruthy();
        expect(abas().getByText(t.categoriasDoForum.general)).toBeTruthy();
        expect(abas().getByText(t.categoriasDoForum.crews)).toBeTruthy();
        expect(abas().getByText(t.categoriasDoForum.servers)).toBeTruthy();
        expect(abas().getByText(t.categoriasDoForum.roleplay)).toBeTruthy();
        expect(abas().getByText(t.categoriasDoForum.support)).toBeTruthy();
    });

    /**
     * Sem categoria no endereço, o fórum todo — e o pedido não leva
     * categoria nenhuma. Uma omissão aqui escondia quatro quintos do
     * fórum a quem nunca pediu para o filtrar.
     */
    it('sem categoria no endereço, pede o fórum todo', async () => {
        const chamadas = responder();
        abrir();

        expect(await screen.findByText('Noite de corridas')).toBeTruthy();
        expect(screen.getByText('A crew procura gente')).toBeTruthy();
        expect(ultimaLista(chamadas)).not.toContain('category=');
    });

    it('lê a categoria do endereço e pede só essa', async () => {
        const chamadas = responder();
        abrir('/forum?categoria=crews');

        expect(await screen.findByText('A crew procura gente')).toBeTruthy();
        expect(screen.queryByText('Noite de corridas')).toBeNull();
        expect(ultimaLista(chamadas)).toContain('category=crews');
    });

    /** E a aba dessa categoria fica acesa, para se saber onde se está. */
    it('e acende a aba onde se está', async () => {
        responder();
        abrir('/forum?categoria=crews');

        await screen.findByText('A crew procura gente');

        expect(
            abas()
                .getByText(t.categoriasDoForum.crews)
                .getAttribute('aria-current'),
        ).toBe('true');
        expect(
            abas()
                .getByText(t.forum.todasAsCategorias)
                .getAttribute('aria-current'),
        ).toBe('false');
    });

    it('carregar numa aba põe-na no endereço', async () => {
        const chamadas = responder();
        abrir();

        await screen.findByText('Noite de corridas');
        await userEvent.click(abas().getByText(t.categoriasDoForum.servers));

        await waitFor(() => {
            expect(ultimaLista(chamadas)).toContain('category=servers');
        });

        expect(
            abas()
                .getByText(t.categoriasDoForum.servers)
                .getAttribute('aria-current'),
        ).toBe('true');
    });

    it('e voltar a "tudo" tira-a de lá', async () => {
        const chamadas = responder();
        abrir('/forum?categoria=servers');

        await screen.findByText('O servidor caiu outra vez');
        await userEvent.click(abas().getByText(t.forum.todasAsCategorias));

        await waitFor(() => {
            expect(ultimaLista(chamadas)).not.toContain('category=');
        });

        expect(
            abas()
                .getByText(t.forum.todasAsCategorias)
                .getAttribute('aria-current'),
        ).toBe('true');
    });

    /**
     * Uma categoria que não existe é o fórum todo, e não um erro.
     *
     * A API recusaria a palavra com um 400, e um ecrã em branco com um
     * aviso vermelho por causa de uma letra trocada num endereço é pior
     * do que ignorar o que não se entende.
     */
    it('ignora uma categoria que não existe', async () => {
        const chamadas = responder();
        abrir('/forum?categoria=memes');

        expect(await screen.findByText('Noite de corridas')).toBeTruthy();
        expect(ultimaLista(chamadas)).not.toContain('category=');
    });

    /**
     * Quem procurou uma palavra e carrega numa categoria quer a palavra
     * **dentro** dela, e não recomeçar do princípio.
     */
    it('cruza a procura com a categoria', async () => {
        const chamadas = responder();
        abrir('/forum?q=crew');

        await screen.findByText('A crew procura gente');
        await userEvent.click(abas().getByText(t.categoriasDoForum.crews));

        await waitFor(() => {
            expect(ultimaLista(chamadas)).toContain('category=crews');
        });

        expect(ultimaLista(chamadas)).toContain('q=crew');
    });

    /**
     * E procurar de dentro de uma categoria procura **dentro** dela.
     *
     * Sem isto, escrever na caixa saltava para o fórum todo: quem
     * estava nas crews e escreveu uma palavra ficava com resultados de
     * todo o lado, sem ter pedido para sair de onde estava.
     */
    it('procurar de dentro de uma categoria não sai dela', async () => {
        const chamadas = responder();
        abrir('/forum?categoria=crews');

        await screen.findByText('A crew procura gente');

        await userEvent.type(screen.getByRole('searchbox'), 'crew');
        await userEvent.click(screen.getByText(t.crews.botaoProcurar));

        await waitFor(() => {
            expect(ultimaLista(chamadas)).toContain('q=crew');
        });

        expect(ultimaLista(chamadas)).toContain('category=crews');
    });

    /** E limpar a procura deixa-o onde está: a categoria não é a procura. */
    it('limpar a procura não sai da categoria', async () => {
        const chamadas = responder();
        abrir('/forum?q=crew&categoria=crews');

        await screen.findByText('A crew procura gente');
        await userEvent.click(screen.getByText(t.forum.limparProcura));

        await waitFor(() => {
            expect(ultimaLista(chamadas)).not.toContain('q=');
        });

        expect(ultimaLista(chamadas)).toContain('category=crews');
    });

    /**
     * A categoria de cada pergunta aparece na lista inteira, que é onde
     * distingue uma pergunta sobre servidores de uma sobre crews antes
     * de a abrir. Dentro de uma categoria seria a mesma palavra
     * repetida em todas as linhas.
     */
    it('diz a categoria de cada pergunta, na lista inteira', async () => {
        responder();
        abrir();

        await screen.findByText('Noite de corridas');

        expect(lista().getByText(t.categoriasDoForum.servers)).toBeTruthy();
        expect(lista().getByText(t.categoriasDoForum.crews)).toBeTruthy();
        expect(lista().getByText(t.categoriasDoForum.general)).toBeTruthy();
    });

    it('e não a repete dentro de uma categoria', async () => {
        responder();
        abrir('/forum?categoria=crews');

        await screen.findByText('A crew procura gente');

        expect(lista().queryByText(t.categoriasDoForum.crews)).toBeNull();
    });

    /**
     * «Ainda não há perguntas» a quem está numa categoria vazia é
     * mentira sobre o fórum inteiro, e manda embora quem ia perguntar.
     */
    it('uma categoria vazia não diz que o fórum está vazio', async () => {
        responder();
        abrir('/forum?categoria=roleplay');

        expect(
            await screen.findByText(t.forum.semPerguntasNaCategoria),
        ).toBeTruthy();
        expect(screen.queryByText(t.forum.aindaSemPerguntas)).toBeNull();
    });

    it('e uma procura sem resultados continua a dizer o que é', async () => {
        responder();
        abrir('/forum?q=nada-disto&categoria=roleplay');

        expect(await screen.findByText(t.forum.semResultados)).toBeTruthy();
        expect(screen.queryByText(t.forum.semPerguntasNaCategoria)).toBeNull();
    });

    /**
     * E dentro da pergunta, a categoria é o caminho de volta.
     *
     * Quem chega a um tópico de uma pesquisa não veio da lista e não
     * sabe que partes existem. A pílula diz-lhe de que parte é esta, e
     * leva-o lá.
     */
    it('leva de volta à parte do fórum, de dentro da pergunta', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((entrada: string) => {
                const endereco = String(entrada);

                if (endereco.endsWith('/auth/refresh')) {
                    return Promise.resolve(json({
                        accessToken: 'token',
                        user: { id: 'u1', email: 'q@v.test', username: 'q' },
                    }));
                }

                if (endereco.includes('/forum/moderation')) {
                    return Promise.resolve(json({ canModerate: false }));
                }

                if (endereco.includes('/forum/topics/')) {
                    return Promise.resolve(json({
                        id: 'topico-1',
                        title: 'A crew procura gente',
                        body: 'Somos seis e queremos ser dez.',
                        category: 'crews',
                        author: { id: 'a', username: 'kestrel', avatarUrl: null },
                        isLocked: false,
                        createdAt: '2026-09-01T10:00:00.000Z',
                        askedById: 'a',
                        acceptedReplyId: null,
                        replies: [],
                    }));
                }

                throw new Error(`pedido não previsto: ${endereco}`);
            }),
        );

        montarEcra(
            <AuthProvider>
                <Routes>
                    <Route path="/forum/:topicId" element={<TopicPage />} />
                </Routes>
            </AuthProvider>,
            '/forum/topico-1',
        );

        const pilula = await screen.findByText(t.categoriasDoForum.crews);

        expect(pilula.getAttribute('href')).toBe('/forum?categoria=crews');
    });

    /**
     * E quem pergunta escolhe onde. Sem isto, a escolha ficava no ecrã
     * e a pergunta caía toda na conversa geral — que é pior do que não
     * haver escolha nenhuma, porque quem escolheu fica a achar que
     * escolheu.
     */
    it('publica na categoria escolhida', async () => {
        const chamadas = responder();
        abrir();

        await screen.findByText('Noite de corridas');

        await userEvent.selectOptions(
            screen.getByLabelText(t.forum.categoriaLabel),
            'support',
        );
        await userEvent.type(
            screen.getByLabelText(t.forum.tituloDaPergunta),
            'O ViceHub não me deixa entrar',
        );
        await userEvent.type(
            screen.getByLabelText(t.forum.corpoDaPergunta),
            'Ponho a palavra-passe e volta ao princípio.',
        );
        await userEvent.click(screen.getByText(t.forum.publicar));

        await waitFor(() => {
            expect(publicada(chamadas).category).toBe('support');
        });
    });

    /** E, sem lhe tocar, na conversa geral — que é a omissão. */
    it('e na geral quando ninguém mexe na escolha', async () => {
        const chamadas = responder();
        abrir();

        await screen.findByText('Noite de corridas');

        await userEvent.type(
            screen.getByLabelText(t.forum.tituloDaPergunta),
            'Uma pergunta sem sítio nenhum',
        );
        await userEvent.type(
            screen.getByLabelText(t.forum.corpoDaPergunta),
            'E que vai parar à conversa geral.',
        );
        await userEvent.click(screen.getByText(t.forum.publicar));

        await waitFor(() => {
            expect(publicada(chamadas).category).toBe('general');
        });
    });
});
