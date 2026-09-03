import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { Alert } from '../components/alert.js';
import { Field } from '../components/field.js';
import { register } from '../auth.api.js';
import { useT } from '../../i18n/i18n.js';

/**
 * As mesmas regras que o servidor aplica, ditas antes de o pedido sair.
 *
 * A validação a sério é a do servidor — esta existe só para não obrigar
 * ninguém a descobrir a regra à terceira tentativa.
 */
const MINIMO_PASSWORD = 12;

export const RegisterPage = () => {
    const navigate = useNavigate();
    const t = useT();

    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [erro, setErro] = useState<string | null>(null);
    const [aEnviar, setAEnviar] = useState(false);

    const curta = password.length > 0 && password.length < MINIMO_PASSWORD;

    const submeter = async (event: FormEvent) => {
        event.preventDefault();
        setErro(null);
        setAEnviar(true);

        try {
            await register(email, username, password);

            void navigate('/', { replace: true });
        } catch (falha) {
            if (falha instanceof ApiError && falha.code === 'EMAIL_ALREADY_EXISTS') {
                setErro(t.auth.emailOcupado);
            } else if (
                falha instanceof ApiError &&
                falha.code === 'USERNAME_ALREADY_EXISTS'
            ) {
                setErro(t.auth.nomeOcupado);
            } else {
                setErro(
                    falha instanceof ApiError
                        ? falha.message
                        : t.auth.naoFoiPossivelCriar,
                );
            }

            setAEnviar(false);
        }
    };

    return (
        <div className="card">
            <header>
                <h1>{t.auth.registoTitulo}</h1>
                <p>{t.auth.registoSub}</p>
            </header>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <form onSubmit={submeter}>
                <Field
                    id="email"
                    label={t.auth.email}
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                />
                <Field
                    id="username"
                    label={t.auth.nomeJogador}
                    type="text"
                    value={username}
                    onChange={setUsername}
                    autoComplete="username"
                />
                <Field
                    id="password"
                    label={t.auth.password}
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    invalid={curta}
                    hint={t.auth.passwordMinima(MINIMO_PASSWORD)}
                />
                <button
                    className="primary"
                    type="submit"
                    disabled={aEnviar || curta}
                >
                    {aEnviar ? t.auth.aCriar : t.auth.registoTitulo}
                </button>
            </form>

            <div className="foot">
                <span>{t.auth.jaTensConta}</span>
                <Link to="/entrar">{t.auth.entrarTitulo}</Link>
            </div>
        </div>
    );
};
