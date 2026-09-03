import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { Alert } from '../../auth/components/alert.js';
import { Field } from '../../auth/components/field.js';
import { createCrew } from '../crew.api.js';
import { useT } from '../../i18n/i18n.js';

/**
 * As mesmas regras que a API aplica, ditas antes de o pedido sair.
 *
 * A validação a sério é a do servidor; isto existe para não obrigar
 * ninguém a descobrir a regra à terceira tentativa.
 */
const TAG_VALIDA = /^[A-Za-z0-9]+$/;

export const CreateCrewPage = () => {
    const navigate = useNavigate();
    const t = useT();

    const [nome, setNome] = useState('');
    const [tag, setTag] = useState('');
    const [descricao, setDescricao] = useState('');
    const [erro, setErro] = useState<string | null>(null);
    const [aEnviar, setAEnviar] = useState(false);

    const nomeCurto = nome.length > 0 && nome.trim().length < 3;
    const tagMa =
        tag.length > 0 && (!TAG_VALIDA.test(tag) || tag.length < 2 || tag.length > 8);

    const submeter = async (event: FormEvent) => {
        event.preventDefault();
        setErro(null);
        setAEnviar(true);

        try {
            const crew = await createCrew({
                name: nome.trim(),
                tag: tag.trim(),
                description: descricao.trim() || null,
            });

            void navigate(`/crews/${crew.id}`, { replace: true });
        } catch (falha) {
            if (falha instanceof ApiError && falha.code === 'CREW_NAME_TAKEN') {
                setErro(t.crews.nomeOcupado);
            } else if (falha instanceof ApiError && falha.code === 'CREW_TAG_TAKEN') {
                setErro(t.crews.tagOcupada);
            } else {
                setErro(
                    falha instanceof ApiError
                        ? falha.message
                        : t.crews.naoFoiPossivelCriar,
                );
            }

            setAEnviar(false);
        }
    };

    return (
        <div className="card">
            <header>
                <h1>{t.crews.criarTitulo}</h1>
                <p>{t.crews.criarSub}</p>
            </header>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <form onSubmit={submeter}>
                <Field
                    id="nome"
                    label={t.crews.nome}
                    type="text"
                    value={nome}
                    onChange={setNome}
                    invalid={nomeCurto}
                    hint={t.crews.nomeAjuda}
                />
                <Field
                    id="tag"
                    label={t.crews.tag}
                    type="text"
                    value={tag}
                    onChange={setTag}
                    invalid={tagMa}
                    hint={t.crews.tagAjuda}
                />

                <div className="field">
                    <label htmlFor="descricao">{t.crews.descricao}</label>
                    <textarea
                        id="descricao"
                        name="descricao"
                        rows={4}
                        maxLength={500}
                        value={descricao}
                        aria-describedby="descricao-hint"
                        onChange={(event) => {
                            setDescricao(event.target.value);
                        }}
                    />
                    <p className="hint" id="descricao-hint">
                        {t.crews.caracteresDisponiveis(500 - descricao.length)}
                    </p>
                </div>

                <button
                    className="primary"
                    type="submit"
                    disabled={aEnviar || nomeCurto || tagMa || !nome || !tag}
                >
                    {aEnviar ? t.auth.aCriar : t.crews.criarBotao}
                </button>
            </form>

            <div className="foot">
                <Link to="/crews">{t.crews.voltarDiretorio}</Link>
            </div>
        </div>
    );
};
