import { useIdioma, useT } from '../i18n/i18n.js';

export interface Conquista {
    slug: string;
    earnedAt: string;
}

/**
 * As conquistas de um perfil.
 *
 * Sem nenhuma, não aparece nada — nem título, nem caixa vazia a dizer
 * "ainda sem conquistas". Um perfil acabado de criar já é suficientemente
 * vazio sem lhe apontarmos o dedo.
 *
 * O nome de cada uma vem do dicionário pelo `slug`. Um slug que o
 * dicionário não conheça mostra-se como está, em vez de desaparecer: uma
 * conquista que o servidor deu e o ecrã não sabe nomear continua a ser
 * uma conquista, e escondê-la seria mentir por omissão a quem a ganhou.
 */
export const Conquistas = ({
    conquistas,
}: {
    conquistas: Conquista[] | undefined;
}) => {
    const t = useT();
    const { idioma } = useIdioma();

    /**
     * Aceita não vir nada, e não só vir vazio.
     *
     * Um perfil servido por uma versão da API anterior a isto não traz o
     * campo, e uma secção de conquistas não é razão para o ecrã inteiro
     * deixar de abrir. É a mesma defesa que a barra de nível já faz.
     */
    if (!conquistas || conquistas.length === 0) {
        return null;
    }

    return (
        <section className="grupo">
            <h2>{t.conquistas.titulo}</h2>

            <ul className="conquistas">
                {conquistas.map((conquista) => (
                    <li key={conquista.slug}>
                        <b>
                            {t.conquistas.nomes[
                                conquista.slug as keyof typeof t.conquistas.nomes
                            ] ?? conquista.slug}
                        </b>
                        <span className="desde">
                            {new Date(conquista.earnedAt).toLocaleDateString(idioma)}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
};
