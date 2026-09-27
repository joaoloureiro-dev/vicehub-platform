import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import { useAuth } from '../../auth/auth.context.js';
import { createTopic, listTopics, podeModerar } from '../forum.api.js';

/**
 * O fórum: as perguntas, e a caixa para fazer uma.
 *
 * Ordenado por atividade e não por data de criação — uma pergunta com
 * uma resposta de agora interessa mais do que uma aberta ontem e
 * esquecida. É a lista a dizer onde está a conversa.
 *
 * Quem não tem sessão vê tudo e não vê a caixa. Não é um muro: é a
 * diferença entre ler e escrever, dita mostrando o que falta em vez de
 * um botão que responde 401 ao ser carregado.
 */
export const ForumPage = () => {
    const t = useT();
    const { user } = useAuth();

    const [titulo, setTitulo] = useState('');
    const [corpo, setCorpo] = useState('');
    const [aPublicar, setAPublicar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    /**
     * O que se procura vive no endereço, e não só no estado do ecrã.
     *
     * É o que faz uma procura ser partilhável: quem encontrar a resposta
     * a uma pergunta pode mandar o endereço a outra pessoa, e o que ela
     * abre é a mesma lista. É também o que faz o botão de voltar do
     * browser funcionar como toda a gente espera — sem isto, voltar
     * atrás saía do fórum em vez de desfazer a procura.
     */
    const [endereco, setEndereco] = useSearchParams();
    const procura = endereco.get('q') ?? '';

    /* O que está escrito na caixa, que só vira procura ao submeter. */
    const [termo, setTermo] = useState(procura);

    const pagina = useAsync(() => listTopics(1, procura), [procura]);

    const procurar = (evento: FormEvent) => {
        evento.preventDefault();

        const limpo = termo.trim();

        /*
         * Uma caixa vazia tira o `q` do endereço em vez de lá pôr um
         * vazio: `/forum?q=` e `/forum` são a mesma lista, e dois
         * endereços para a mesma página é um deles a sobrar.
         */
        setEndereco(limpo === '' ? {} : { q: limpo });
    };

    const limpar = () => {
        setTermo('');
        setEndereco({});
    };

    /**
     * A porta da fila de denúncias, para quem a pode abrir.
     *
     * Só aqui e só a quem modera: uma fila que ninguém encontra é um
     * sítio onde as denúncias vão morrer, e um link que a maioria das
     * pessoas abre para levar com uma recusa é ruído no menu de toda a
     * gente. Sem sessão não se pergunta, que é como a rota responde.
     */
    const moderacao = useAsync(
        () => (user === null
            ? Promise.resolve({ canModerate: false })
            : podeModerar()),
        [user],
    );

    const publicar = async (evento: FormEvent) => {
        evento.preventDefault();
        setErro(null);
        setAPublicar(true);

        try {
            await createTopic({ title: titulo, body: corpo });

            setTitulo('');
            setCorpo('');
            pagina.reload();
        } catch {
            setErro(t.forum.naoFoiPossivelPublicar);
        } finally {
            setAPublicar(false);
        }
    };

    if (pagina.error) {
        return (
            /*
              O ecrã de erro não leva `esticado`: o que lá está é um
              aviso de uma linha, e esticá-lo a toda a largura do painel
              punha uma frase curta de um lado ao outro da página. A
              regra é para listas.
            */
            <main className="panel wide">
                <Alert kind="bad">{t.forum.naoCarregou}</Alert>
            </main>
        );
    }

    const topicos = pagina.data?.topics ?? [];

    return (
        <main className="panel wide esticado">
            <header className="card header">
                <h1>{t.forum.titulo}</h1>
                <p>{t.forum.subtitulo}</p>
                {moderacao.data?.canModerate === true ? (
                    <p className="hint">
                        <Link className="ligacao-solta" to="/moderacao">{t.moderacao.irParaFila}</Link>
                    </p>
                ) : null}
            </header>

            <form className="searchbar" onSubmit={procurar} role="search">
                <input
                    type="search"
                    value={termo}
                    aria-label={t.forum.procurarLabel}
                    placeholder={t.forum.procurar}
                    onChange={(event) => {
                        setTermo(event.target.value);
                    }}
                />
                <button className="primary" type="submit">
                    {t.crews.botaoProcurar}
                </button>
            </form>

            {procura === '' ? null : (
                <p className="hint procura-activa">
                    {t.forum.aProcurarPor(procura)}{' '}
                    <button
                        className="ligacao-solta"
                        type="button"
                        onClick={limpar}
                    >
                        {t.forum.limparProcura}
                    </button>
                </p>
            )}

            {user ? (
                <form className="grupo" onSubmit={(e) => void publicar(e)}>
                    <h2>{t.forum.perguntar}</h2>

                    {erro ? <Alert kind="bad">{erro}</Alert> : null}

                    <label className="field">
                        <span>{t.forum.tituloDaPergunta}</span>
                        <input
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            required
                        />
                    </label>

                    <label className="field">
                        <span>{t.forum.corpoDaPergunta}</span>
                        <textarea
                            rows={5}
                            value={corpo}
                            onChange={(e) => setCorpo(e.target.value)}
                            required
                        />
                    </label>

                    <button className="primary" type="submit" disabled={aPublicar}>
                        {aPublicar ? t.comum.aGuardar : t.forum.publicar}
                    </button>
                </form>
            ) : (
                <p className="hint">
                    <Link to="/entrar">{t.forum.entrarParaPerguntar}</Link>
                </p>
            )}

            {topicos.length === 0 ? (
                <p className="hint">
                    {/*
                      Duas frases e não uma: «ainda não há perguntas» a
                      quem procurou por uma palavra é mentira, e deixa a
                      pessoa a achar que o fórum está vazio quando o que
                      está vazio é o resultado dela.
                    */}
                    {procura === ''
                        ? t.forum.aindaSemPerguntas
                        : t.forum.semResultados}
                </p>
            ) : (
                <ul className="lista-topicos">
                    {topicos.map((topico) => (
                        <li key={topico.id}>
                            <Link to={`/forum/${topico.id}`}>
                                <span className="topico-titulo">
                                    {topico.title}
                                </span>

                                {topico.excerpt ? (
                                    <span className="topico-excerto">
                                        {topico.excerpt}
                                    </span>
                                ) : (
                                    <span className="topico-excerto retirado">
                                        {t.forum.retiradoComAConta}
                                    </span>
                                )}

                                <span className="topico-rodape">
                                    <span>
                                        {topico.author?.username
                                            ?? t.forum.contaApagada}
                                    </span>
                                    <span className="topico-respostas">
                                        {topico.replyCount}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
};
