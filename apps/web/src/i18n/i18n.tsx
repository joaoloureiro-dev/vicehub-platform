import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import { en, type Messages } from './en.js';
import { es } from './es.js';
import { fr } from './fr.js';
import { pt } from './pt.js';
import {
    IDIOMA_POR_OMISSAO,
    idiomaDoBrowser,
    type Idioma,
} from './locales.js';
import { criarTools, type Tools } from './tools.js';

const DICIONARIOS: Record<Idioma, (p: Tools) => Messages> = { en, pt, es, fr };

const CHAVE = 'vicehub.idioma';

/**
 * O idioma escolhido, guardado neste browser.
 *
 * É uma preferência de quem está a ver, e não da conta: quem usa o
 * telemóvel em francês e o portátil em inglês tem razão nos dois. O
 * acesso é protegido porque em janelas privadas ou com o armazenamento
 * bloqueado a leitura rebenta em vez de devolver vazio.
 */
const lerGuardado = (): Idioma | null => {
    try {
        const valor = window.localStorage.getItem(CHAVE);

        return valor && valor in DICIONARIOS ? (valor as Idioma) : null;
    } catch {
        return null;
    }
};

const guardar = (idioma: Idioma): void => {
    try {
        window.localStorage.setItem(CHAVE, idioma);
    } catch {
        /* Sem armazenamento, a escolha vale para esta visita. */
    }
};

interface Contexto {
    t: Messages;
    idioma: Idioma;
    mudarIdioma: (idioma: Idioma) => void;
}

const I18nContext = createContext<Contexto>({
    t: en(criarTools(IDIOMA_POR_OMISSAO)),
    idioma: IDIOMA_POR_OMISSAO,
    mudarIdioma: () => undefined,
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
    const [idioma, setIdioma] = useState<Idioma>(
        () =>
            lerGuardado() ??
            idiomaDoBrowser(
                typeof navigator === 'undefined' ? [] : navigator.languages,
            ),
    );

    /**
     * O atributo `lang` importa mais do que parece: é o que diz ao
     * browser como separar sílabas, e aos leitores de ecrã com que
     * sotaque ler a página.
     */
    useEffect(() => {
        document.documentElement.lang = idioma;
    }, [idioma]);

    const mudarIdioma = useCallback((novo: Idioma) => {
        setIdioma(novo);
        guardar(novo);
    }, []);

    const valor = useMemo<Contexto>(() => {
        const tools = criarTools(idioma);

        return { t: DICIONARIOS[idioma](tools), idioma, mudarIdioma };
    }, [idioma, mudarIdioma]);

    return <I18nContext.Provider value={valor}>{children}</I18nContext.Provider>;
};

/** As mensagens no idioma ativo. */
export const useT = (): Messages => useContext(I18nContext).t;

/** Para quem precisa de mudar o idioma, ou de saber qual é. */
export const useIdioma = (): Omit<Contexto, 't'> => {
    const { idioma, mudarIdioma } = useContext(I18nContext);

    return { idioma, mudarIdioma };
};
