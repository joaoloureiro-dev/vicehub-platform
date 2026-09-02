/**
 * Normaliza um email para efeitos de identidade.
 *
 * O email é o identificador de uma conta, e `Player@vicehub.com` e
 * `player@vicehub.com` são a mesma caixa de correio em qualquer servidor
 * que exista na prática. Guardá-los como identidades distintas deixava
 * criar duas contas para a mesma pessoa e, pior, fazia o login falhar a
 * quem escrevesse o próprio email com outra caixa — sem nada na resposta
 * que explicasse porquê.
 *
 * A parte local de um endereço é, pela norma, sensível a maiúsculas; na
 * prática nenhum fornecedor a trata assim, e seguir a norma à letra aqui
 * custaria contas duplicadas em troca de uma distinção que ninguém faz.
 *
 * A normalização fica no domínio, e não apenas no schema HTTP, para que
 * uma via de entrada nova — um início de sessão por Discord, por
 * exemplo — não volte a introduzir o problema por esquecimento.
 */
export const normalizeEmail = (email: string): string =>
    email.trim().toLowerCase();
