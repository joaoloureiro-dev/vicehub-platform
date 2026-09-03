import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alert } from '../components/alert.js';
import { Field } from '../components/field.js';
import { requestPasswordReset } from '../auth.api.js';
import { useT } from '../../i18n/i18n.js';

/**
 * Pedir o link de recuperação.
 *
 * **O ecrã não pode dizer se a conta existe.** O servidor responde
 * sempre igual, de propósito; se a interface distinguisse os dois casos,
 * desfazia num segundo o trabalho todo — bastava experimentar endereços
 * e ler o que aparece.
 *
 * Por isso a confirmação é sempre a mesma, e aparece mesmo quando o
 * pedido falha por outra razão qualquer.
 */
export const RequestResetPage = () => {
    const t = useT();
    const [email, setEmail] = useState('');
    const [enviado, setEnviado] = useState(false);
    const [aEnviar, setAEnviar] = useState(false);

    const submeter = async (event: FormEvent) => {
        event.preventDefault();
        setAEnviar(true);

        try {
            await requestPasswordReset(email);
        } catch {
            /*
             * Engolido de propósito. Um erro visível aqui seria um canal
             * a dizer alguma coisa sobre a conta.
             */
        } finally {
            setEnviado(true);
            setAEnviar(false);
        }
    };

    if (enviado) {
        return (
            <div className="card">
                <header>
                    <h1>{t.auth.verificaEmail}</h1>
                </header>
                <Alert kind="good">{t.auth.seExistir}</Alert>
                <div className="foot">
                    <Link to="/entrar">{t.auth.voltarAoLogin}</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <header>
                <h1>{t.auth.recuperarTitulo}</h1>
                <p>{t.auth.recuperarSub}</p>
            </header>

            <form onSubmit={submeter}>
                <Field
                    id="email"
                    label={t.auth.email}
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                />
                <button className="primary" type="submit" disabled={aEnviar}>
                    {aEnviar ? t.auth.aEnviar : t.auth.enviarLink}
                </button>
            </form>

            <div className="foot">
                <Link to="/entrar">{t.auth.jaMeLembro}</Link>
            </div>
        </div>
    );
};
