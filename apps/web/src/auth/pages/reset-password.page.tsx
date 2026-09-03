import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { Alert } from '../components/alert.js';
import { Field } from '../components/field.js';
import { resetPassword } from '../auth.api.js';
import { useT } from '../../i18n/i18n.js';

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
    const t = useT();

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
                    ? t.auth.linkNaoServe
                    : t.auth.naoFoiPossivelPassword,
            );
            setAEnviar(false);
        }
    };

    return (
        <div className="card">
            <header>
                <h1>{t.auth.novaPasswordTitulo}</h1>
                <p>{t.auth.novaPasswordSub}</p>
            </header>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <form onSubmit={submeter}>
                <Field
                    id="password"
                    label={t.auth.novaPassword}
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
                    {aEnviar ? t.comum.aGuardar : t.auth.guardarPassword}
                </button>
            </form>

            <div className="foot">
                <Link to="/recuperar-password">{t.auth.pedirOutroLink}</Link>
            </div>
        </div>
    );
};
