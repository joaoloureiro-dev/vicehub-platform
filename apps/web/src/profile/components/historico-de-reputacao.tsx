import { Link } from 'react-router';

import { useT } from '../../i18n/i18n.js';
import type { ReputationEntry } from '../profile.types.js';

interface HistoricoDeReputacaoProps {
    entradas: ReputationEntry[];
}

/**
 * O endereço de um evento, que é o da comunidade que o marcou.
 *
 * Devolve `null` quando não há por onde lá chegar — o evento foi apagado
 * e a linha ficou sem dono. A linha fica na mesma: o que aconteceu
 * aconteceu, e a reputação que veio dele continua a contar.
 */
const enderecoDo = (evento: ReputationEntry['event']): string | null => {
    if (evento === null) {
        return null;
    }

    if (evento.crewId !== null) {
        return `/crews/${evento.crewId}/eventos/${evento.id}`;
    }

    if (evento.serverId !== null) {
        return `/servidores/${evento.serverId}/eventos/${evento.id}`;
    }

    return null;
};

/**
 * De onde veio a reputação de quem está a ver.
 *
 * Um número sozinho só se pode acreditar, e este aparece no perfil
 * público de quem quer que lá chegue. Esta lista é a razão de a
 * reputação ser gravada como factos e não como uma soma: cada linha diz
 * quanto, porquê, e de que evento.
 *
 * **Só a própria pessoa a vê**, e não é arrumação: a lista diz os nomes
 * dos eventos, e o calendário de uma comunidade é dela. Pendurada no
 * perfil público, bastava abrir a página de alguém para saber a que
 * assaltos a crew dele foi. É a mesma linha que o histórico de xp de uma
 * crew traça — o total pode andar por aí, os eventos não.
 */
export const HistoricoDeReputacao = ({
    entradas,
}: HistoricoDeReputacaoProps) => {
    const t = useT();

    if (entradas.length === 0) {
        return (
            <section className="grupo">
                <h2>{t.perfil.reputacaoDeOnde}</h2>
                <p className="hint">{t.perfil.reputacaoVazia}</p>
            </section>
        );
    }

    return (
        <section className="grupo">
            <h2>{t.perfil.reputacaoDeOnde}</h2>

            <ul className="ganhos">
                {entradas.map((entrada) => {
                    const endereco = enderecoDo(entrada.event);

                    /**
                     * O sinal sai do número e não da razão. São duas
                     * maneiras de dizer a mesma coisa, e lê-las de sítios
                     * diferentes deixava-as poder discordar no ecrã.
                     */
                    const subiu = entrada.amount > 0;

                    return (
                        <li key={entrada.id}>
                            <span
                                className={
                                    subiu
                                        ? 'ganho-quanto'
                                        : 'ganho-quanto perdeu'
                                }
                            >
                                {subiu ? '+' : '−'}
                                {Math.abs(entrada.amount)}
                            </span>

                            <span className="ganho-porque">
                                {entrada.event === null ? (
                                    t.perfil.reputacaoEventoApagado
                                ) : endereco === null ? (
                                    entrada.event.name
                                ) : (
                                    <Link to={endereco}>
                                        {entrada.event.name}
                                    </Link>
                                )}
                                {' — '}
                                {subiu
                                    ? t.perfil.reputacaoApareceu
                                    : t.perfil.reputacaoFaltou}
                            </span>

                            <time
                                className="ganho-quando"
                                dateTime={entrada.at}
                            >
                                {new Date(entrada.at).toLocaleDateString()}
                            </time>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};
