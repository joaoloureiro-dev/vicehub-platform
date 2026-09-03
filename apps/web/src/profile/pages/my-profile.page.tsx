import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { Alert } from '../../auth/components/alert.js';
import { requestEmailVerification } from '../../auth/auth.api.js';
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
    isPremium: boolean,
    premiumUntil: string | null,
): string => {
    if (!isPremium) {
        return 'Sem plano';
    }

    return premiumUntil === null
        ? 'Premium vitalício'
        : `Premium até ${new Date(premiumUntil).toLocaleDateString('pt-PT')}`;
};

export const MyProfilePage = () => {
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
        return <p className="centered">A carregar…</p>;
    }

    if (!perfil.data) {
        return (
            <div className="panel">
                <Alert kind="bad">Não foi possível carregar o teu perfil.</Alert>
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
                texto: 'Perfil guardado.',
            });
            perfil.reload();
        } catch (falha) {
            setMensagem({
                onde: 'perfil',
                tipo: 'bad',
                texto:
                    falha instanceof ApiError
                        ? falha.message
                        : 'Não foi possível guardar o perfil.',
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
                texto: 'Personalização guardada.',
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
                        ? 'A personalização faz parte do plano premium.'
                        : falha instanceof ApiError
                          ? falha.message
                          : 'Não foi possível guardar a personalização.',
            });
        } finally {
            setAGuardar(false);
        }
    };

    return (
        <div className="panel wide">
            <div className="panel-head">
                <h1>O meu perfil</h1>
                <Link className="btn-secondary" to={`/u/${eu.username}`}>
                    Ver como público
                </Link>
            </div>

            <dl className="stats">
                <div>
                    <dt>Jogador</dt>
                    <dd>{eu.username}</dd>
                </div>
                <div>
                    <dt>Nível</dt>
                    <dd>{eu.level}</dd>
                </div>
                <div>
                    <dt>XP</dt>
                    <dd>{eu.xp}</dd>
                </div>
                <div>
                    <dt>Reputação</dt>
                    <dd>{eu.reputation}</dd>
                </div>
            </dl>

            <section className="grupo">
                <h2>Conta</h2>
                <dl className="rows">
                    <div>
                        <dt>Email</dt>
                        <dd>
                            {eu.email}{' '}
                            {eu.emailVerifiedAt ? (
                                <span className="pill confirmado">Confirmado</span>
                            ) : (
                                <span className="pill aguarda">Por confirmar</span>
                            )}
                        </dd>
                    </div>
                    <div>
                        <dt>Plano</dt>
                        <dd>
                            <span className={eu.isPremium ? 'pill' : undefined}>
                                {descreverPlano(eu.isPremium, eu.premiumUntil)}
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
                                            texto: 'Não foi possível enviar o email de confirmação.',
                                        });
                                    });
                            }}
                        >
                            {emailPedido
                                ? 'Email enviado'
                                : 'Enviar email de confirmação'}
                        </button>
                    </div>
                ) : null}
            </section>

            <section className="grupo">
                <h2>Apresentação</h2>

                {mensagem?.onde === 'perfil' ? (
                    <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert>
                ) : null}

                <form onSubmit={guardarPerfil}>
                    <div className="field">
                        <label htmlFor="bio">Sobre ti</label>
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
                            {500 - bio.length} caracteres disponíveis.
                        </p>
                    </div>

                    <div className="field">
                        <label htmlFor="avatar">Avatar</label>
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
                        {aGuardar ? 'A guardar…' : 'Guardar'}
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
                    <h2>Personalização</h2>
                    <span className="pill">Premium</span>
                </div>

                {eu.isPremium ? (
                    <p className="hint">
                        O teu plano está ativo. O banner e a cor aparecem no teu
                        perfil público.
                    </p>
                ) : (
                    <Alert kind="bad">
                        Estes campos fazem parte do plano premium. Podes escrevê-los,
                        mas só são guardados com um plano ativo.
                    </Alert>
                )}

                {mensagem?.onde === 'aparencia' ? (
                    <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert>
                ) : null}

                <form onSubmit={guardarAparencia}>
                    <div className="field">
                        <label htmlFor="banner">Banner</label>
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
                        <label htmlFor="cor">Cor de destaque</label>
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
                            Hexadecimal de seis dígitos, como #E93CEF.
                        </p>
                    </div>

                    <button
                        className="primary"
                        type="submit"
                        disabled={aGuardar || corMa}
                    >
                        {aGuardar ? 'A guardar…' : 'Guardar personalização'}
                    </button>
                </form>
            </section>
        </div>
    );
};
