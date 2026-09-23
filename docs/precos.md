# Os degraus de preço

Este ficheiro não muda preço nenhum. Os preços estão em
`packages/database/src/plans.ts` e quem os decide és tu. O que está aqui
é a leitura da escada que existe hoje, onde é que ela tem o degrau
partido, e o que eu recomendaria pôr no lugar — com as contas feitas até
ao número que sobra ao fim do mês, que é o único que interessa.

---

## A escada de hoje

| escalão | quem compra | preço | o que dá |
|---|---|---|---|
| — | servidor | 0 € | 3 crews |
| `premium` | crew | 4,99 €/mês | a tesouraria da crew |
| `server_base` | servidor | 14,99 €/mês | 10 crews |
| `server_plus` | servidor | 19,99 €/mês | 50 crews |
| `server_unlimited` | servidor | 99,99 €/mês | sem limite |

E, à parte, 30 dias de avaliação por comunidade (`DIAS_DE_AVALIACAO`),
uma vez só, na criação.

---

## O degrau partido

**De `base` para `plus` são mais 33% de preço por cinco vezes a
capacidade.** Cinco euros a separar dez crews de cinquenta não é uma
decisão: é um passo que ninguém pensa duas vezes antes de dar. O efeito
não é vender mais `plus` — é **matar o `base`**. Quem chega aos preços e
acha que vai crescer compra logo o `plus`, e quem não acha que vai
crescer fica-se pelas três crews de graça. Sobra para o `base` uma faixa
muito estreita: servidores que vão ter entre quatro e dez crews, para
sempre, e que sabem isso de antemão.

**De `plus` para `unlimited` são cinco vezes o preço.** Vinte para cem.
Um servidor com cinquenta e cinco crews está a olhar para mais oitenta
euros por mês por causa de cinco crews, e o que faz não é pagar: é
expulsar as inactivas, ou abrir um segundo servidor. A escada empurra-o
para contornar o limite em vez de o comprar.

Uma escada de três degraus funciona quando **o do meio é o que se quer
vender** e os outros dois existem para o fazer parecer certo. Esta tem o
do meio a ser o melhor negócio dos três por uma margem enorme, e o de
cima a ser um castigo. Está ao contrário.

**E a entrada é alta.** 14,99 € por mês, para um dono de servidor de
roleplay, é o que ele já paga pelo alojamento do servidor de jogo
inteiro. A primeira compra numa plataforma que ele ainda não sabe se a
comunidade vai usar tem de ser um impulso, e quinze euros não é um
impulso.

---

## O que eu recomendaria

**Dois escalões pagos de servidor, não três. E o degrau que interessa é
o primeiro: 7,99 €.**

| escalão | preço | o que dá | estado |
|---|---|---|---|
| — | 0 € | 3 crews | como está |
| `premium` | 4,99 €/mês | tesouraria da crew | **não mexer** |
| `server_base` | **7,99 €/mês** | **15 crews** | entrada |
| `server_plus` | — | 50 crews | **definido, sem preço no Stripe** |
| `server_unlimited` | **29,99 €/mês** | sem limite | topo |

O código já suporta isto sem uma linha nova: **um escalão está à venda
se e só se tiver um preço configurado no Stripe** (`billing.service.ts`
salta os que não têm). O `server_plus` fica escrito no catálogo, sem
preço, e simplesmente não aparece. No dia em que os números disserem que
faz falta, abre-se com uma variável de ambiente.

### Porquê estes números

**7,99 €** fica abaixo da linha dos dez euros, que é onde um orçamento
de passatempo deixa de pensar. São cinco vezes o que se tem de graça —
três crews para quinze —, portanto o que se compra é visível. E fica
logo acima dos 4,99 € da crew: um servidor inteiro custa um bocadinho
mais do que uma crew, e isso lê-se sozinho.

**29,99 €** é 3,75× a entrada para tirar o limite de vez. É um degrau
que se sente e que se paga: um servidor com mais de quinze crews já tem
gente a mais para fingir que não precisa. Os 99,99 € de hoje não são um
preço — são uma porta fechada, e quem lhe bate vai-se embora.

**O `plus` fica para quando houver dados.** Abre-se quando se vir
servidores a empilhar no tecto do `base` — a ficarem em treze, catorze,
quinze crews e a não subir. Aí o 14,99 € / 50 crews que hoje é a entrada
passa a ser o meio, e a escada fica com o degrau do meio a fazer o que
um degrau do meio faz.

**O `premium` não se mexe.** É o produto de volume — há muitas crews por
servidor — e é o único que vende uma coisa que se usa todos os dias.

---

## O que sobra ao fim do mês

Os termos dizem que o preço mostrado inclui IVA. Então o preço de
tabela não é a receita, e vale a pena ver quanto é que é.

Com IVA português a 23% e o Stripe europeu a 1,5% + 0,25 €:

| preço de tabela | IVA | Stripe | **fica** |
|---|---|---|---|
| 4,99 € | 0,93 € | 0,32 € | **3,74 €** |
| 7,99 € | 1,49 € | 0,37 € | **6,13 €** |
| 29,99 € | 5,61 € | 0,70 € | **23,68 €** |
| 14,99 € (hoje) | 2,80 € | 0,47 € | **11,72 €** |
| 99,99 € (hoje) | 18,70 € | 1,75 € | **79,54 €** |

Duas coisas a tirar daqui:

1. **Uma cobrança pequena paga muito mais comissão.** Os 0,25 € fixos
   do Stripe fazem com que os 4,99 € do `premium` percam 6,5% para a
   comissão, contra 2,3% nos 29,99 €. É a razão pela qual um plano
   mensal barato tem um chão, e é o argumento mais forte para haver um
   plano anual — mas isso é código, e não configuração:
   `intervalMonths` está na definição do plano, e um plano anual é uma
   definição nova, não um preço novo no Stripe.

2. **O IVA não é 23% para toda a gente.** Serviço digital vendido a um
   consumidor na UE leva o IVA do país dele — 27% na Hungria, 17% no
   Luxemburgo. Com preços com IVA incluído, o que fica varia com o país
   de quem compra. Quem resolve isso é o Stripe Tax, e é uma caixa para
   ligar no painel, não código.

---

## O que eu não sei

Não tenho um único dado de utilização, porque ainda não há utilizadores.
Tudo isto é aritmética sobre a escada e sobre o que custa um servidor de
jogo a quem já paga um. O primeiro mês com pessoas lá dentro vale mais
do que este ficheiro inteiro, e quando ele existir isto reescreve-se.
