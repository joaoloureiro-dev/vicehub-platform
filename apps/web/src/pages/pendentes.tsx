import { Link } from 'react-router';

import { useT } from '../i18n/i18n.js';
import { usePendente } from './pending.context.js';
import { type PendingItem } from './pending.api.js';

/**
 * O que precisa de mim.
 *
 * Existe porque saber o que falta era uma caminhada: os pedidos de
 * entrada vivem na página de cada crew, os de filiação na de cada
 * servidor, e as decisões de dinheiro na tesouraria de cada um. Quem
 * gere três crews e um servidor tinha quatro páginas para ir espreitar,
 * repetidamente e para sempre.
 *
 * Quando não há nada, não aparece nada. Uma secção a dizer "não tens
 * nada pendente" é uma linha que se lê todos os dias para não dizer
 * nada — e empurra para baixo o que interessa.
 */
export const Pendentes = () => {
    const t = useT();
    const { pendente } = usePendente();

    /**
     * A lista é derivada, e não lida do `total`.
     *
     * Uma resposta que chegue meia — a rota a falhar, um duplo de teste
     * a responder outra coisa — não pode levar a página inteira atrás.
     * Sem nada para mostrar, isto não mostra nada, que é o mesmo que
     * faz quando não há mesmo nada pendente.
     */
    const items = pendente?.items ?? [];
    const amizades = pendente?.friendRequests ?? 0;

    if (items.length === 0 && amizades === 0) {
        return null;
    }

    /**
     * Para onde leva cada espécie de espera.
     *
     * O destino é a página onde a coisa se resolve, e não uma listagem
     * intermédia: quem clica quer decidir, não quer procurar.
     */
    const destino = (item: PendingItem): string =>
        item.kind === 'treasury_decision'
            ? item.communityKind === 'crew'
                ? `/crews/${item.communityId}/tesouraria`
                : `/servidores/${item.communityId}/tesouraria`
            : item.communityKind === 'crew'
                ? `/crews/${item.communityId}`
                : `/servidores/${item.communityId}`;

    const texto = (item: PendingItem): string => {
        switch (item.kind) {
            case 'crew_join_request':
            case 'server_join_request':
                return t.pendentes.pedidosDeEntrada(item.count);
            case 'affiliation_request':
                return t.pendentes.pedidosDeFiliacao(item.count);
            case 'treasury_decision':
                return t.pendentes.decisoesDeDinheiro(item.count);
        }
    };

    return (
        <section className="grupo pendentes">
            <h2>{t.pendentes.titulo}</h2>

            <ul className="lista-pendentes">
                {items.map((item) => (
                    <li key={`${item.kind}:${item.communityId}`}>
                        <Link to={destino(item)}>
                            <span className="pendente-onde">
                                {item.communityName}
                            </span>
                            <span className="pendente-o-que">{texto(item)}</span>
                        </Link>
                    </li>
                ))}

                {amizades > 0 ? (
                    <li key="amigos">
                        <Link to="/eu">
                            <span className="pendente-onde">
                                {t.pendentes.amizades}
                            </span>
                            <span className="pendente-o-que">
                                {t.pendentes.pedidosDeAmizade(amizades)}
                            </span>
                        </Link>
                    </li>
                ) : null}
            </ul>
        </section>
    );
};
