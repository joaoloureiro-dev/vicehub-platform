import { ApiError } from '../lib/api.js';
import { listarRasto, type EntradaDoRasto } from '../lib/rasto.api.js';
import { useAsync } from '../lib/use-async.js';
import { useIdioma, useT } from '../i18n/i18n.js';
import type { Messages } from '../i18n/en.js';

/** Um campo de texto de dentro do JSON gravado, ou undefined. */
const texto = (valor: unknown, campo: string): string | undefined => {
    if (typeof valor !== 'object' || valor === null) {
        return undefined;
    }

    const lido = (valor as Record<string, unknown>)[campo];

    return typeof lido === 'string' ? lido : undefined;
};

/**
 * O que aconteceu, dito numa frase.
 *
 * A ação chega como `crew.member.removed` ou `server.member.removed`: o
 * prefixo diz em que comunidade foi, o resto diz o quê. Só o resto conta
 * aqui, porque a frase é a mesma e quem está a ler já sabe onde está.
 *
 * Uma ação que esta versão do ecrã não saiba dizer aparece pelo nome em
 * bruto. Continua a ser uma decisão que alguém tomou, e escondê-la seria
 * mentir por omissão a quem veio ver o que se passou.
 */
const frase = (t: Messages, entrada: EntradaDoRasto): string => {
    const quem = entrada.actorUsername ?? t.rasto.contaApagada;
    /**
     * De quem ou de quê se trata: uma pessoa, ou a outra comunidade.
     *
     * As decisões de filiação não são sobre um membro — são sobre uma
     * crew inteira ou sobre um servidor —, e por isso o nome vem de
     * outro campo. O mesmo lugar na frase, coisas diferentes.
     */
    const alvo =
        texto(entrada.after, 'username')
        ?? texto(entrada.before, 'username')
        ?? texto(entrada.after, 'crewName')
        ?? texto(entrada.after, 'serverName')
        ?? t.rasto.alguem;

    const cargo = (chave: string | undefined): string =>
        chave === undefined
            ? t.rasto.semCargo
            : (t.cargos[chave as keyof typeof t.cargos] ?? chave);

    switch (entrada.action.replace(/^(crew|server)\./, '')) {
        case 'member.admitted':
            return t.rasto.admitiu(quem, alvo);
        case 'member.refused':
            return t.rasto.recusou(quem, alvo);
        case 'member.removed':
            return t.rasto.removeu(quem, alvo, cargo(texto(entrada.before, 'role')));
        /**
         * A mesma decisão aparece nos dois rastos, e a frase muda com o
         * lado em que se está a ler: o servidor aceitou uma crew, a
         * crew foi aceite por um servidor. O prefixo da ação é o que
         * diz de que lado é esta entrada.
         */
        case 'affiliation.accepted':
            return entrada.action.startsWith('server.')
                ? t.rasto.aceitouCrew(quem, alvo)
                : t.rasto.foiAceiteEm(quem, alvo);
        case 'affiliation.rejected':
            return entrada.action.startsWith('server.')
                ? t.rasto.recusouCrew(quem, alvo)
                : t.rasto.foiRecusadaEm(quem, alvo);
        case 'affiliation.removed':
            return entrada.action.startsWith('server.')
                ? t.rasto.tirouCrew(quem, alvo)
                : t.rasto.foiTiradaDe(quem, alvo);
        case 'member.role_changed':
            return t.rasto.mudouCargo(
                quem,
                alvo,
                cargo(texto(entrada.before, 'role')),
                cargo(texto(entrada.after, 'role')),
            );
        default:
            return t.rasto.fez(quem, entrada.action);
    }
};

/**
 * O que se decidiu nesta comunidade sobre pessoas.
 *
 * O rasto era escrito desde sempre e não havia por onde o ler. A
 * pergunta que o traz aqui — quem é que o pôs fora, quem é que o fez
 * oficial — não tinha resposta em lado nenhum do produto.
 *
 * Fica ao lado da lista de membros de propósito: é ali que a pergunta
 * se faz.
 */
export const RastoDaComunidade = ({
    base,
    id,
}: {
    base: '/crews' | '/servers';
    id: string;
}) => {
    const t = useT();
    const { idioma } = useIdioma();

    /**
     * Um 403 é a resposta e não uma avaria: quer dizer "não é tua para
     * veres". A secção simplesmente não aparece.
     */
    const rasto = useAsync<EntradaDoRasto[] | null>(
        () =>
            listarRasto(base, id).catch((falha: unknown) => {
                if (falha instanceof ApiError && falha.status === 403) {
                    return null;
                }

                throw falha;
            }),
        [base, id],
    );

    /**
     * Duas razões para não mostrar nada, e nenhuma delas é um erro:
     * ainda não chegou, ou não é desta pessoa para ver. `useAsync`
     * começa em `null` e a recusa devolve `null` também — as duas dão a
     * mesma coisa no ecrã, que é coisa nenhuma.
     */
    if (rasto.loading || rasto.data === null) {
        return null;
    }

    return (
        <section className="grupo">
            <h2>{t.rasto.titulo}</h2>

            {rasto.data.length === 0 ? (
                <p className="hint">{t.rasto.aindaNada}</p>
            ) : (
                <ul className="rasto">
                    {rasto.data.map((entrada) => (
                        <li key={entrada.id}>
                            <span className="rasto-frase">
                                {frase(t, entrada)}
                            </span>
                            <span className="rasto-quando">
                                {new Date(entrada.at).toLocaleDateString(idioma)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};
