import { useT } from '../../i18n/i18n.js';
import { useAsync } from '../../lib/use-async.js';
import { getServerActivity } from '../server.api.js';
import {
    alturaDaBarra,
    tectoDaTira,
    tiraDeHoras,
    type HoraDaTira,
} from '../actividade.js';

/**
 * Quantas pessoas estiveram neste servidor, hora a hora.
 *
 * O perfil já dizia quantas estão lá **agora**, e "quarenta e duas
 * agora" não responde à pergunta de quem procura onde jogar: a pergunta
 * é se há gente lá às horas a que essa pessoa joga. Isso só se vê com
 * dois dias à frente dos olhos.
 *
 * Uma série só, por isso não leva legenda — o título diz o que é. As
 * barras são o **pico** de cada hora e não a média, porque é o pico que
 * responde à pergunta: uma hora que chegou a ter trinta pessoas teve
 * trinta pessoas, mesmo que a média da hora as dilua.
 */

/** Duas noites e dois dias: a semana toda não cabe legível num telemóvel. */
const HORAS_NA_TIRA = 48;

/** De quantos dias se tiram os números do resumo. */
const DIAS_DO_RESUMO = 7;

/**
 * Onde se escreve a hora por baixo da tira.
 *
 * De seis em seis, e não em todas: quarenta e oito etiquetas não cabem
 * em trezentos pixels, e a resposta a isso é escolher quais se mostram —
 * não encolher a letra até ninguém a ler.
 */
const DE_QUANTAS_EM_QUANTAS = 6;

/**
 * A hora como uma etiqueta de duas letras: `04`, `16`.
 *
 * Relógio de vinte e quatro horas, e não `04 AM`. Numa tira de dois
 * dias não há ambiguidade a desfazer, e o `AM` custava metade da
 * largura de cada etiqueta — a primeira versão disto escrevia `10 AM`
 * numa casa de cinco pixels, e o que aparecia no ecrã era uma coluna
 * de letras soltas.
 */
const etiquetaDaHora = (hora: Date): string =>
    hora.toLocaleTimeString(undefined, { hour: '2-digit', hour12: false });

const Barra = ({ casa, tecto }: { casa: HoraDaTira; tecto: number }) => {
    const t = useT();
    const altura = alturaDaBarra(casa, tecto);

    const horaLocal = casa.hora.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });

    /**
     * Uma hora sem dados é uma casa vazia, e não uma barra de zero: são
     * coisas diferentes, e o `title` diz qual delas é.
     */
    if (altura === null) {
        return (
            <span
                className="casa vazia"
                title={`${horaLocal} · ${t.servidores.semDados}`}
            />
        );
    }

    return (
        <span
            className="casa"
            title={`${horaLocal} · ${t.chaves.jogadoresOnline(
                casa.ponto?.peak ?? 0,
            )}`}
        >
            {/*
              * A barra encosta ao chão e cresce para cima, com o topo
              * arredondado. Altura mínima visível para "zero pessoas"
              * não desaparecer — sem ela, o servidor vazio e o servidor
              * sem dados ficavam com o mesmo desenho.
              */}
            <span
                className="barra"
                style={{ height: `max(2px, ${altura}%)` }}
            />
        </span>
    );
};

export const TiraDeActividade = ({ serverId }: { serverId: string }) => {
    const t = useT();

    const actividade = useAsync(
        () => getServerActivity(serverId, DIAS_DO_RESUMO),
        [serverId],
    );

    const dados = actividade.data;

    /**
     * Sem dados nenhuns não se desenha uma tira vazia: um gráfico de
     * quarenta e oito casas em branco parece uma avaria, e o que se
     * passa é que ninguém instalou o recurso no servidor.
     */
    if (actividade.error || (dados && dados.hours.length === 0)) {
        return null;
    }

    if (!dados) {
        return <p className="hint">{t.comum.aCarregar}</p>;
    }

    const tira = tiraDeHoras(dados.hours, HORAS_NA_TIRA);
    const tecto = tectoDaTira(tira);

    return (
        <section className="actividade">
            <h2>{t.servidores.actividadeTitulo}</h2>

            {/*
              * Os números em texto, e não só no gráfico. São a parte que
              * se lê de relance, a que um leitor de ecrã encontra, e a
              * única que sobrevive a um gráfico que não carregue.
              */}
            <p className="actividade-numeros">
                <span>
                    <strong>{dados.average}</strong>
                    {' '}
                    {t.servidores.mediaDeSete}
                </span>
                <span>
                    <strong>{dados.peak}</strong>
                    {' '}
                    {t.servidores.picoDeSete}
                </span>
            </p>

            <div
                className="tira"
                role="img"
                aria-label={t.servidores.tiraDescricao(
                    HORAS_NA_TIRA,
                    dados.average,
                    dados.peak,
                )}
            >
                {tira.map((casa) => (
                    <Barra
                        key={casa.hora.toISOString()}
                        casa={casa}
                        tecto={tecto}
                    />
                ))}
            </div>

            {/*
              * As etiquetas são posicionadas por fração da largura, e
              * não por uma casa da grelha: uma etiqueta de duas letras
              * não cabe numa casa de cinco pixels, e metida lá dentro
              * parte-se numa letra por linha. Aqui ela fica centrada na
              * sua barra e transborda para os lados, que é o que uma
              * etiqueta de eixo faz.
              */}
            <p className="tira-horas" aria-hidden="true">
                {tira.map((casa, indice) =>
                    indice % DE_QUANTAS_EM_QUANTAS === 0 ? (
                        <span
                            key={casa.hora.toISOString()}
                            style={{
                                left: `${((indice + 0.5) / tira.length) * 100}%`,
                            }}
                        >
                            {etiquetaDaHora(casa.hora)}
                        </span>
                    ) : null,
                )}
            </p>
        </section>
    );
};
