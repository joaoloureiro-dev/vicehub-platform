/**
 * O preço de um plano, no idioma de quem o lê.
 *
 * Aqui divide-se por cem, e na tesouraria nunca se divide nada. A
 * diferença é o que está a ser contado: a moeda do jogo vai a dezanove
 * dígitos e viaja como texto do princípio ao fim, porque `Number` a
 * partiria. Isto é dinheiro a sério em cêntimos, vindo do Stripe, e
 * nunca chega perto do limite — um plano a dez dólares são mil.
 */
export const formatarPreco = (
    cents: number,
    currency: string,
    locale: string,
): string =>
    new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        /**
         * Um preço redondo mostra-se redondo. "$10" lê-se como preço;
         * "$10.00" lê-se como uma linha de fatura.
         */
        minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
