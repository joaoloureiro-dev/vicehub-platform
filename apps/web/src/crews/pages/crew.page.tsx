import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError, vazioSem403 } from '../../lib/api.js';
import { carregarCandidaturas } from '../../lib/membership.js';
import { useAsync } from '../../lib/use-async.js';
import { useAuth } from '../../auth/auth.context.js';
import { Alert } from '../../auth/components/alert.js';
import { AppearanceForm } from '../../appearance/appearance-form.js';
import { CrewAffiliation } from '../../affiliations/components/crew-affiliation.js';
import { mandaNisto } from '../../lib/manda-nisto.js';
import { ApagarComunidade } from '../../components/apagar-comunidade.js';
import { ProgressoDeNivel } from '../../components/progresso-de-nivel.js';
import { HistoricoDeXp } from '../components/historico-de-xp.js';
import { CrewSettings } from '../components/crew-settings.js';
import {
    acceptJoinRequest,
    deleteCrew,
    getCrew,
    listCrewXp,
    leaveCrew,
    listCrewMembers,
    listJoinRequests,
    listMyMemberships,
    rejectJoinRequest,
    removeMember,
    requestToJoin,
    updateCrewAppearance,
    withdrawJoinRequest,
} from '../crew.api.js';
import { useT } from '../../i18n/i18n.js';

/**
 * O perfil de uma crew.
 *
 * O que se pode fazer aqui depende de duas coisas: se pertences, e com
 * que cargo. A API é que decide de verdade — este ecrã limita-se a não
 * mostrar botões que iriam levar 403.
 *
 * **A lista de candidaturas é o teste.** Só quem gere membros a
 * consegue ler, e é a própria API que o diz com um 403. Em vez de
 * adivinhar o cargo a partir de outra coisa, o ecrã pede a lista e trata
 * o 403 como "não és tu que geres isto" — assim, a permissão mostrada é
 * sempre a permissão real.
 */
