import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import {
    ENDERECO_DISCORD,
    ENDERECO_GOOGLE,
    getAuthProviders,
} from '../auth.api.js';

/**
 * As formas de entrar sem password.
 *
 * Só aparece o que funciona: a API diz o que está configurado, e um
 * botão que leva a um erro é pior do que botão nenhum. Se não houver
 * nenhum — ou se a pergunta falhar — não aparece nem o "ou", que sem
 * nada por baixo seria uma junta a separar coisa nenhuma.
 *
 * A pergunta é feita uma vez para os dois. Um componente por
 * fornecedor faria dois pedidos iguais à mesma rota, e cada um teria de
 * desenhar o seu próprio separador sem saber do outro.
 *
 * São âncoras e não botões com `onClick`: o fornecedor precisa de ver a
 * pessoa, e isso é uma navegação do browser — um `fetch` traria a
 * página de autorização para dentro de uma resposta que ninguém vê.
 */
export const FederatedButtons = () => {
    const t = useT();
    const providers = useAsync(() => getAuthProviders(), []);

    const disponiveis = [
        {
            chave: 'discord' as const,
            href: ENDERECO_DISCORD,
            texto: t.auth.entrarComDiscord,
        },
        {
            chave: 'google' as const,
            href: ENDERECO_GOOGLE,
            texto: t.auth.entrarComGoogle,
        },
    ].filter(({ chave }) => providers.data?.[chave] === true);

    if (disponiveis.length === 0) {
        return null;
    }

    return (
        <>
            <p className="hint ou-entao">{t.auth.ouEntao}</p>

            {disponiveis.map(({ chave, href, texto }) => (
                <a className={`federado ${chave}`} href={href} key={chave}>
                    {texto}
                </a>
            ))}
        </>
    );
};
