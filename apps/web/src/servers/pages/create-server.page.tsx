import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { Alert } from '../../auth/components/alert.js';
import { Field } from '../../auth/components/field.js';
import { createServer } from '../server.api.js';

export const CreateServerPage = () => {
    const navigate = useNavigate();

    const [nome, setNome] = useState('');
    const [regiao, setRegiao] = useState('');
    const [descricao, setDescricao] = useState('');
    const [erro, setErro] = useState<string | null>(null);
    const [aEnviar, setAEnviar] = useState(false);

    const nomeCurto = nome.length > 0 && nome.trim().length < 3;

    const submeter = async (event: FormEvent) => {
        event.preventDefault();
        setErro(null);
        setAEnviar(true);

        try {
            const servidor = await createServer({
                name: nome.trim(),
                region: regiao.trim() || null,
                description: descricao.trim() || null,
            });

            void navigate(`/servidores/${servidor.id}`, { replace: true });
        } catch (falha) {
            setErro(
                falha instanceof ApiError && falha.code === 'SERVER_NAME_TAKEN'
                    ? 'Já existe um servidor com este nome.'
                    : falha instanceof ApiError
                      ? falha.message
                      : 'Não foi possível registar o servidor.',
            );
            setAEnviar(false);
        }
    };

    return (
        <div className="card">
            <header>
                <h1>Registar servidor</h1>
                <p>Ficas dono, e podes aceitar quem se candidatar.</p>
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
                    id="regiao"
                    label="Região"
                    type="text"
                    value={regiao}
                    onChange={setRegiao}
                    required={false}
                    hint="Opcional. Ajuda quem procura latência baixa, por exemplo Europa."
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
                    disabled={aEnviar || nomeCurto || !nome}
                >
                    {aEnviar ? 'A registar…' : 'Registar o servidor'}
                </button>
            </form>

            <div className="foot">
                <Link to="/servidores">Voltar ao diretório</Link>
            </div>
        </div>
    );
};
