import { RequestResetPage } from './request-reset.page.js';
import { ResetPasswordPage } from './reset-password.page.js';
import { useLinkToken } from '../use-link-token.js';

/**
 * Um endereço só, para as duas metades da recuperação.
 *
 * É o endereço que segue nos emails, e é também o que alguém escreve
 * quando se lembra de que se esqueceu da password. Com código, pede a
 * password nova; sem código, pede o email para enviar o link.
 *
 * Ter dois endereços separados obrigaria a decidir para qual deles o
 * email aponta, e quem lá chegasse pelo outro caminho via um formulário
 * que não era o seu.
 */
export const RecoverPasswordPage = () => {
    const token = useLinkToken();

    return token ? <ResetPasswordPage token={token} /> : <RequestResetPage />;
};
