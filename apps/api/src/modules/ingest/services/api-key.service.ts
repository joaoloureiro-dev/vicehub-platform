import crypto from 'node:crypto';

/**
 * O prefixo diz de que plataforma é a chave e em que ambiente vive.
 *
 * Uma chave encontrada num repositório público sem contexto nenhum é
 * uma chave que ninguém sabe revogar. Com isto à frente sabe-se de onde
 * é, e os varredores de segredos conseguem reconhecê-la.
 */
const MARCA = 'vh';

/** Quantos bytes de prefixo e de segredo. */
const BYTES_PREFIXO = 6;
const BYTES_SEGREDO = 32;

export interface ChaveGerada {
    /** O que se entrega uma única vez a quem a pediu. */
    completa: string;
    /** A parte que fica em claro, para encontrar a linha e a mostrar. */
    prefix: string;
    /** O resumo, que é o que fica gravado. */
    hash: string;
}

/**
 * Chaves de API dos servidores.
 *
 * O segredo **não** é guardado em lado nenhum: guarda-se o resumo. Quem
 * perder a chave gera outra — a alternativa era a plataforma poder ler
 * as chaves de toda a gente, e uma base de dados lida passaria a ser
 * uma base de dados que entrega os servidores todos.
 *
 * SHA-256 e não argon2, pela mesma razão dos tokens de conta: uma função
 * lenta existe para tornar cara a adivinhação de segredos fracos, e 32
 * bytes aleatórios não têm nada que se adivinhe. O que a lentidão
 * custaria era o tempo de cada pedido de um servidor que bate à porta
 * de minuto a minuto.
 */
export class ApiKeyService {
    /**
     * Gera uma chave nova.
     *
     * A forma é `vh_<prefixo>_<segredo>`: o prefixo identifica a linha
     * e o segredo é o que prova quem se é.
     */
    generate(): ChaveGerada {
        const prefix = crypto.randomBytes(BYTES_PREFIXO).toString('hex');
        const segredo = crypto.randomBytes(BYTES_SEGREDO).toString('base64url');

        return {
            completa: `${MARCA}_${prefix}_${segredo}`,
            prefix,
            hash: this.hash(segredo),
        };
    }

    /**
     * Separa uma chave apresentada nas suas duas partes.
     *
     * Devolve null para tudo o que não tenha a forma esperada, em vez de
     * deixar passar um valor meio lido para a consulta seguinte.
     */
    parse(apresentada: string): { prefix: string; segredo: string } | null {
        /**
         * Corta nos **dois primeiros** underscores, e não em todos.
         *
         * O segredo é base64url, e o alfabeto do base64url inclui `_`:
         * partir a chave por todos os separadores desfazia o segredo em
         * pedaços e recusava chaves válidas. Custou um teste a
         * descobrir.
         */
        const primeiro = apresentada.indexOf('_');
        const segundo = apresentada.indexOf('_', primeiro + 1);

        if (primeiro === -1 || segundo === -1) {
            return null;
        }

        const marca = apresentada.slice(0, primeiro);
        const prefix = apresentada.slice(primeiro + 1, segundo);
        const segredo = apresentada.slice(segundo + 1);

        if (marca !== MARCA || !prefix || !segredo) {
            return null;
        }

        return { prefix, segredo };
    }

    hash(segredo: string): string {
        return crypto.createHash('sha256').update(segredo).digest('hex');
    }

    /**
     * Compara dois resumos sem deixar o tempo dizer quanto acertaram.
     *
     * Aqui a diferença é pequena — o resumo do que foi apresentado é
     * calculado a partir de um segredo que ninguém adivinha —, mas é
     * uma comparação de segredos, e essas fazem-se assim.
     */
    matches(esperado: string, apresentado: string): boolean {
        const a = Buffer.from(esperado, 'utf8');
        const b = Buffer.from(apresentado, 'utf8');

        if (a.length !== b.length) {
            return false;
        }

        return crypto.timingSafeEqual(a, b);
    }
}
