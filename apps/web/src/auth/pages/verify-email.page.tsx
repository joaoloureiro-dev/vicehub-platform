import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { Alert } from '../components/alert.js';
import { verifyEmail } from '../auth.api.js';
import { useT } from '../../i18n/i18n.js';
import { useLinkToken } from '../use-link-token.js';

type Estado = 'a-confirmar' | 'confirmado' | 'invalido' | 'sem-token';

/**
 * Confirma o endereço assim que a página abre.
 *
 * Não há formulário: quem clicou no link do email já disse o que queria
 * dizer, e pedir-lhe que carregue outra vez num botão seria pedir-lhe
 * que confirmasse a confirmação.
 */
export const VerifyEmailPage = () => {
    const t = useT();
    const token = useLinkToken();
    const [estado, setEstado] = useState<Estado>(
        token ? 'a-confirmar' : 'sem-token',
    );

    useEffect(() => {
        if (!token) {
            return;
        }

        let ativo = true;

        verifyEmail(token)
            .then(() => {
                if (ativo) {
                    setEstado('confirmado');
                }
            })
            .catch((falha: unknown) => {
                if (!ativo) {
                    return;
                }

                /**
                 * Um email já confirmado não é um erro para quem clicou:
                 * o resultado que essa pessoa queria já está lá.
                 */
                setEstado(
                    falha instanceof ApiError &&
                        falha.code === 'EMAIL_ALREADY_VERIFIED'
                        ? 'confirmado'
                        : 'invalido',
                );
            });

        return () => {
            ativo = false;
        };
    }, [token]);

    return (
        <div className="card">
            <header>
                <h1>{t.auth.confirmarEmailTitulo}</h1>
            </header>

            {estado === 'a-confirmar' ? (
                <p className="hint">{t.auth.aConfirmar}</p>
            ) : null}

            {estado === 'confirmado' ? (
                <Alert kind="good">{t.auth.emailConfirmado}</Alert>
            ) : null}

            {estado === 'invalido' ? (
                <Alert kind="bad">{t.auth.linkNaoServe}</Alert>
            ) : null}

            {estado === 'sem-token' ? (
                <Alert kind="bad">{t.auth.linkSemCodigo}</Alert>
            ) : null}

            <div className="foot">
                <Link to="/">{t.auth.irParaViceHub}</Link>
            </div>
        </div>
    );
};
