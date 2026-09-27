# O tema, como ficou

Vice City à noite: o letreiro de néon contra o céu, e não em papel
branco. Capturas a 390px de largura — telemóvel, que é onde a maioria
vai entrar — contra uma base de dados povoada.

| | |
|---|---|
| [`landing.png`](landing.png) | A página de entrada |
| [`entrar.png`](entrar.png) | O formulário, com o botão principal |
| [`crew.png`](crew.png) | A página de uma crew |
| [`perfil.png`](perfil.png) | O perfil, com a reputação |
| [`mercado.png`](mercado.png) | O mercado de um servidor |
| [`tesouraria.png`](tesouraria.png) | Os quatro saldos |
| [`forum-lista.png`](forum-lista.png) | O fórum |
| [`forum-topico.png`](forum-topico.png) | Um tópico |
| [`portatil.png`](portatil.png) | O mesmo produto a 1280px |

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
