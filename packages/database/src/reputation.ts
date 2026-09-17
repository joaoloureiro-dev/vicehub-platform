import { EventParticipantStatus } from '@prisma/client';

/**
 * O que uma presença confirmada acrescenta à reputação de quem apareceu.
 *
 * Um por evento, e não um número maior: a reputação conta vezes, não
 * pontos. Quem apareceu a dez eventos tem dez, e isso lê-se sem precisar
 * de saber quanto vale cada um.
 */
export const REPUTACAO_POR_PRESENCA = 1;

/**
 * O que custa faltar depois de ter dito que ia.
 *
 * Tira exatamente o que uma presença dá. Não é indulgência: é o que faz
 * o número significar alguma coisa. Uma falta que custasse menos do que
 * aparecer dava faria a reputação subir a quem se inscreve em tudo e
 * aparece em metade, e é precisamente essa pessoa que ela existe para
 * distinguir de quem aparece sempre.
 */
export const REPUTACAO_POR_FALTA = -1;

/**
 * Quanto é que este desfecho vale à reputação de quem participou.
 *
 * Só dois estados mexem no número, e a escolha de quais é toda a regra:
 *
 * - `confirmed` — quem organiza afirma que a pessoa apareceu. É o único
 *   facto que a plataforma tem sobre comparecer, e é por isso que a
 *   reputação sai daqui e não da inscrição.
 * - `no_show` — disse que ia e não foi. Custa.
 *
 * Os outros dois não mexem, e é deliberado. `signed_up` num evento
 * concluído é alguém sobre quem ninguém se pronunciou: quem organiza não
 * confirmou nem marcou falta, e castigar por isso seria castigar pelo
 * silêncio de outra pessoa. `withdrawn` é quem desistiu antes — avisar
 * que já não vai é o comportamento que se quer, e não pode custar o
 * mesmo que desaparecer sem dizer nada.
 */
export const reputacaoDe = (status: EventParticipantStatus): number => {
    if (status === EventParticipantStatus.confirmed) {
        return REPUTACAO_POR_PRESENCA;
    }

    if (status === EventParticipantStatus.no_show) {
        return REPUTACAO_POR_FALTA;
    }

    return 0;
};
