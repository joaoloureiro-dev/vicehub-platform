import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { requestEmailVerification } from '../../auth/auth.api.js';
import { useIdioma, useT } from '../../i18n/i18n.js';
import {
    getMyProfile,
    updateMyAppearance,
    updateMyProfile,
} from '../profile.api.js';

const COR_VALIDA = /^#[0-9A-Fa-f]{6}$/;

/**
 * Como se diz, a quem tem, o que tem.
 *
 * Um plano sem data de fim é vitalício. A ausência de data é o que
 * distingue os dois casos — e é por isso que ela não é tratada aqui como
 * dado em falta.
 */
const descreverPlano = (
    t: ReturnType<typeof useT>,
    isPremium: boolean,
    premiumUntil: string | null,
    comoData: (iso: string) => string,
): string => {
    if (!isPremium) {
        return t.perfil.semPlano;
    }

    return premiumUntil === null
        ? t.perfil.premiumVitalicio
        : t.perfil.premiumAte(comoData(premiumUntil));
};

export const MyProfilePage = () => {
    const t = useT();
    const { idioma } = useIdioma();
    const perfil = useAsync(() => getMyProfile(), []);

    const [bio, setBio] = useState('');
    const [avatar, setAvatar] = useState('');
    const [banner, setBanner] = useState('');
    const [cor, setCor] = useState('');

    /**
     * A mensagem sabe de que formulário veio.
     *
     * Sem isso, o aviso aparecia no topo do painel enquanto quem
     * carregou no botão estava lá em baixo — uma resposta que ninguém
     * vê é o mesmo que não responder.
     */
    const [mensagem, setMensagem] = useState<{
        onde: 'perfil' | 'aparencia';
        tipo: 'good' | 'bad';
        texto: string;
    } | null>(null);

    const [aGuardar, setAGuardar] = useState(false);
    const [emailPedido, setEmailPedido] = useState(false);

    /**
     * Os campos são preenchidos quando o perfil chega, e não a cada
     * render: escrever por cima do que a pessoa já está a escrever seria
     * a pior forma de sincronizar.
     */
    useEffect(() => {
        if (!perfil.data) {
            return;
        }

        setBio(perfil.data.bio ?? '');
        setAvatar(perfil.data.avatarUrl ?? '');
        setBanner(perfil.data.appearance.bannerUrl ?? '');
        setCor(perfil.data.appearance.accentColor ?? '');
    }, [perfil.data]);

    if (perfil.loading && !perfil.data) {
        return <p className="centered">{t.comum.aCarregar}</p>;
    }

    if (!perfil.data) {
        return (
            <div className="panel">
                <Alert kind="bad">{t.perfil.naoCarregou}</Alert>
            </div>
        );
    }

    const eu = perfil.data;
    const corMa = cor.length > 0 && !COR_VALIDA.test(cor);

    const guardarPerfil = async (event: FormEvent) => {
        event.preventDefault();
        setMensagem(null);
        setAGuardar(true);

        try {
            await updateMyProfile({
                bio: bio.trim() || null,
                avatarUrl: avatar.trim() || null,
            });

            setMensagem({
                onde: 'perfil',
                tipo: 'good',
                texto: t.perfil.perfilGuardado,
            });
            perfil.reload();
        } catch (falha) {
            setMensagem({
                onde: 'perfil',
                tipo: 'bad',
                texto:
                    falha instanceof ApiError
                        ? falha.message
                        : t.perfil.naoFoiPossivelPerfil,
            });
        } finally {
            setAGuardar(false);
        }
    };

    const guardarAparencia = async (event: FormEvent) => {
        event.preventDefault();
        setMensagem(null);
        setAGuardar(true);

        try {
            await updateMyAppearance({
                bannerUrl: banner.trim() || null,
                accentColor: cor.trim() || null,
            });

            setMensagem({
                onde: 'aparencia',
                tipo: 'good',
                texto: t.perfil.personalizacaoGuardada,
            });
            perfil.reload();
        } catch (falha) {
            /**
             * 402 não é avaria: é a API a dizer que isto é do plano.
             * Distingui-lo dá uma mensagem útil em vez de um erro
             * genérico que ninguém sabe o que fazer com ele.
             */
            setMensagem({
                onde: 'aparencia',
                tipo: 'bad',
                texto:
                    falha instanceof ApiError && falha.status === 402
                        ? t.perfil.ehPremium
                        : falha instanceof ApiError
                          ? falha.message
                          : t.perfil.naoFoiPossivelPersonalizacao,
            });
        } finally {
            setAGuardar(false);
        }
    };

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>{t.perfil.titulo}</h1>
                <Link className="btn-secondary" to={`/u/${eu.username}`}>
                    {t.perfil.verPublico}
                </Link>
            </div>

            <dl className="stats">
                <div>
                    <dt>{t.perfil.jogador}</dt>
                    <dd>{eu.username}</dd>
                </div>
                <div>
                    <dt>{t.perfil.nivel}</dt>
                    <dd>{eu.level}</dd>
                </div>
                <div>
                    <dt>{t.crews.xp}</dt>
                    <dd>{eu.xp}</dd>
                </div>
                <div>
                    <dt>{t.perfil.reputacao}</dt>
                    <dd>{eu.reputation}</dd>
                </div>
            </dl>

            <section className="grupo">
                <h2>{t.perfil.conta}</h2>
                <dl className="rows">
                    <div>
                        <dt>{t.auth.email}</dt>
                        <dd>
                            {eu.email}{' '}
                            {eu.emailVerifiedAt ? (
                                <span className="pill confirmado">{t.perfil.confirmado}</span>
                            ) : (
                                <span className="pill aguarda">{t.perfil.porConfirmar}</span>
                            )}
                        </dd>
                    </div>
                    <div>
                        <dt>{t.perfil.plano}</dt>
                        <dd>
                            <span className={eu.isPremium ? 'pill' : undefined}>
                                {descreverPlano(t, eu.isPremium, eu.premiumUntil, (iso) =>
                                    new Date(iso).toLocaleDateString(idioma),
                                )}
                            </span>
                        </dd>
                    </div>
                </dl>

                {!eu.emailVerifiedAt ? (
                    <div className="actions">
                        <button
                            className="btn-secondary"
                            type="button"
                            disabled={emailPedido}
                            onClick={() => {
                                void requestEmailVerification()
                                    .then(() => {
                                        setEmailPedido(true);
                                    })
                                    .catch(() => {
                                        setMensagem({
                                            onde: 'perfil',
                                            tipo: 'bad',
                                            texto: t.perfil.naoFoiPossivelEmail,
                                        });
                                    });
                            }}
                        >
                            {emailPedido
                                ? t.perfil.emailEnviado
                                : t.perfil.enviarConfirmacao}
                        </button>
                    </div>
                ) : null}
            </section>

            <section className="grupo">
                <h2>{t.perfil.apresentacao}</h2>

                {mensagem?.onde === 'perfil' ? (
                    <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert>
                ) : null}

                <form onSubmit={guardarPerfil}>
                    <div className="field">
                        <label htmlFor="bio">{t.perfil.sobreTi}</label>
                        <textarea
                            id="bio"
                            rows={4}
                            maxLength={500}
                            value={bio}
                            aria-describedby="bio-hint"
                            onChange={(event) => {
                                setBio(event.target.value);
                            }}
                        />
                        <p className="hint" id="bio-hint">
                            {t.crews.caracteresDisponiveis(500 - bio.length)}
                        </p>
                    </div>

                    <div className="field">
                        <label htmlFor="avatar">{t.perfil.avatar}</label>
                        <input
                            id="avatar"
                            type="url"
                            value={avatar}
                            placeholder="https://…"
                            onChange={(event) => {
                                setAvatar(event.target.value);
                            }}
                        />
                    </div>

                    <button className="primary" type="submit" disabled={aGuardar}>
                        {aGuardar ? t.comum.aGuardar : t.comum.guardar}
                    </button>
                </form>
            </section>

            {/*
              A personalização aparece a toda a gente, e não só a quem tem
              plano. Escondê-la faria com que quem recebesse o premium não
              soubesse que ganhou alguma coisa — e quem não o tem não faz
              ideia do que está a perder.
            */}
            <section className={`grupo premium${eu.isPremium ? ' ativo' : ''}`}>
                <div className="premium-head">
                    <h2>{t.perfil.personalizacao}</h2>
                    <span className="pill">{t.perfil.premium}</span>
                </div>

                {eu.isPremium ? (
                    <p className="hint">{t.perfil.planoAtivo}</p>
                ) : (
                    <>
                        <Alert kind="bad">{t.perfil.precisaDePlano}</Alert>
                        {/*
                          Dizer o que falta sem dizer onde se arranja é
                          meia informação: era aqui que a pessoa ficava a
                          saber que lhe falta alguma coisa, e sem caminho
                          nenhum para a ter.
                        */}
                        <Link className="link-premium" to="/premium">
                            {t.perfil.verPremium}
                        </Link>
                    </>
                )}

                {mensagem?.onde === 'aparencia' ? (
                    <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert>
                ) : null}

                <form onSubmit={guardarAparencia}>
                    <div className="field">
                        <label htmlFor="banner">{t.perfil.banner}</label>
                        <input
                            id="banner"
                            type="url"
                            value={banner}
                            placeholder="https://…"
                            onChange={(event) => {
                                setBanner(event.target.value);
                            }}
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="cor">{t.perfil.cor}</label>
                        <div className="cor-linha">
                            <input
                                id="cor"
                                type="text"
                                value={cor}
                                placeholder="#E93CEF"
                                aria-invalid={corMa}
                                aria-describedby="cor-hint"
                                onChange={(event) => {
                                    setCor(event.target.value);
                                }}
                            />
                            <span
                                className="amostra"
                                aria-hidden="true"
                                style={
                                    COR_VALIDA.test(cor)
                                        ? { background: cor }
                                        : undefined
                                }
                            />
                        </div>
                        <p className="hint" id="cor-hint">
                            {t.perfil.corAjuda}
                        </p>
                    </div>

                    <button
                        className="primary"
                        type="submit"
                        disabled={aGuardar || corMa}
                    >
                        {aGuardar ? t.comum.aGuardar : t.perfil.guardarPersonalizacao}
                    </button>
                </form>
            </section>
        </div>
    );
};
