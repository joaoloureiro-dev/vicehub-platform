import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { Alert } from '../../auth/components/alert.js';
import { Field } from '../../auth/components/field.js';
import { createCrew } from '../crew.api.js';

/**
 * As mesmas regras que a API aplica, ditas antes de o pedido sair.
 *
 * A validação a sério é a do servidor; isto existe para não obrigar
 * ninguém a descobrir a regra à terceira tentativa.
 */
const TAG_VALIDA = /^[A-Za-z0-9]+$/;

export const CreateCrewPage = () => {
    const navigate = useNavigate();

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
                setErro('Já existe uma crew com este nome.');
            } else if (falha instanceof ApiError && falha.code === 'CREW_TAG_TAKEN') {
                setErro('Esta tag já está ocupada. Escolhe outra.');
            } else {
                setErro(
                    falha instanceof ApiError
                        ? falha.message
                        : 'Não foi possível criar a crew.',
                );
            }

            setAEnviar(false);
        }
    };

    return (
        <div className="card">
            <header>
                <h1>Criar crew</h1>
                <p>Ficas líder, e podes convidar quem quiseres a seguir.</p>
            </header>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <form onSubmit={submeter}>
                <Field
                    id="nome"
                    label="Nome"
                    type="text"
                    value={nome}
                    onChange={setNome}
                    invalid={nomeCurto}
                    hint="Entre 3 e 48 caracteres."
                />
                <Field
                    id="tag"
                    label="Tag"
                    type="text"
                    value={tag}
                    onChange={setTag}
                    invalid={tagMa}
                    hint="Entre 2 e 8 letras ou números. Aparece ao lado do nome, assim: [VICE]."
                />

                <div className="field">
                    <label htmlFor="descricao">Descrição</label>
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
                        Opcional. {500 - descricao.length} caracteres disponíveis.
                    </p>
                </div>

                <button
                    className="primary"
                    type="submit"
                    disabled={aEnviar || nomeCurto || tagMa || !nome || !tag}
                >
                    {aEnviar ? 'A criar…' : 'Criar a crew'}
                </button>
            </form>

            <div className="foot">
                <Link to="/crews">Voltar ao diretório</Link>
            </div>
        </div>
    );
};
