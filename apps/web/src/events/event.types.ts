export type EventStatus = 'scheduled' | 'ongoing' | 'completed' | 'canceled';

export interface EventSummary {
    id: string;
    name: string;
    description: string | null;
    status: string;
    startsAt: string;
    endsAt: string | null;
    capacity: number | null;
    organizerId: string | null;
    /** Quantos estão inscritos ou já confirmados: os que ocupam lugar. */
    signedUpCount: number;
    /** Quantos têm presença confirmada, e portanto direito a receber. */
    confirmedCount: number;
    createdAt: string;
}

export interface EventParticipant {
    userId: string;
    username: string;
    avatarUrl: string | null;
    status: string;
    /**
     * O que torna a divisão por participação diferente de uma por igual:
     * quem lidera um assalto costuma levar mais.
     */
    weight: number;
    confirmedBy: string | null;
    confirmedAt: string | null;
    signedUpAt: string;
}

export const NOME_DO_ESTADO: Record<string, string> = {
    scheduled: 'Marcado',
    ongoing: 'A decorrer',
    completed: 'Terminado',
    canceled: 'Cancelado',
};

export const NOME_DA_PARTICIPACAO: Record<string, string> = {
    signed_up: 'Inscrito',
    confirmed: 'Presença confirmada',
    no_show: 'Não apareceu',
    withdrawn: 'Desistiu',
};

export const nomeDoEstado = (valor: string): string =>
    NOME_DO_ESTADO[valor] ?? valor;

export const nomeDaParticipacao = (valor: string): string =>
    NOME_DA_PARTICIPACAO[valor] ?? valor;

/**
 * As transições que um evento aceita, a partir de onde está.
 *
 * Escrito aqui para o ecrã não oferecer botões que a API vai recusar —
 * um evento terminado não volta a decorrer, e um cancelado não volta
 * atrás.
 */
export const TRANSICOES: Record<string, { status: EventStatus; nome: string }[]> = {
    scheduled: [
        { status: 'ongoing', nome: 'Começar' },
        { status: 'canceled', nome: 'Cancelar' },
    ],
    ongoing: [
        { status: 'completed', nome: 'Terminar' },
        { status: 'canceled', nome: 'Cancelar' },
    ],
    completed: [],
    canceled: [],
};

export const transicoesDe = (
    status: string,
): { status: EventStatus; nome: string }[] => TRANSICOES[status] ?? [];

/** Data e hora como uma pessoa as lê. */
export const quando = (iso: string): string =>
    new Date(iso).toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