export const CrewPage = () => {
    const t = useT();
    const { crewId } = useParams<{ crewId: string }>();
    const { user } = useAuth();

    const [aAgir, setAAgir] = useState(false);
    const [erroAcao, setErroAcao] = useState<string | null>(null);

    const crew = useAsync(() => getCrew(crewId as string), [crewId]);
    const membros = useAsync(() => listCrewMembers(crewId as string), [crewId]);

    /**
     * A minha relação com esta crew: membro, candidato, ou nada. Só é
     * pedida quando há sessão — a quem não entrou, esta pergunta não se
     * aplica.
     */
    const adesoes = useAsync(
        () => (user ? listMyMemberships() : Promise.resolve([])),
        [crewId, user?.id],
    );

    const candidaturas = useAsync(
        () =>
            user
                ? carregarCandidaturas(() => listJoinRequests(crewId as string))
                : Promise.resolve(null),
        [crewId, user?.id],
    );

    /**
     * De onde veio o xp. Pelo mesmo caminho das candidaturas: pede-se, e
     * um 403 quer dizer "não pertences", não "avariou".
     */
    const ganhos = useAsync(
        () =>
            user
                ? vazioSem403(() => listCrewXp(crewId as string))
                : Promise.resolve(null),
        [crewId, user?.id],
    );

    const minhaAdesao = adesoes.data?.find((adesao) => adesao.crewId === crewId);
    const souMembro = minhaAdesao?.status === 'active';
    const souCandidato = minhaAdesao?.status === 'pending';
    const giroCandidaturas = candidaturas.data !== null;

    /**
     * Gerir membros e mandar na crew são coisas diferentes: um oficial
     * tem `crew:manage_members` e não tem `crew:manage`. As definições e
     * a filiação exigem a segunda, e mostrá-las a um oficial era
     * mostrar-lhe botões que respondem 403 ao serem carregados. O cargo
     * vem da lista de membros, que é a resposta da própria API.
     */
    const souLider = mandaNisto(membros.data, user?.id, 'crew_leader');

    const agir = async (acao: () => Promise<void>) => {
        setErroAcao(null);
        setAAgir(true);

        try {
            await acao();

            crew.reload();
            membros.reload();
            adesoes.reload();
            candidaturas.reload();
        } catch (falha) {
            setErroAcao(
                falha instanceof ApiError
                    ? falha.message
                    : t.comum.naoFoiPossivel,
            );
        } finally {
            setAAgir(false);
        }
    };

    if (crew.loading && !crew.data) {
        return <p className="centered">{t.comum.aCarregar}</p>;
    }

    if (crew.error || !crew.data) {
        return (
            <div className="panel">
                <Alert kind="bad">{t.crews.naoEncontrada}</Alert>
                <div className="foot">
                    <Link to="/crews">{t.crews.voltarDiretorio}</Link>
                </div>
            </div>
        );
    }

    const perfil = crew.data;

    return (
        <div className="panel wide">
            <header
                className="crewhead"
                style={
                    perfil.appearance.accentColor
                        ? { borderColor: perfil.appearance.accentColor }
                        : undefined
                }
            >
                {perfil.appearance.bannerUrl ? (
                    <img className="banner" src={perfil.appearance.bannerUrl} alt="" />
                ) : null}

                <div className="crewhead-body">
                    <span className="crewtag grande">[{perfil.tag}]</span>
                    <h1>{perfil.name}</h1>
                    {perfil.description ? <p>{perfil.description}</p> : null}
                </div>
            </header>

            <dl className="stats">
                <div>
                    <dt>{t.perfil.nivel}</dt>
                    <dd>{perfil.level}</dd>
                </div>
                <div>
                    <dt>{t.crews.xp}</dt>
                    <dd>{perfil.xp}</dd>
                </div>
                <div>
                    <dt>{t.crews.influencia}</dt>
                    <dd>{perfil.influence}</dd>
                </div>
                <div>
                    <dt>{t.crews.prestigio}</dt>
                    <dd>{perfil.prestige}</dd>
                </div>
                <div>
                    <dt>{t.crews.contagemMembros}</dt>
                    <dd>{perfil.memberCount}</dd>
                </div>
            </dl>

            {/*
              O nível sem o que falta para o seguinte é dizer a alguém
              onde está sem lhe dizer para onde vai.
            */}
            <ProgressoDeNivel
                nivel={perfil.level}
                xp={perfil.xp}
                xpDoNivel={perfil.levelXp}
                xpDoNivelSeguinte={perfil.nextLevelXp}
            />

            {/*
              O lugar só existe para quem já ganhou alguma coisa. Uma
              crew sem xp não está em último — não entrou ainda, e
              mostrar-lhe um lugar seria dizer-lhe que perdeu uma corrida
              em que nunca correu.
            */}
            {perfil.rank ? (
                <p className="lugar">
                    <Link to="/crews">
                        {t.crews.lugar(perfil.rank.position, perfil.rank.of)}
                    </Link>
                </p>
            ) : null}

            <p className="hint">{t.progressao.deOndeVem}</p>

            {/*
              A lista só aparece a quem pertence: diz os nomes dos
              eventos, e o calendário de uma comunidade é dela. O 403 da
              API é a resposta, e não um palpite deste ecrã.
            */}
            {ganhos.data ? (
                <HistoricoDeXp crewId={perfil.id} ganhos={ganhos.data} />
            ) : null}

            {erroAcao ? <Alert kind="bad">{erroAcao}</Alert> : null}

            {user ? (
                <div className="actions">
                    {!minhaAdesao ? (
                        <button
                            className="primary"
                            type="button"
                            disabled={aAgir}
                            onClick={() => void agir(() => requestToJoin(perfil.id))}
                        >
                            {t.crews.pedirEntrada}
                        </button>
                    ) : null}

                    {souCandidato ? (
                        <>
                            <span className="pill aguarda">{t.crews.candidaturaEnviada}</span>
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={aAgir}
                                onClick={() =>
                                    void agir(() => withdrawJoinRequest(perfil.id))
                                }
                            >
                                {t.crews.retirarCandidatura}
                            </button>
                        </>
                    ) : null}

                    {souMembro ? (
                        <>
                            <span className="pill">
                                {t.cargos[
                                    (minhaAdesao.role ??
                                        'crew_member') as keyof typeof t.cargos
                                ] ?? minhaAdesao.role}
                            </span>
                            <Link
                                className="btn-secondary"
                                to={`/crews/${perfil.id}/tesouraria`}
                            >
                                {t.crews.tesouraria}
                            </Link>
                            <Link
                                className="btn-secondary"
                                to={`/crews/${perfil.id}/eventos`}
                            >
                                {t.crews.eventos}
                            </Link>
                            <button
                                className="btn-secondary"
                                type="button"
                                disabled={aAgir}
                                onClick={() => void agir(() => leaveCrew(perfil.id))}
                            >
                                {t.crews.sair}
                            </button>
                        </>
                    ) : null}
                </div>
            ) : (
                <p className="hint">
                    <Link to="/entrar">{t.crews.entraLink}</Link>{' '}
                    {t.crews.entraParaCandidatar}
                </p>
            )}

            {giroCandidaturas && candidaturas.data && candidaturas.data.length > 0 ? (
                <section className="grupo">
                    <h2>{t.crews.candidaturasPorResponder}</h2>
                    <ul className="pessoas">
                        {candidaturas.data.map((pedido) => (
                            <li key={pedido.userId}>
                                <span className="nome">{pedido.username}</span>
                                <div className="linha-acoes">
                                    <button
                                        className="btn-secondary"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(() =>
                                                acceptJoinRequest(
                                                    perfil.id,
                                                    pedido.userId,
                                                ),
                                            )
                                        }
                                    >
                                        {t.crews.aceitar}
                                    </button>
                                    <button
                                        className="btn-secondary perigo"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(() =>
                                                rejectJoinRequest(
                                                    perfil.id,
                                                    pedido.userId,
                                                ),
                                            )
                                        }
                                    >
                                        {t.crews.recusar}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <section className="grupo">
                <h2>{t.crews.listaMembros}</h2>

                {membros.loading && !membros.data ? (
                    <p className="hint">{t.comum.aCarregar}</p>
                ) : null}

                <ul className="pessoas">
                    {membros.data?.map((membro) => (
                        <li key={membro.userId}>
                            <span className="nome">{membro.username}</span>
                            <span className="cargo">
                                {t.cargos[
                                    (membro.role ??
                                        'crew_member') as keyof typeof t.cargos
                                ] ?? membro.role}
                            </span>

                            {giroCandidaturas && membro.userId !== user?.id ? (
                                <div className="linha-acoes">
                                    <button
                                        className="btn-secondary perigo"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() =>
                                            void agir(() =>
                                                removeMember(perfil.id, membro.userId),
                                            )
                                        }
                                    >
                                        {t.crews.remover}
                                    </button>
                                </div>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </section>

            {/*
              As definições aparecem a quem gere a crew. Existiam na API
              desde o princípio sem por onde lá chegar: um nome mal
              escrito ficava mal escrito, e o nome é único, por isso nem
              criar outra crew resolvia.
            */}
            {souLider ? (
                <CrewSettings
                    crew={perfil}
                    aoGuardar={() => {
                        crew.reload();
                    }}
                />
            ) : null}

            {/*
              Onde a crew joga é público; pedir, desistir e sair é de
              quem manda nela. A ligação a um servidor não é uma
              declaração da crew: quem manda no servidor tem de a
              aceitar.
            */}
            <CrewAffiliation crewId={perfil.id} podeGerir={souLider} />

            {/*
              A personalização aparece a quem gere a crew, com plano ou
              sem ele. Escondê-la sem plano faria com que quem viesse a
              tê-lo não soubesse que ganhou alguma coisa — e quem não o
              tem não faz ideia do que está a perder.
            */}
            {souLider ? (
                <section
                    className={`grupo premium${perfil.isPremium ? ' ativo' : ''}`}
                >
                    <div className="premium-head">
                        <h2>{t.perfil.personalizacao}</h2>
                        <span className="pill">{t.perfil.premium}</span>
                    </div>

                    {perfil.isPremium ? (
                        /*
                          Dizer só "o plano está ativo" a uma crew coberta
                          pelo servidor onde joga escondia de quem paga o
                          quê — e o dia em que a crew saísse de lá, a
                          personalização desaparecia sem explicação.
                        */
                        <p className="hint">
                            {perfil.premiumVia ? (
                                <>
                                    {t.crews.planoVemDoServidor}{' '}
                                    <Link
                                        to={`/servidores/${perfil.premiumVia.id}`}
                                    >
                                        {perfil.premiumVia.name}
                                    </Link>
                                </>
                            ) : (
                                t.crews.planoAtivo
                            )}
                        </p>
                    ) : (
                        <>
                            <Alert kind="bad">{t.crews.precisaDePlano}</Alert>
                            {/*
                              O plano é **da crew**, e não de quem a gere:
                              é por isso que o link leva o identificador
                              dela. Sem ele, quem carregasse comprava para
                              si próprio e a crew continuava sem nada.
                            */}
                            <Link
                                className="link-premium"
                                to={`/premium?crew=${encodeURIComponent(perfil.id)}`}
                            >
                                {t.crews.verPremium}
                            </Link>
                        </>
                    )}

                    <AppearanceForm
                        atual={perfil.appearance}
                        prefixo="crew"
                        guardar={(input) => updateCrewAppearance(perfil.id, input)}
                        aoGuardar={() => {
                            crew.reload();
                        }}
                    />
                </section>
            ) : null}

            {/*
              Apagar fica no fim, e só para o líder. Até aqui não havia
              como desfazer um engano: os nomes são únicos, por isso
              quem criasse uma crew com o nome trocado ficava com ele
              ocupado para sempre — inclusive para si próprio.
            */}
            {souLider ? (
                <ApagarComunidade
                    tipo="crew"
                    nome={perfil.name}
                    apagar={() => deleteCrew(perfil.id)}
                />
            ) : null}
        </div>
    );
};
