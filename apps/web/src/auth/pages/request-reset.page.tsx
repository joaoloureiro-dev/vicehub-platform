import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alert } from '../components/alert.js';
import { Field } from '../components/field.js';
import { requestPasswordReset } from '../auth.api.js';

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
                    <h1>Verifica o teu email</h1>
                </header>
                <Alert kind="good">
                    Se existir uma conta com esse endereço, o link de
                    recuperação já vai a caminho. Serve uma vez e expira dentro
                    de uma hora.
                </Alert>
                <div className="foot">
                    <Link to="/entrar">Voltar ao início de sessão</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <header>
                <h1>Recuperar a password</h1>
                <p>
                    Diz-nos o endereço da conta e enviamos um link para definir
                    uma password nova.
                </p>
            </header>

            <form onSubmit={submeter}>
                <Field
                    id="email"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                />
                <button className="primary" type="submit" disabled={aEnviar}>
                    {aEnviar ? 'A enviar…' : 'Enviar o link'}
                </button>
            </form>

            <div className="foot">
                <Link to="/entrar">Afinal já me lembro</Link>
            </div>
        </div>
    );
};
