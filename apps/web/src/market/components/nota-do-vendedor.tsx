import { useT } from '../../i18n/i18n.js';

/**
 * A nota de quem vende, ao lado do nome.
 *
 * Existe porque a média estava no perfil e a decisão toma-se no
 * anúncio: quem percorre um mercado não vai a trinta perfis para saber
 * a quem está a comprar. É o mesmo defeito de sempre — o dado existia e
 * não estava onde serve.
 *
 * Sem avaliações não se mostra nada. Um "0" ou um "sem nota" a seguir
 * ao nome de quem está a começar é pior do que o silêncio: parece uma
 * nota má, e não é nota nenhuma.
 *
 * **Ausente conta como nenhuma.** A API manda `null` quando não há
 * avaliações, mas uma resposta mais velha — ou um duplo de teste
 * escrito antes deste campo existir — manda o campo por preencher, e
 * `undefined === null` é falso. Sem esta guarda, o ecrã inteiro
 * rebentava por causa de um adorno ao lado de um nome.
 */
export const NotaDoVendedor = ({
    nota,
}: {
    nota: { average: number; count: number } | null | undefined;
}) => {
    const t = useT();

    if (nota === null || nota === undefined) {
        return null;
    }

    return (
        <span className="nota-do-vendedor" title={t.mercado.media(nota.average, nota.count)}>
            <span aria-hidden="true">★ {nota.average}</span>
            <span className="visually-hidden">
                {t.mercado.media(nota.average, nota.count)}
            </span>
            <span className="quantas" aria-hidden="true">
                ({nota.count})
            </span>
        </span>
    );
};
