import { useT } from '../i18n/i18n.js';

interface ProgressoDeNivelProps {
    nivel: number;

    /** Os três vêm da API como texto: são BigInt do outro lado. */
    xp: string;

    /** O xp com que se entrou neste nível. */
    xpDoNivel: string;

    /** O que o seguinte exige, ou null no topo. */
    xpDoNivelSeguinte: string | null;
}

/**
 * Onde se está dentro do nível.
 *
 * Nenhuma conta de jogo acontece aqui: a API manda o chão do nível
 * atual e o teto do seguinte, e isto só divide um pelo outro. A curva
 * vive num sítio só, e não é neste — dois sítios a calcular níveis
 * seriam dois níveis diferentes no dia em que a curva mudasse.
 */
export const ProgressoDeNivel = ({
    nivel,
    xp,
    xpDoNivel,
    xpDoNivelSeguinte,
}: ProgressoDeNivelProps) => {
    const t = useT();

    /**
     * Sem os números não há barra, e não há ecrã partido.
     *
     * Uma API mais antiga do que esta página não manda estes campos, e
     * uma página inteira que rebenta por causa de uma barra de
     * progresso é uma troca má.
     */
    if (typeof xp !== 'string' || typeof xpDoNivel !== 'string') {
        return null;
    }

    const atual = BigInt(xp);
    const chao = BigInt(xpDoNivel);

    if (xpDoNivelSeguinte === null || xpDoNivelSeguinte === undefined) {
        return (
            <div className="progresso">
                <p className="hint">{t.progressao.noTopo(nivel)}</p>
            </div>
        );
    }

    const teto = BigInt(xpDoNivelSeguinte);

    const feito = atual - chao;
    const total = teto - chao;

    /**
     * A percentagem é feita com Number depois da subtração, e não antes.
     * O xp é BigInt porque pode ser enorme; a diferença entre dois
     * níveis nunca é, e é essa que aqui se divide.
     */
    const fracao = total <= 0n ? 1 : Number(feito) / Number(total);
    const porCento = Math.max(0, Math.min(100, Math.round(fracao * 100)));

    const emFalta = (teto - atual).toString();

    return (
        <div className="progresso">
            <div className="progresso-topo">
                <span>{t.progressao.nivelAtual(nivel)}</span>
                <span className="progresso-falta">
                    {t.progressao.faltam(emFalta, nivel + 1)}
                </span>
            </div>

            {/*
              A barra é um progress e não uma div pintada: quem usa
              leitor de ecrã ouve a percentagem em vez de ouvir nada.
            */}
            <progress
                className="barra"
                value={porCento}
                max={100}
                aria-label={t.progressao.nivelAtual(nivel)}
            >
                {porCento}%
            </progress>
        </div>
    );
};
