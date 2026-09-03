import { useState } from 'react';

import { ApiError } from '../lib/api.js';
import { useAuth } from '../auth/auth.context.js';
import { requestEmailVerification } from '../auth/auth.api.js';
import { Alert } from '../auth/components/alert.js';

/**
 * O que a conta é, enquanto não há mais nada construído.
 *
 * Deliberadamente pouco: crews, servidores e tesouraria existem na API e
 * ainda não têm ecrã. Fingir aqui um painel cheio daria a ideia errada a
 * quem for testar.
 */
export const HomePage = () => {
    const { user } = useAuth();

    const [pedido, setPedido] = useState<'idle' | 'enviado' | 'falhou'>('idle');

    if (!user) {
        return null;
    }

    const confirmarEmail = async () => {
        try {
            await requestEmailVerification();
            setPedido('enviado');
        } catch (falha) {
            setPedido(
                falha instanceof ApiError &&
                    falha.code === 'EMAIL_ALREADY_VERIFIED'
                    ? 'enviado'
                    : 'falhou',
            );
        }
    };

    return (
        <div className="panel">
            <h1>Olá, {user.username}</h1>
            <p>
                A conta está criada e a sessão é tua. As crews, os servidores e
                a tesouraria já existem na API — os ecrãs vêm a seguir.
            </p>

            <dl className="rows">
                <div>
                    <dt>Jogador</dt>
                    <dd>{user.username}</dd>
                </div>
                <div>
                    <dt>Email</dt>
                    <dd>{user.email}</dd>
                </div>
                <div>
                    <dt>Identificador</dt>
                    <dd>{user.id}</dd>
                </div>
            </dl>

            {pedido === 'enviado' ? (
                <Alert kind="good">
                    Email de confirmação enviado. Sem SMTP configurado, o link
                    fica no log da API.
                </Alert>
            ) : null}

            {pedido === 'falhou' ? (
                <Alert kind="bad">
                    Não foi possível enviar o email de confirmação.
                </Alert>
            ) : null}

            <div className="actions">
                <button
                    className="primary"
                    type="button"
                    onClick={() => void confirmarEmail()}
                >
                    Confirmar o meu email
                </button>
            </div>
        </div>
    );
};
