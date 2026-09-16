/**
 * A forma de um documento legal.
 *
 * Os dois documentos vivem como dados, e não como JSX, por duas razões.
 * Um texto legal lê-se e revê-se inteiro — em dados cabe num ficheiro
 * que se lê de uma ponta à outra, sem marcação pelo meio. E a mesma
 * página desenha os dois, o que torna impossível que um ganhe um
 * cabeçalho ou um espaçamento que o outro não tem.
 */
export interface LegalSection {
    /** O título da secção, numerado pela própria página. */
    heading: string;
    /** Os parágrafos, pela ordem em que se leem. */
    body: readonly string[];
    /** Uma lista a seguir aos parágrafos, quando a secção enumera. */
    list?: readonly string[];
}

export interface LegalDocument {
    title: string;
    /**
     * Quando o texto mudou pela última vez, em ISO.
     *
     * A actualizar **sempre** que uma palavra destes documentos mudar.
     * Uma data parada é pior do que data nenhuma: diz a quem já leu que
     * não precisa de voltar a ler.
     */
    updatedAt: string;
    /** O que enquadra o documento, antes da primeira secção. */
    intro: readonly string[];
    sections: readonly LegalSection[];
}
