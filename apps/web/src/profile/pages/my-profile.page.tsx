import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { AppearanceForm } from '../../appearance/appearance-form.js';
import { requestEmailVerification } from '../../auth/auth.api.js';
import { useIdioma, useT } from '../../i18n/i18n.js';
import { ProgressoDeNivel } from '../../components/progresso-de-nivel.js';
import { LevarDados } from '../components/levar-dados.js';
import { ListaDeAmigos } from '../components/lista-de-amigos.js';
import {
    getMyProfile,
    updateMyAppearance,
    updateMyProfile,
} from '../profile.api.js';

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

            <ProgressoDeNivel
                nivel={eu.level}
                xp={eu.xp}
                xpDoNivel={eu.levelXp}
                xpDoNivelSeguinte={eu.nextLevelXp}
            />

            <ListaDeAmigos />

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
              Personalizar o perfil é grátis, e por isso esta secção não
              tem aviso nenhum, nem etiqueta de plano, nem link para
              comprar.

              Já teve as três coisas. Tirá-las é metade da alteração: um
              formulário que funciona debaixo de um aviso a dizer
              "precisas de plano" continua a dizer à pessoa que não é
              bem-vinda, mesmo quando o botão já grava.
            */}
            <section className="grupo">
                <h2>{t.perfil.personalizacao}</h2>

                <AppearanceForm
                    atual={eu.appearance}
                    prefixo="eu"
                    guardar={updateMyAppearance}
                    aoGuardar={() => {
                        perfil.reload();
                    }}
                />
            </section>

            {/*
              Levar os dados fica no fim, porque quem chega aqui está a
              pensar em sair — e a ordem em que as coisas aparecem é a
              ordem por que devem ser feitas.
            */}
            <LevarDados />
        </div>
    );
};
