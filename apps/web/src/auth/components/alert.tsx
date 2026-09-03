interface AlertProps {
    kind: 'bad' | 'good';
    children: string;
}

/**
 * As mensagens de erro são anunciadas por leitores de ecrã.
 *
 * `role="alert"` porque uma falha de autenticação que só aparece a quem
 * está a olhar não é uma falha comunicada.
 */
export const Alert = ({ kind, children }: AlertProps) => (
    <p className={`alert ${kind}`} role={kind === 'bad' ? 'alert' : 'status'}>
        {children}
    </p>
);
