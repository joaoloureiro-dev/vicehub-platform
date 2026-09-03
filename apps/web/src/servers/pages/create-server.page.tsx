import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { Alert } from '../../auth/components/alert.js';
import { Field } from '../../auth/components/field.js';
import { createServer } from '../server.api.js';
import { useT } from '../../i18n/i18n.js';

export const CreateServerPage = () => {
    const navigate = useNavigate();
    const t = useT();

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
                    ? t.servidores.nomeOcupado
                    : falha instanceof ApiError
                      ? falha.message
                      : t.servidores.naoFoiPossivelRegistar,
            );
            setAEnviar(false);
        }
    };

    return (
        <div className="card">
            <header>
                <h1>{t.servidores.registarTitulo}</h1>
                <p>{t.servidores.registarSub}</p>
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
                    id="regiao"
                    label={t.servidores.regiao}
                    type="text"
                    value={regiao}
                    onChange={setRegiao}
                    required={false}
                    hint={t.servidores.regiaoAjuda}
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
                    disabled={aEnviar || nomeCurto || !nome}
                >
                    {aEnviar ? t.comum.aGuardar : t.servidores.registarBotao}
                </button>
            </form>

            <div className="foot">
                <Link to="/servidores">{t.crews.voltarDiretorio}</Link>
            </div>
        </div>
    );
};
