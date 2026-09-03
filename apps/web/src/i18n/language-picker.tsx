import { IDIOMAS, type Idioma } from './locales.js';
import { useIdioma, useT } from './i18n.js';

/**
 * O seletor de idioma.
 *
 * Cada opção diz o seu nome **no seu próprio idioma** — quem procura
 * português procura "Português", e não "Portuguese" numa lista que ainda
 * não sabe ler.
 */
export const LanguagePicker = () => {
    const { idioma, mudarIdioma } = useIdioma();
    const t = useT();

    return (
        <label className="idioma">
            <span className="sr-only">{t.comum.idioma}</span>
            <select
                value={idioma}
                aria-label={t.comum.idioma}
                onChange={(event) => {
                    mudarIdioma(event.target.value as Idioma);
                }}
            >
                {IDIOMAS.map((opcao) => (
                    <option key={opcao.codigo} value={opcao.codigo}>
                        {opcao.nome}
                    </option>
                ))}
            </select>
        </label>
    );
};
