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
    /**
     * As mesmas ferramentas que os dicionários recebem.
     *
     * Saem daqui porque um ecrã também precisa delas: uma data escrita
     * num componente é a mesma data escrita numa mensagem, e ter duas
     * maneiras de a escrever acaba com uma delas presa a um idioma.
     * Foi o que aconteceu — os eventos escreviam as datas em português
     * a toda a gente, porque quem as escreveu não tinha por onde pedir
     * as regras do idioma ativo.
     */
    tools: Tools;
}

const FERRAMENTAS_POR_OMISSAO = criarTools(IDIOMA_POR_OMISSAO);

const I18nContext = createContext<Contexto>({
    t: en(FERRAMENTAS_POR_OMISSAO),
    idioma: IDIOMA_POR_OMISSAO,
    mudarIdioma: () => undefined,
    tools: FERRAMENTAS_POR_OMISSAO,
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

        return { t: DICIONARIOS[idioma](tools), idioma, mudarIdioma, tools };
    }, [idioma, mudarIdioma]);

    return <I18nContext.Provider value={valor}>{children}</I18nContext.Provider>;
};

/** As mensagens no idioma ativo. */
export const useT = (): Messages => useContext(I18nContext).t;

/** Para quem precisa de mudar o idioma, ou de saber qual é. */
export const useIdioma = (): { idioma: Idioma; mudarIdioma: (idioma: Idioma) => void } => {
    const { idioma, mudarIdioma } = useContext(I18nContext);

    return { idioma, mudarIdioma };
};

/**
 * As ferramentas do idioma ativo: as datas e o plural.
 *
 * Existe para que um ecrã escreva uma data da mesma maneira que uma
 * mensagem a escreve. Sem isto, cada componente chamava
 * `toLocaleString` à sua maneira — e três maneiras deram três
 * resultados: um com segundos numa conversa, um preso a `pt-PT`, e o
 * certo.
 */
export const useTools = (): Tools => useContext(I18nContext).tools;
