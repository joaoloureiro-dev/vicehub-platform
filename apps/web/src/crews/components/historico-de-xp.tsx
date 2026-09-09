import { Link } from 'react-router';

import { useT } from '../../i18n/i18n.js';
import type { CrewXpAward } from '../crew.types.js';

interface HistoricoDeXpProps {
    crewId: string;
    ganhos: CrewXpAward[];
}

/**
 * De onde veio o xp da crew.
 *
 * Um número sozinho só se pode acreditar. Esta lista é a razão de o xp
 * ser gravado como factos e não como uma soma: cada linha diz quanto,
 * porquê, e de que evento — e o evento é um link, porque a pergunta
 * seguinte é sempre "qual foi esse?".
 *
 * Só quem pertence à crew chega aqui: a lista diz os nomes dos eventos,
 * e o calendário de uma comunidade é dela. Quem não pertence não vê a
 * secção — a API responde 403 e o ecrã trata isso como "não é para ti",
 * e não como avaria.
 */
export const HistoricoDeXp = ({ crewId, ganhos }: HistoricoDeXpProps) => {
    const t = useT();

    if (ganhos.length === 0) {
        return (
            <section className="grupo">
                <h2>{t.progressao.historico}</h2>
                <p className="hint">{t.progressao.aindaSemGanhos}</p>
            </section>
        );
    }

    return (
        <section className="grupo">
            <h2>{t.progressao.historico}</h2>

            <ul className="ganhos">
                {ganhos.map((ganho) => (
                    <li key={ganho.id}>
                        <span className="ganho-quanto">+{ganho.amount}</span>

                        <span className="ganho-porque">
                            {ganho.event ? (
                                <Link
                                    to={`/crews/${crewId}/eventos/${ganho.event.id}`}
                                >
                                    {ganho.event.name}
                                </Link>
                            ) : (
                                /*
                                  Apagar um evento não apaga o xp que ele
                                  deu — o que aconteceu, aconteceu — mas
                                  deixa de haver para onde apontar.
                                */
                                t.progressao.eventoApagado
                            )}
                        </span>

                        <time className="ganho-quando" dateTime={ganho.at}>
                            {new Date(ganho.at).toLocaleDateString()}
                        </time>
                    </li>
                ))}
            </ul>
        </section>
    );
};
