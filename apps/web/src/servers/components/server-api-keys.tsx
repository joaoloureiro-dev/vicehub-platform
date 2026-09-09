import { useState, type FormEvent } from 'react';

import { Alert } from '../../auth/components/alert.js';
import { ApiError } from '../../lib/api.js';
import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import {
    createServerApiKey,
    listServerApiKeys,
    revokeServerApiKey,
} from '../server.api.js';

interface ServerApiKeysProps {
    serverId: string;
}

/**
 * As chaves que deixam o servidor de FiveM falar com a plataforma.
 *
 * A chave inteira aparece **uma vez**, logo a seguir a ser criada, e
 * nunca mais: o que fica gravado é o resumo dela. É por isso que este
 * ecrã a mostra em destaque com um aviso, em vez de a deixar perdida
 * numa linha de uma lista — quem fechar a página sem a copiar tem de
 * gerar outra.
 */
export const ServerApiKeys = ({ serverId }: ServerApiKeysProps) => {
    const t = useT();

    const chaves = useAsync(() => listServerApiKeys(serverId), [serverId]);

    const [label, setLabel] = useState('');
    const [acabada, setAcabada] = useState<string | null>(null);
    const [aAgir, setAAgir] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const criar = async (event: FormEvent) => {
        event.preventDefault();
        setErro(null);
        setAAgir(true);

        try {
            const criada = await createServerApiKey(serverId, label.trim());

            setAcabada(criada.key);
            setLabel('');
            chaves.reload();
        } catch (falha) {
            setErro(
                falha instanceof ApiError ? falha.message : t.comum.naoFoiPossivel,
            );
        } finally {
            setAAgir(false);
        }
    };

    const revogar = async (apiKeyId: string) => {
        setErro(null);
        setAAgir(true);

        try {
            await revokeServerApiKey(serverId, apiKeyId);

            chaves.reload();
        } catch (falha) {
            setErro(
                falha instanceof ApiError ? falha.message : t.comum.naoFoiPossivel,
            );
        } finally {
            setAAgir(false);
        }
    };

    return (
        <section className="grupo">
            <h2>{t.chaves.titulo}</h2>
            <p className="hint">
                {t.chaves.paraQueServem}{' '}
                <a
                    className="link-premium"
                    href="https://github.com/joaoloureiro-dev/vicehub-platform/tree/main/resources/vicehub"
                    target="_blank"
                    rel="noreferrer"
                >
                    {t.chaves.comoInstalar}
                </a>
            </p>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            {/*
              A única vez que a chave existe fora da base de dados. Sai
              num bloco próprio e com o aviso à frente, porque quem
              fechar isto sem a copiar tem de gerar outra.
            */}
            {acabada ? (
                <div className="chave-nova" role="status">
                    <p>{t.chaves.copiaAgora}</p>
                    <code>{acabada}</code>
                </div>
            ) : null}

            <form onSubmit={(event) => void criar(event)}>
                <div className="field">
                    <label htmlFor="chave-label">{t.chaves.nome}</label>
                    <input
                        id="chave-label"
                        type="text"
                        maxLength={60}
                        placeholder={t.chaves.nomeExemplo}
                        value={label}
                        onChange={(event) => {
                            setLabel(event.target.value);
                        }}
                    />
                </div>

                <button
                    className="primary"
                    type="submit"
                    disabled={aAgir || label.trim().length === 0}
                >
                    {t.chaves.criar}
                </button>
            </form>

            {chaves.data && chaves.data.length > 0 ? (
                <ul className="pessoas">
                    {chaves.data.map((chave) => (
                        <li key={chave.id}>
                            <span className="nome">
                                {chave.label}{' '}
                                <code className="prefixo">{chave.prefix}</code>
                            </span>

                            <span className="cargo">
                                {chave.revokedAt
                                    ? t.chaves.revogada
                                    : chave.lastUsedAt
                                      ? t.chaves.usadaEm(
                                          new Date(
                                              chave.lastUsedAt,
                                          ).toLocaleDateString(),
                                      )
                                      : t.chaves.nuncaUsada}
                            </span>

                            {chave.revokedAt ? null : (
                                <div className="linha-acoes">
                                    <button
                                        className="btn-secondary perigo"
                                        type="button"
                                        disabled={aAgir}
                                        onClick={() => void revogar(chave.id)}
                                    >
                                        {t.chaves.revogar}
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="hint">{t.chaves.aindaNenhuma}</p>
            )}
        </section>
    );
};
