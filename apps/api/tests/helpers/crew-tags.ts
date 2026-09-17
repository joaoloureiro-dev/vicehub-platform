/**
 * Uma tag de crew que não colide com a de outra corrida.
 *
 * A tag tem oito caracteres e é **única na base de dados**, para sempre
 * — não por corrida. A base de integração guarda as linhas entre
 * corridas, por isso cada suite deixa lá as crews que criou.
 *
 * Os testes derivavam a tag de uma marca com o relógio, cortada a oito
 * caracteres depois de um prefixo descritivo. Sobravam três ou quatro
 * caracteres a variar: mil a dez mil combinações. Correndo a suite
 * vezes suficientes contra a mesma base, colidia — e a falha aparecia
 * em testes de classificação, de limites de plano, de filiação: em
 * qualquer sítio menos naquele que tinha o problema.
 *
 * Sorteada, são trinta e seis elevado a sete. O nome da crew continua a
 * levar a marca descritiva, que é o que ajuda a ler o que falhou; a
 * unicidade é assunto só da tag.
 */
export const tagAoAcaso = (): string =>
    `C${Math.random().toString(36).slice(2, 9)}`.slice(0, 8).toUpperCase();
