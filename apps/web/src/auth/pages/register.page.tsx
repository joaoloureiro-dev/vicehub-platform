import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { Alert } from '../components/alert.js';
import { Field } from '../components/field.js';
import { register } from '../auth.api.js';

/**
 * As mesmas regras que o servidor aplica, ditas antes de o pedido sair.
 *
 * A validação a sério é a do servidor — esta existe só para não obrigar
 * ninguém a descobrir a regra à terceira tentativa.
 */
const MINIMO_PASSWORD = 12;

export const RegisterPage = () => {
    const navigate = useNavigate();

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
                setErro('Já existe uma conta com este email.');
            } else if (
                falha instanceof ApiError &&
                falha.code === 'USERNAME_ALREADY_EXISTS'
            ) {
                setErro('Este nome já está ocupado. Escolhe outro.');
            } else {
                setErro(
                    falha instanceof ApiError
                        ? falha.message
                        : 'Não foi possível criar a conta.',
                );
            }

            setAEnviar(false);
        }
    };

    return (
        <div className="card">
            <header>
                <h1>Criar conta</h1>
                <p>Leva menos de um minuto.</p>
            </header>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <form onSubmit={submeter}>
                <Field
                    id="email"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                />
                <Field
                    id="username"
                    label="Nome de jogador"
                    type="text"
                    value={username}
                    onChange={setUsername}
                    autoComplete="username"
                />
                <Field
                    id="password"
                    label="Password"
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
                    {aEnviar ? 'A criar…' : 'Criar conta'}
                </button>
            </form>

            <div className="foot">
                <span>Já tens conta?</span>
                <Link to="/entrar">Entrar</Link>
            </div>
        </div>
    );
};
