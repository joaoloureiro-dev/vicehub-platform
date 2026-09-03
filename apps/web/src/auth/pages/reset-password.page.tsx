import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { Alert } from '../components/alert.js';
import { Field } from '../components/field.js';
import { resetPassword } from '../auth.api.js';

const MINIMO_PASSWORD = 12;

/**
 * Definir a password nova, a partir do link recebido por email.
 *
 * Termina com um convite a entrar, e não com uma sessão aberta: a
 * recuperação derrubou todas as sessões da conta, incluindo qualquer uma
 * que este browser tivesse. Entrar a seguir é a prova de que a password
 * nova é mesmo a que a pessoa escolheu.
 */
export const ResetPasswordPage = ({ token }: { token: string }) => {
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [erro, setErro] = useState<string | null>(null);
    const [aEnviar, setAEnviar] = useState(false);

    const curta = password.length > 0 && password.length < MINIMO_PASSWORD;

    const submeter = async (event: FormEvent) => {
        event.preventDefault();
        setErro(null);
        setAEnviar(true);

        try {
            await resetPassword(token, password);

            void navigate('/entrar', { replace: true });
        } catch (falha) {
            setErro(
                falha instanceof ApiError &&
                    falha.code === 'INVALID_ACCOUNT_TOKEN'
                    ? 'Este link já não serve. Pede outro.'
                    : 'Não foi possível definir a password.',
            );
            setAEnviar(false);
        }
    };

    return (
        <div className="card">
            <header>
                <h1>Nova password</h1>
                <p>
                    Ao guardar, todas as sessões abertas nesta conta são
                    terminadas — incluindo a de quem não devia lá estar.
                </p>
            </header>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <form onSubmit={submeter}>
                <Field
                    id="password"
                    label="Password nova"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    invalid={curta}
                    hint={`Pelo menos ${MINIMO_PASSWORD} caracteres.`}
                />
                <button
                    className="primary"
                    type="submit"
                    disabled={aEnviar || curta}
                >
                    {aEnviar ? 'A guardar…' : 'Guardar a password'}
                </button>
            </form>

            <div className="foot">
                <Link to="/recuperar-password">Pedir outro link</Link>
            </div>
        </div>
    );
};
