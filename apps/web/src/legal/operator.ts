/**
 * Quem é, legalmente, o dono disto.
 *
 * Não é código: é a identidade que a lei obriga a publicar e que só o
 * João pode preencher. Está num ficheiro só, e não espalhada pelos dois
 * documentos, porque uma morada escrita em dois sítios muda num e fica
 * desatualizada no outro.
 *
 * Fica em claro no repositório de propósito. Nada disto é segredo — é
 * precisamente a informação que tem de estar visível numa página
 * pública. Uma variável de ambiente só acrescentaria uma forma de a
 * publicar vazia.
 */
export interface LegalOperator {
    /** A firma, como está registada. Não é "ViceHub". */
    legalName: string;
    /** Sede social, incluindo país. */
    address: string;
    /** Número de identificação fiscal ou de registo comercial. */
    registration: string;
    /** Para onde se escreve sobre estes documentos e sobre dados. */
    email: string;
    /** A lei aplicável e o foro. Ex.: "Portugal". */
    jurisdiction: string;
    /** Onde ficam os servidores, ao nível do país ou da região. */
    hostingRegion: string;
}

/**
 * Por preencher, e assim deve continuar até haver entidade.
 *
 * A alternativa era eu inventar uma firma e uma morada plausíveis. Um
 * documento legal com uma identidade inventada não é um rascunho: é
 * falso, e passaria a estar publicado numa página que diz vincular quem
 * a lê.
 */
export const OPERATOR: LegalOperator = {
    legalName: '',
    address: '',
    registration: '',
    email: '',
    jurisdiction: '',
    hostingRegion: '',
};

/**
 * Se estes documentos já podem ser lidos como definitivos.
 *
 * Enquanto faltar um campo, as páginas dizem-no em cima, com todas as
 * letras. É a mesma regra que o arranque da API usa para as chaves da
 * Stripe: não fingir que está configurado o que não está.
 */
export const operatorIsComplete = (operator: LegalOperator): boolean =>
    Object.values(operator).every((valor) => valor.trim() !== '');

/**
 * O valor, ou uma marca impossível de confundir com um valor.
 *
 * Um campo vazio interpolado no meio de uma frase desaparece — a frase
 * continua a ler-se, só que a dizer menos. Marcado assim, salta.
 */
export const orPlaceholder = (valor: string, nome: string): string =>
    valor.trim() === '' ? `[${nome}]` : valor.trim();
