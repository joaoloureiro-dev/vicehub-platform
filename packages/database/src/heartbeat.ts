/**
 * Quanto tempo um servidor continua a contar como online depois do
 * último sinal.
 *
 * O recurso bate à porta a cada minuto; cinco minutos deixam
 * passar quatro falhas seguidas sem declarar em baixo um servidor que
 * apenas teve um soluço na rede. Mais do que isto e o diretório
 * mostraria servidores que já ninguém consegue encontrar.
 */
export const HEARTBEAT_JANELA_MS = 5 * 60 * 1000;

interface EstadoDoServidor {
    isOnline: boolean;
    /**
     * Ausente e nulo dizem o mesmo — "nunca reportou" —, e o ausente é
     * real: uma consulta que não peça a coluna devolve a linha sem ela.
     * Tratar os dois casos como o mesmo evita que a resposta dependa de
     * quais colunas quem pergunta se lembrou de pedir.
     */
    last_heartbeat_at?: Date | null | undefined;
}

/**
 * Se um servidor está online **agora**.
 *
 * A regra tem duas metades, e a ordem entre elas é o ponto todo:
 *
 * - um servidor que já reportou alguma vez é julgado pelo relógio, e a
 *   marca manual deixa de contar. Um servidor que fala por si não é
 *   uma coisa que se ligue à mão;
 * - um servidor que nunca instalou o recurso continua a valer o que o
 *   dono marcou, porque é a única coisa que existe sobre ele.
 *
 * Sem a primeira metade, um servidor em baixo continuava a aparecer
 * como de pé enquanto ninguém se lembrasse de desmarcar o campo — que
 * é exatamente o que o diretório fazia antes disto.
 */
export const estaOnline = (
    server: EstadoDoServidor,
    agora: Date = new Date(),
): boolean => {
    if (
        server.last_heartbeat_at === null ||
        server.last_heartbeat_at === undefined
    ) {
        return server.isOnline;
    }

    return (
        agora.getTime() - server.last_heartbeat_at.getTime() < HEARTBEAT_JANELA_MS
    );
};

/**
 * A mesma regra, escrita como filtro para a base de dados.
 *
 * Existe para que a listagem não tenha de trazer tudo para memória só
 * para decidir o que mostrar — e, sobretudo, para que as duas formas de
 * responder à mesma pergunta não possam divergir: qualquer mudança na
 * janela muda as duas ao mesmo tempo.
 */
export const filtroDeOnline = (agora: Date = new Date()) => ({
    OR: [
        { last_heartbeat_at: { gt: new Date(agora.getTime() - HEARTBEAT_JANELA_MS) } },
        { AND: [{ last_heartbeat_at: null }, { isOnline: true }] },
    ],
});
