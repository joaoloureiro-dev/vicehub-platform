import type { EspecieDeAviso } from '@vicehub/database';

/** Quem causou o aviso, como aparece a quem o recebe. */
export interface AutorDoAviso {
    id: string;
    username: string;
    avatarUrl: string | null;
}

/**
 * Um aviso, como se lê na caixa.
 *
 * O alvo é uniformizado, como na fila de denúncias: quatro espécies
 * lado a lado numa lista, e quatro formatos diferentes obrigavam o ecrã
 * a decidir qual é qual só para desenhar a mesma linha.
 */
export interface AvisoView {
    id: string;
    kind: EspecieDeAviso;
    /** Nulo quando a conta de quem o causou já saiu. */
    actor: AutorDoAviso | null;
    /**
     * O que se abre. Sai da espécie: uma mensagem abre a conversa, uma
     * resposta abre o tópico, uma avaliação abre o perfil de quem a
     * recebeu.
     */
    openId: string;
    /** Uma linha do que aconteceu — o título do anúncio, da pergunta. */
    about: string | null;
    /** O princípio do texto, quando o aviso tem texto. */
    excerpt: string | null;
    isRead: boolean;
    createdAt: Date;
}
