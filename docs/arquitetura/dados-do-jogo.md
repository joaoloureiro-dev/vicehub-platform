# Dados do jogo

O ViceHub é para comunidades de roleplay de **GTA VI**, e o jogo ainda
não tem forma de falar connosco. Este ficheiro diz o que já está
construído para quando tiver, o que falta, e — a parte que interessa
mais — **o que não se deve partir enquanto se espera**.

Não é um plano com datas. É o registo das decisões que já foram tomadas
e das que ficam por tomar, para que a decisão seguinte se apoie nelas em
vez de as redescobrir.

---

## O que já existe

A ingestão está feita e é **independente do motor de jogo**. Um servidor
reporta-se com um pedido HTTP e uma chave:

| | |
|---|---|
| Rota | `POST /api/v1/ingest/heartbeat` |
| Autenticação | `Authorization: Bearer vh_<prefixo>_<segredo>` |
| Corpo | `{ "playersOnline": 37 }` |
| Ritmo | um pedido por minuto |
| Quem identifica | `GET /api/v1/ingest/me`, para o recurso confirmar por quem fala |

Qualquer servidor que consiga fazer um pedido HTTP consegue reportar-se.
Não há SDK, não há biblioteca, não há dependência de runtime nenhum.

### A chave

Vive em `ServerApiKey`. Guardamos o **resumo** dela e um prefixo; a
chave em claro aparece uma vez, no ecrã onde é criada. Revogar é
imediato e escreve `revoked_at` — a linha fica, para o histórico saber
que existiu.

O que a chave consegue fazer é falar por **um** servidor. Não mexe em
contas, tesourarias nem planos.

### O recurso

`resources/vicehub/` é a **implementação de referência**, não a
integração. Está escrito para o runtime do FiveM por uma razão prática:
é o que existe hoje para instalar e testar a sério. Quando houver
ferramentas de servidor para GTA VI, o contrato deste lado é o mesmo e o
que muda é aquele ficheiro Lua.

Isto tem uma consequência que convém não esquecer em nada que saia para
fora: o público é **GTA VI · roleplay**. O FiveM é um detalhe da
implementação de referência, e não a audiência.

### O que o jogo decide hoje

Duas coisas, e só estas:

- se um servidor aparece **online** no diretório;
- **com quanta gente** dentro.

A regra do online está em `packages/database/src/heartbeat.ts`: cinco
minutos desde a última batida. Um servidor que já reportou alguma vez
passa a ser julgado pelo relógio, e a marca manual do dono deixa de
contar — um servidor que fala por si não é uma coisa que se ligue à mão.

---

## A propriedade que não se deve perder

**Nada no produto precisa de dados do jogo para funcionar.**

Crews, tesouraria, eventos, candidaturas, reputação — tudo corre sobre o
que as pessoas dizem à plataforma. O jogo só decide as duas coisas
acima.

Isto não é um acaso, é o que permite ao produto existir antes do jogo. E
é fácil de perder sem dar por isso: basta uma funcionalidade nova ficar
a depender de um facto que só o servidor sabe dizer, e a partir daí
metade da plataforma passa a estar à espera de ferramentas que não
controlamos.

A regra prática: **uma funcionalidade nova pode ficar melhor com dados
do jogo, não pode ficar dependente deles.**

---

## O que falta, e em que ordem

### 1. O que viaja lá dentro

O corpo tem um campo. É esse o buraco — não a canalização.

Uma nota técnica que muda a ordem das coisas: o schema do heartbeat é um
`z.object` normal, e o validador corre `safeParse`. Campos que ele não
conhece são **ignorados, não recusados**. Verificado contra o schema
compilado, e não deduzido:

| O que se manda | O que acontece |
|---|---|
| `{ playersOnline, uptimeSeconds, maxPlayers }` | aceite; fica só `{ playersOnline }` |
| `{ playersOnline }` | aceite |
| `{ uptimeSeconds }`, sem o obrigatório | recusado |

