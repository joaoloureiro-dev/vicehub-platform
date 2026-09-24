import type { AlvoDeDenuncia } from '@vicehub/database';

/** Quem escreveu ou quem denunciou, como aparece a quem modera. */
export interface AutorView {
    id: string;
    username: string;
    avatarUrl: string | null;
}

/**
 * O que um moderador vê de uma denúncia, na fila.
 *
 * O alvo é **uniformizado de propósito**: a fila mostra perguntas,
 * respostas e anúncios lado a lado, e três formatos diferentes
 * obrigavam o ecrã a decidir qual é qual só para mostrar a mesma coisa.
 */
export interface DenunciaView {
    id: string;
    reason: string;
    /** O que quem denunciou escreveu, quando escreveu. */
    note: string | null;
    status: string;
    createdAt: Date;
    handledAt: Date | null;
    /** Nulo quando a conta de quem denunciou já saiu. */
    reporter: AutorView | null;
    target: {
        kind: AlvoDeDenuncia;
        /**
         * O que se abre para ver o caso completo.
         *
         * Para uma pergunta e para uma resposta é **o tópico** — é lá
         * que a conversa se lê inteira. Para um anúncio é o anúncio.
         * Um campo e não três: quem mostra isto constrói o endereço a
         * partir do `kind`, e não a partir de adivinhar qual dos três
         * identificadores vinha preenchido.
         */
        openId: string;
        /** O título, quando o alvo tem um. */
        title: string | null;
        body: string | null;
        author: AutorView | null;
        /** Já retirado — a denúncia ficou, o texto não. */
        isRemoved: boolean;
    };
}
