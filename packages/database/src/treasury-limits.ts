/**
 * O tecto de uma tesouraria.
 *
 * `Wallet.balance` e `Transaction.amount` são `BigInt`, que em
 * PostgreSQL é um inteiro de 64 bits com sinal: o maior valor que lá
 * cabe é 9 223 372 036 854 775 807. Acima disso a base de dados recusa
 * a escrita a meio da transação, e o que chega a quem pediu é um 500 —
 * quando o pedido é, de facto, inválido ou impossível.
 *
 * O número vive aqui, ao lado do esquema que declara a coluna, porque é
 * dela que o limite é e não de uma regra de negócio: quem valida a
 * entrada e quem credita o saldo leem o mesmo número.
 */
export const SALDO_MAXIMO = 9_223_372_036_854_775_807n;