Consequência: **acrescentar campos não parte os recursos já
instalados.** Um servidor com a versão antiga do recurso continua a
reportar-se contra uma API nova, e um servidor com a versão nova contra
uma API antiga também — os campos a mais são deitados fora em silêncio.
O que parte é **remover ou renomear**, ou tornar obrigatório um campo
que os recursos antigos não mandam.

Por isso a ordem certa é sempre: acrescentar, deixar conviver, e só
limpar muito mais tarde.

### 2. Histórico

`recordHeartbeat` **sobrescreve** as colunas do servidor. A plataforma
sabe quantas pessoas estão lá agora e nunca soube quantas estavam há uma
hora.

É por isso que os **leaderboards de servidor** não existem: não há por
onde ordenar. Qualquer coisa que queira dizer "este servidor tem
crescido" precisa de linhas guardadas ao longo do tempo, e não de uma
coluna que se apaga a cada minuto.

Quando isso se fizer, vale a pena decidir ao mesmo tempo quanto tempo se
guarda e com que granularidade — uma linha por minuto por servidor cresce
depressa, e o `db:prune` existe precisamente porque as tabelas que
crescem sozinhas são as que ninguém vigia.

### 3. A decisão grande: quem afirma que estiveste lá

Hoje, todo o edifício da reputação e do xp assenta numa frase: **"o
organizador diz que estiveste lá."**

É uma escolha, e está documentada no `readme.md`: inscrever-se e ter
presença confirmada são coisas distintas desde o primeiro dia, e é a
confirmação — não a inscrição — que dá direito a parte dos ganhos.

Com dados reais, **o jogo podia afirmá-lo em vez da pessoa**. Essa é a
integração de maior valor que existe, porque troca a palavra de alguém
por um facto. Também é a que mais muda o produto:

- quem organiza deixa de decidir quem recebe;
- o peso de cada participação — que hoje quem organiza define ao
  confirmar — passa a precisar de outra resposta;
- uma comunidade que jogue fora de um servidor com o recurso instalado
  passa a estar em desvantagem face a uma que o tenha.

Nenhuma destas é uma pergunta técnica. **Não se resolve escrevendo
código**, resolve-se decidindo o que a plataforma quer ser — e por isso
fica aqui escrita em vez de ser assumida por quem chegar primeiro ao
ficheiro.

O que já está preparado para ela: a distinção entre inscrição e
presença, o `weight` em cada participação, e o facto de o acerto do
evento ser repetível — uma confirmação que chegue tarde é contada na
mesma.

### 4. Dizer de onde veio cada facto

`SourceType` tem `manual`, `discord_bot`, `webhook`, `api`, `system` e
`migration`. **Não tem `game`.**

Enquanto o jogo só disser quantas pessoas estão online, isso não faz
falta. No dia em que ele passar a afirmar factos sobre **pessoas** —
presenças, sobretudo — passa a fazer: distinguir "uma pessoa afirmou
isto" de "o servidor afirmou isto" é o que permite auditar, e é o que
permite desfazer só um dos dois lados quando um servidor se portar mal.

Acrescentar um valor ao enum é barato agora e caro depois de haver
milhões de linhas sem ele.

---

## O risco que não é nosso

Tem de existir primeiro alguma forma de correr servidores de GTA VI com
scripts. Não se sabe se vai existir, quando, nem em que termos.

Isso não é uma desculpa nem um bloqueio: é a razão de a propriedade
acima — nada depender dos dados do jogo — valer mais do que qualquer
funcionalidade que se construísse a contar com eles.

Se as ferramentas aparecerem, o que muda é um ficheiro Lua e o corpo de
um pedido. Se não aparecerem, o produto continua a funcionar e perde
duas coisas: o estado online automático e a contagem de jogadores. É um
preço que se paga; não é o produto.
