import { useAsync } from '../../lib/use-async.js';
import { useT } from '../../i18n/i18n.js';
import { ENDERECO_DISCORD, getAuthProviders } from '../auth.api.js';

/**
 * O botão de entrar com Discord.
 *
 * Só aparece onde funciona: a API diz se está configurado, e sem isso
 * o botão levava a um erro que ninguém sabia ler.
 *
 * É uma âncora e não um botão com `onClick`: o Discord precisa de ver
 * a pessoa, e isso é uma navegação do browser — um `fetch` traria a
 * página de autorização para dentro de uma resposta que ninguém vê.
 */
export const DiscordButton = () => {
    const t = useT();
    const providers = useAsync(() => getAuthProviders(), []);

    if (providers.data?.discord !== true) {
        return null;
    }

    return (
        <>
            <p className="hint ou-entao">{t.auth.ouEntao}</p>

            <a className="discord" href={ENDERECO_DISCORD}>
                {t.auth.entrarComDiscord}
            </a>
        </>
    );
};
