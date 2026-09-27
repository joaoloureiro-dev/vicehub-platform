# O tema, e cada ecrã nele

Vice City à noite: o letreiro de néon contra o céu, e não em papel
branco. Aqui estão os **30 ecrãs do produto**, cada um em duas larguras:
`<ecrã>-telemovel.png` a 390px e `<ecrã>-portatil.png` a 1280px.

A página [`galeria.html`](galeria.html) mostra-os todos juntos, com o
nome, a rota e uma linha do que cada um faz. É a mesma página que está
publicada como artifact.

## Não são desenhos

São fotografias de páginas a sério contra uma base de dados a sério, e
saem de [`apps/web/scripts/retratar.mjs`](../../../apps/web/scripts/retratar.mjs),
que semeia e depois fotografa:

```
npm run db:migrate:reset --workspace @vicehub/database
npm run build
npm run retratar --workspace @vicehub/web
```

O programa semeia gente com nome — `kestrel`, `marlowe`, uma crew
chamada Neon Harbour, um servidor chamado Leonida Nights — e não
`user1` com um número carimbado ao lado. É por isso que é um programa
separado da varredura: a varredura precisa que os nomes sejam únicos
entre corridas e carimba-os; isto precisa que pareçam nomes. Uma captura
de `Os Corredores 8039663` lê-se pelo que é, uma base de dados de teste.

Pela mesma razão, precisa de uma **base vazia**: os nomes são fixos, e
nomes fixos só são únicos uma vez. O programa recusa-se a correr se já
lá estiver a conta que ia criar.

## O que decidiu o desenho

Aritmética, e não gosto — a mesma aritmética que antes obrigava a
inverter as cores, e que agora joga a favor. Sobre `#0B0711`:

| Cor | Como texto sobre a noite | Tinta clara por cima dela | (Como texto sobre branco) |
|---|---|---|---|
| Magenta `#E93CEF` | 6,04 — passa | 2,96 — reprova | 3,30 — reprovava |
| Violeta `#A78BFA` | 7,33 — passa | 2,44 — reprova | 2,72 — reprovava |
| Ciano `#22D3EE` | 11,04 — passa | 1,62 — reprova | 1,81 — reprovava |

As cores do logótipo continuam a entrar à saturação máxima, e continuam
a ser **preenchimento**: o que mudou é que agora também se lêem como
letra, e o que deixou de se ler é tinta clara por cima delas. Por isso a
letra de um botão de néon é a cor da própria página — 6,04 no magenta,
4,71 no violeta do meio do degradê, 11,04 no ciano —, que é exatamente
como um letreiro funciona. O que precisa de ser lido em cor usa as
versões claras, calculadas para passarem 4,5 sobre o mais claro dos três
fundos do tema.

O degradê aparece em dois sítios: um filete de três pixéis por cima da
página, e o nome da marca. Um cabeçalho inteiro pintado de magenta a
ciano é a página que toda a gente faz.

Não há tema claro, e é decisão e não esquecimento: um segundo tema é uma
segunda paleta inteira, com o dobro dos números para verificar. Os
números deste estão todos em
[`apps/web/tests/contraste.test.ts`](../../../apps/web/tests/contraste.test.ts),
que falha no dia em que algum deixar de bater certo.
