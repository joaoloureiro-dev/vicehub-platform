import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { Alert } from '../components/alert.js';
import { Field } from '../components/field.js';
import { login } from '../auth.api.js';
import { useT } from '../../i18n/i18n.js';

export const LoginPage = () => {
    const navigate = useNavigate();
    const t = useT();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [erro, setErro] = useState<string | null>(null);
    const [aEnviar, setAEnviar] = useState(false);

    const submeter = async (event: FormEvent) => {
        event.preventDefault();
        setErro(null);
        setAEnviar(true);

        try {
            await login(email, password);

            void navigate('/', { replace: true });
        } catch (falha) {
            /**
             * A conta bloqueada é o único caso que merece explicação
             * própria: quem levou com o bloqueio precisa de saber que
             * não é a password que está errada, é o tempo que falta.
             */
            setErro(
                falha instanceof ApiError && falha.code === 'ACCOUNT_LOCKED'
                    ? t.auth.contaBloqueada
                    : t.auth.credenciaisErradas,
            );
            setAEnviar(false);
        }
    };

    return (
        <div className="card">
            <header>
                <h1>{t.auth.entrarTitulo}</h1>
                <p>{t.auth.entrarSub}</p>
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
                    id="password"
                    label={t.auth.password}
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                />
                <button className="primary" type="submit" disabled={aEnviar}>
                    {aEnviar ? t.auth.aEntrar : t.auth.entrarTitulo}
                </button>
            </form>

            <div className="foot">
                <Link to="/recuperar-password">{t.auth.esqueciPassword}</Link>
                <span className="sep">·</span>
                <Link to="/registo">{t.auth.criarConta}</Link>
            </div>
        </div>
    );
};
