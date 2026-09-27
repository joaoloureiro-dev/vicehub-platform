/**
 * Os idiomas em que a plataforma escreve a uma pessoa.
 *
 * A API fala português — as mensagens dela servem quem lê registos e
 * quem escreve código, e há um teste na web que as impede de chegar a um
 * ecrã. **Um email não é nenhuma das duas coisas.** É a plataforma a
 * falar diretamente com uma pessoa, fora do browser, e por isso tem de
 * ser escrito no idioma dela.
 *
 * Esta lista é a mesma de `apps/web/src/i18n/locales.ts`, e está escrita
 * duas vezes porque a web e a API não partilham código. O que impede as
 * duas de divergirem é um teste — `idiomas-dos-emails.test.ts` — que lê
 * este ficheiro e falha no dia em que um idioma entrar num lado e não no
 * outro. É a mesma amarração que prende o `.env.example` ao `env.ts`.
 */
export const IDIOMAS = ['en', 'pt', 'es', 'fr'] as const;

export type Idioma = (typeof IDIOMAS)[number];

/**
 * Inglês, que é o idioma em que o produto abre.
 *
 * Serve a quem chega sem dizer nada: um cliente antigo que ainda não
 * manda o campo, um guião, um pedido feito à mão. Escrever-lhes em
 * português seria escolher a língua de quem fez a plataforma em vez da
 * de quem a usa.
 */
export const IDIOMA_POR_OMISSAO: Idioma = 'en';

const CONHECIDOS = new Set<string>(IDIOMAS);

/** O idioma pedido, se for um dos que existem. */
export const idiomaOuOmissao = (pedido: string | undefined): Idioma =>
    pedido !== undefined && CONHECIDOS.has(pedido)
        ? (pedido as Idioma)
        : IDIOMA_POR_OMISSAO;
