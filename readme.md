# 🚀 ViceHub

O ViceHub é um **ecossistema SaaS modular para comunidades de jogo online**, a começar pelo GTA VI e desenhado para crescer até uma plataforma multi-jogo.

Funciona como **segundo ecrã de quem joga**, e junta num sítio só a rede social, a progressão, a gestão de crews, o ecossistema de servidores e a economia dentro do jogo. Há um mercado digital planeado e ainda sem código — a lista abaixo marca o que está construído e o que não está.

---

## 🧠 Visão

Ser a plataforma onde as comunidades de jogo se encontram, crescem, competem e negoceiam — tudo no mesmo sítio.

---

## ⚙️ O que faz

O que o produto faz hoje, e o que não faz. `✔` funciona de ponta a ponta,
da base de dados até um ecrã; `🚧` está a meio; `○` ainda não tem código.

### 👤 Jogadores
- ✔ XP e níveis
- ✔ Reputação — ganha-se ao aparecer num evento onde alguém confirmou a
  presença, perde-se ao inscrever-se e não aparecer
- ✔ Emblemas e conquistas — saem das presenças, dos pagamentos, dos eventos
  e do nível da crew
- ✔ Amigos e grafo social
- ✔ Rasto de atividade

### 🏴 Crews
- ✔ Progressão da crew
- ✔ Economia e tesouraria — saldos, aprovações, transferências e pagamentos
- ✔ Eventos e missões
- ✔ Recrutamento
- ✔ Classificação — o diretório de crews ordena por XP

### 🌐 Servidores
- ✔ Perfil de servidor
- ✔ Rasto de atividade — batimentos e contagem de jogadores vindos do
  servidor de jogo
- ✔ Quadro de classificação — as crews que lá jogam, por xp, com quem está
  empatado a partilhar o lugar e a seguinte a descer tantos lugares quantos o
  empate ocupa
- ✔ Integração com os eventos
- ✔ Medida de movimento da comunidade — a contagem de jogadores é guardada
  hora a hora, e é por esse passado que o diretório ordena por onde há gente

### 🛒 Mercado
- ✔ Um mercado por servidor, em moeda do jogo, com anúncios por categoria
- ✔ Conversas entre quem compra e quem vende, sobre um anúncio
- ✔ Avaliações depois de uma venda, com direito de resposta de quem vendeu
- ✔ Denúncia de anúncios, mensagens e avaliações
- ○ Troca de serviços a dinheiro real, caução e Stripe Connect — e é
  provável que nunca exista: mover dinheiro a sério entre jogadores é outro
  produto, com outra lei em cima

### 💬 Fórum
- ✔ Perguntar e responder — ler não precisa de conta
- ✔ Procurar, em título e corpo, com o termo no endereço para se poder
  partilhar — a lista vazia de uma procura diz que não encontrou, e não
  que o fórum está vazio
- ✔ Apagar o que se escreveu; quem modera pode apagar qualquer coisa
- ✔ O texto sai com a conta de quem o escreveu, e a conversa fica de pé
- ✔ Fechar uma pergunta a novas respostas — a ferramenta branda, para o que
  lá está continuar a servir quem chega de uma pesquisa
- ✔ Denunciar, e uma fila que quem modera trabalha do mais antigo para o
  mais recente
- ✔ Resposta aceite — quem perguntou diz qual resolveu, ela passa a vir
  em primeiro lugar, e quem a escreveu fica a saber
- ✔ Cinco partes — geral, crews, servidores, roleplay e ajuda — com a parte no
  endereço, para se poder mandar a alguém, e a procura a cruzar-se com ela em
  vez de a apagar

### 📰 O que se passa no jogo
- ✔ Um bloco de notícias na página de entrada, alimentado por RSS ou Atom
- ○ Descobertas e segredos da comunidade — esses não são publicados por
  ninguém, são encontrados, e por isso pertencem ao fórum e não a um feed

### 🎮 Eventos
- ✔ Eventos a decorrer
- ✔ Prémios e distribuição de XP
- ✔ Desafios entre crews
- ✔ Histórico

### 🔔 Avisos
- ✔ Respostas, mensagens e avaliações, com contagem por ler na barra
- ✔ Atualiza-se enquanto a pessoa lá está, e não só a quem carrega em F5

---

## 🏗️ Arquitetura

- Monorepo (npm workspaces): `apps/api`, `apps/web`, `packages/database`
- Node.js 24 + TypeScript
- API em Fastify, a servir a interface construída a partir da sua própria origem
- Frontend em React + Vite
- PostgreSQL + Prisma 7
- Stripe para os pagamentos
- Entrar com Discord e com Google

Ainda não há: Redis nem fila de trabalhos. Tudo corre dentro do pedido que
o pediu, o que chega para este tamanho e não vai continuar a chegar.

---

## 🔐 Segurança

- JWT com refresh token
- Autorização por papéis e permissões (RBAC)
- Soft delete e registo de auditoria
- Limites de pedidos por rota
- Validação do que entra (Zod)
- Bloqueio temporário da conta após tentativas de login falhadas
- Verificação anti-robô (Turnstile) nas portas de entrada

---

## 🎨 Desenho

Os ecrãs: [`docs/media/tema/`](docs/media/tema/).

**Um letreiro de néon contra o céu da noite.** O produto é o arquivo de uma
comunidade — quem entrou, quem apareceu, quanto se dividiu e para quem — e
continua a ler-se como registo: a estrutura vem de filetes e de hierarquia
de letra, e não de caixas empilhadas. O que mudou foi a hora. Isto vive num
separador ao lado de um jogo que se joga de noite, e era a única coisa
branca no ecrã.

- As cores do logótipo à saturação máxima, e é a página que é escura. Sobre
  `#0B0711` o magenta dá 6,04 de contraste e o ciano 11,04 — passam por si,
  e as versões claras passam com folga larga. O que reprova é tinta clara
  por cima de um néon aceso (2,96 e 1,62), e por isso a letra de um
  preenchimento de néon é a cor da própria página: a cor acende, as letras
  são o recorte escuro, que é como um letreiro funciona. O que precisa de
  ser *lido* em cor usa as versões claras, calculadas para passarem 4,5
  sobre o mais claro dos três fundos do tema. O
  `apps/web/tests/contraste.test.ts` mantém isso assim, paragens do degradê
  incluídas.
- Não há tema claro nem `prefers-color-scheme`, por decisão: um segundo
  tema é uma segunda paleta inteira, com o dobro dos números para
  verificar. Ao browser diz-se uma vez — `color-scheme: dark` na folha e na
  cabeça da página —, e assim as caixas de seleção, as barras de rolar e os
  calendários que ele desenha saem escuros também, e não há clarão branco
  antes de a folha chegar. O `apps/web/tests/controlos-nativos.test.ts`
  obriga a cor da página, a `<meta>` e o manifesto a dizerem o mesmo.
- O degradê do logótipo aparece em exatamente dois sítios: um filete de três
  pixéis por cima da página, e o nome da marca. Um cabeçalho inteiro pintado
  de magenta a ciano é a página que toda a gente faz.
- A letra de display é o Archivo na largura expandida, em maiúsculas
  pesadas — larga e sólida. Não imita nenhuma letra da Rockstar, e não
  podia: isto é uma plataforma independente. O texto corrido é o IBM Plex
  Sans; o dinheiro e o XP ficam no JetBrains Mono, porque colunas de
  algarismos têm de alinhar.
- Do telemóvel para fora: as regras base servem o ecrã pequeno e as media
  queries só acrescentam à medida que há espaço.
- Os ecrãs atualizam-se quando se pede — ainda não há ligação ao vivo
- **Um ecrã que rebenta é um ecrã, e não o produto.** Há uma fronteira de
  erro à volta da página, por dentro da casca: se um componente falhar a
  desenhar, a barra e a navegação ficam de pé e há outro sítio para onde
  ir. Há uma segunda à volta de tudo, para o caso de ser a própria casca
  a cair. Sem elas o React desmontava a árvore inteira e o que ficava era
  uma **página branca** — a avaria que se confunde com a rede em baixo,
  com o telemóvel lento, ou com o produto não existir, e que por isso
  ninguém reporta.
- **Cada ecrã chega quando alguém lá vai.** Vinha tudo num pacote só, e
  quem abrisse a página de entrada descarregava também a fila de
  moderação, as páginas legais e a tesouraria. Ficam à partida a entrada,
  o login e o registo — são o funil inteiro da primeira visita, e
  pedi-los num segundo pedido punha um "a carregar" entre a pessoa e a
  única coisa que ela veio fazer.

  | | Antes | Agora |
  |---|---|---|
  | Primeira visita | 593 KB (175 KB comprimido) | 445 KB (146 KB) |
  | Cada ecrã a seguir | — | 1 a 10 KB |

  O que sobra por fazer aqui são os **quatro dicionários**, 64 KB
  comprimidos dos quais três quartos são idiomas que quem está a ler não
  escolheu. Ficam como estão de propósito: carregá-los à parte trocava
  esses bytes por um instante de inglês no ecrã de quem escolheu outra
  coisa, e uma troca dessas é para se decidir e não para se fazer de
  passagem.

---

## 🛠️ Desenvolvimento

### Requisitos

- Node.js 24 ou superior
- npm 11 ou superior
- PostgreSQL (local ou Neon)

### Arranque

```bash
npm ci
npm run dev
```

`npm run dev` arranca a API e a aplicação ao mesmo tempo, com a origem de
cada linha à frente, e na primeira vez constrói o pacote `database`
sozinho. Se preferires um em cada terminal: `npm run dev:api` e
`npm run dev:web`.

**Porque é que o `dev` é um guião e não `npm run dev --workspaces`:** o
npm corre os workspaces **em sequência**. A API arrancava, ficava a
correr, e a aplicação nunca chegava a começar — sem nada no ecrã que
explicasse porquê.

**E porque é que ele constrói o `database` primeiro:** em execução,
`@vicehub/database` resolve para `dist/`, que não é versionado. Num clone
acabado de fazer não existe, e como o `tsx` compila o código da API ao
vivo, o erro que aparecia era um export em falta num ficheiro que ninguém
tinha tocado.

A primeira vez precisa ainda da base de dados preparada:

```bash
npm run db:migrate:deploy
npm run db:seed
```

O `db:seed` é obrigatório e não é opcional: sem ele o cargo base `player`
não existe, e sem esse cargo ninguém consegue criar conta. **A API recusa
arrancar** e diz qual é o comando — não deixa a plataforma de pé à espera do
primeiro registo para falhar. É idempotente, por isso pode correr-se sempre.

### Verificação

```bash
npm run build      # packages antes de apps, por ordem de dependência
npm run typecheck
npm run test       # não precisa de base de dados
```

Os testes usam duplos em memória em vez do Prisma, por isso correm em
qualquer máquina sem preparação. O mesmo conjunto de comandos corre no CI,
em `.github/workflows/ci.yml`.

#### As quatro que o CI não corre

Há coisas que nenhum teste apanha porque não têm onde acontecer: o `jsdom`
não tem largura nem linha nem polegar, e um duplo em memória não recusa um
pedido — responde ao que lhe mandam. As quatro ferramentas abaixo precisam de
uma API de pé com base de dados atrás, e por isso correm-se à mão, antes de
uma entrega ou depois de mexer no que elas medem.

```bash
# a API a correr com a base de desenvolvimento e os travões levantados:
#   RATE_LIMIT_MAX=100000 FORUM_RATE_LIMIT_MAX=10000

npm run varrer  --workspace @vicehub/web   # o produto inteiro, num browser
npm run sondar  --workspace @vicehub/api   # o produto inteiro, como intruso
npm run medir   --workspace @vicehub/api   # o que cada ecrã custa à base
npm run ensaiar --workspace @vicehub/api   # uma instalação nova serve?
```

A medição exige a extensão do Postgres, uma vez por base:

```
shared_preload_libraries = 'pg_stat_statements'   # postgresql.conf, e reiniciar
CREATE EXTENSION pg_stat_statements;
```

**A varredura** abre os trinta e um ecrãs em quatro idiomas e duas larguras e
mede o que se vê: texto a sair do ecrã, linhas compridas de mais, rótulos
partidos em dois, e o que se pode carregar com menos de vinte e quatro pixéis
de altura. Semeia o produto até ao fim — um evento concluído, uma divisão por
participação, uma venda avaliada — porque um ecrã medido vazio é uma moldura
à volta de nada. Com `--controlo`, começa por esticar um rótulo e exigir que a
medição dê por ele: uma varredura avariada e uma varredura limpa dizem
exactamente a mesma coisa.

**A medição** (`npm run medir --workspace @vicehub/api`) conta quantas
consultas cada ecrã custa à base de dados, lidas ao próprio Postgres pelo
`pg_stat_statements`. Não mede tempo: o tempo de uma máquina de
desenvolvimento não diz nada sobre uma base gerida do outro lado do
Atlântico, mas o **número de idas à base** é o mesmo aqui e lá, e é ele que
decide se uma página abre depressa quando cada ida custa dez milissegundos em
vez de meio. Compara com os números gravados em `medir-base.json` e queixa-se
do que cresceu — um tecto fixo daria um aviso permanente, e um aviso
permanente é um aviso que ninguém lê. `--gravar` reescreve a referência.

**A sonda** monta duas pessoas e tenta, com a segunda, tudo o que a primeira
pode fazer a si mesma — sobretudo pelo caminho errado, que é onde a
autorização por âmbito se engana: o âmbito do intruso no caminho, o
identificador da vítima no fim. Cada sonda corre duas vezes, e o dono **tem**
de conseguir o que o intruso não consegue; sem isso, um caminho mal escrito
passa por porta trancada. Sai com código 1 se encontrar uma porta aberta ou
uma sonda que não prove nada.

**O ensaio** é o único que se corre contra uma instalação **nova**, e responde
a uma pergunta que as outras três não fazem: isto, acabado de instalar,
funciona? As avarias de uma instalação nova são outras — o `db:seed` que
faltou, uma migração que não correu, um domínio que faz o cookie do refresh
não voltar — e nenhuma aparece numa máquina onde a base já tem meses de coisas
lá dentro. Faz o que a primeira pessoa faria: conta, renovação da sessão pelo
cookie, crew, servidor, tópico, anúncio, e os ecrãs todos que isso produz.
Depois **desfaz o que fez** e apaga a própria conta, para poder correr contra
uma plataforma já aberta sem lá deixar lixo — e confirma que a conta apagada
deixou de entrar. `--ficar` deixa o que criou de pé, `--base=` aponta-o a
outro sítio, e `--controlo` acrescenta um passo impossível e exige que o
ensaio dê por ele. O que fica de fora é o que precisa de chaves, e ele di-lo
no fim em vez de o deixar por dizer.

### Autorização por permissões

Os cargos e permissões estão definidos num só sítio,
`packages/database/src/rbac.ts`. É esse catálogo que alimenta o
`db:seed` e é dele que a API importa as permissões, pelo que o que está
gravado e o que o código exige não podem divergir.

#### Vitalícia, para os primeiros

| Rota | Quem pode |
|---|---|
| `POST /api/v1/subscriptions/grant` com `plan: "lifetime"` | `system:manage` |
| `POST /api/v1/subscriptions/:id/revoke` | `system:manage` |

Acesso premium que **não termina e nunca é cobrado**, para quem apoiou a
plataforma no princípio. É concedida um a um por quem administra — nunca
automaticamente por ordem de chegada, porque quem merece o gesto é uma
decisão de pessoas.

O `current_period_end` **ausente** é como se diz "não termina". Uma data
muito distante, como o ano 9999, parece resolver e depois morde: aparece
em ecrãs, entra em contas de dias restantes e ordena mal.

Dois `CHECK` impedem as duas maneiras de errar em silêncio, ambas caras:
um `premium` sem fim seria acesso gratuito para sempre sem que nada o
dissesse, e um `lifetime` com fim expirava um dia a quem lhe foi
prometido que não expirava.

O preço fica a **zero**, e não ao preço do premium: uma soma de receita
passaria a contar dinheiro que nunca entrou.

A resposta traz `isLifetime` além do `activeUntil`. Sem ele, um vitalício
era indistinguível de quem não tem plano — em ambos os casos não há data.

**Retirar** faz-se pela revogação, e não pelo cancelamento no fim do
período: não havendo fim, marcar para não renovar deixava a marca posta e
o acesso a correr. O registo não é apagado; fica com o fim marcado, para
que o histórico continue a dizer que existiu e até quando.

Uma rota protege-se assim:

```ts
fastify.get(
    '/crews/:crewId/definicoes',
    { preHandler: [fastify.authenticate, fastify.authorize('crew:manage')] },
    handler,
);
```

Notas sobre o comportamento:

- O `authorize` vem sempre **a seguir** ao `authenticate`, de que depende.
  Uma rota que se esqueça do `authenticate` é recusada com 401, em vez de
  ficar aberta.
- As permissões indicadas são **conjuntivas**: são todas exigidas.
- O âmbito é lido dos parâmetros `crewId` e `serverId` da própria rota. Um
  cargo atribuído noutra crew nunca autoriza uma operação nesta.
- Atribuições expiradas ou eliminadas por soft delete não contam.
- A permissão `system:manage` cobre todas as outras, para que uma
  permissão nova não deixe o administrador de fora.
- As permissões são lidas uma única vez por pedido, mesmo que a rota
  declare várias ou volte a consultá-las.

Uma recusa devolve 403 com a lista do que faltava:

```json
{
  "statusCode": 403,
  "code": "INSUFFICIENT_PERMISSIONS",
  "missingPermissions": ["crew:manage"]
}
```

Acrescentar uma permissão é editar o catálogo e voltar a correr o
`db:seed`, que é idempotente e nunca elimina nada.

**O registo atribui o cargo `player`** a qualquer conta nova, na mesma
escrita que a cria. Não existem permissões implícitas no código: quem
pode o quê lê-se na tabela `UserRole`. Por isso o `db:seed` é um passo
obrigatório da instalação — sem os cargos, o registo recusa criar contas
em vez de as deixar sem autorização nenhuma.

### Nomear administradores

A permissão `system:manage` guarda a concessão de subscrições, e **não se
alcança pela API**. Nenhuma rota a pode conceder: a primeira conta capaz
de nomear administradores seria a própria porta que o cargo existe para
guardar.

A porta é o acesso à base de dados. Quem corre estes comandos já tem o
`DATABASE_URL` — ou seja, já pode fazer tudo o que o cargo permite; o
cargo apenas o passa a fazer pela API, e com rasto.

```bash
npm run admin:grant  -- pessoa@exemplo.com   # promove
npm run admin:revoke -- pessoa@exemplo.com   # retira
npm run admin:list                           # quem é administrador
```

A conta tem de existir: o comando não a cria. Promover duas vezes não
duplica nada, e voltar a promover quem foi retirado reaproveita a
atribuição anterior em vez de multiplicar o histórico.

Sem isto, `POST /api/v1/subscriptions/grant` responde **403** a toda a
gente, com `missingPermissions: ["system:manage"]`.

### Perfis de utilizador

| Rota | Autenticação | Devolve |
|---|---|---|
| `GET /api/v1/users/:username` | não | perfil público |
| `GET /api/v1/users/me` | sim | perfil do próprio |
| `PATCH /api/v1/users/me` | sim | perfil atualizado |
| `PATCH /api/v1/users/me/appearance` | sim, **com plano ativo** | perfil atualizado |

**O email identifica a conta, e a caixa das letras não faz parte dessa
identidade.** `Player@vicehub.com` e `player@vicehub.com` são a mesma
caixa de correio em qualquer servidor que exista na prática. O email é
normalizado no domínio — e não só no schema HTTP — para que uma via de
entrada nova, como um início de sessão por Discord, não volte a
introduzir o problema por esquecimento.

O perfil público é mesmo público: acessível sem conta, porque é isso que
o torna público. Mostra username, avatar, bio, level, xp, reputação, data
de registo e o **selo premium**.

O que fica de fora do perfil público está fora por decisão, não por
esquecimento: email, último início de sessão e a validade do plano. Dizer
que alguém é premium é diferente de expor até quando pagou, que é
informação de faturação. A decisão do que cada vista expõe vive num só
sítio, o `UserService`, e há testes que falham se algum campo privado
passar a sair na resposta pública.

O `PATCH /users/me` altera apenas apresentação — avatar e bio. Não indicar
um campo deixa-o como está; indicá-lo a `null` limpa-o. Email e username
não se alteram por aqui: mexem em identidade e unicidade, e merecem fluxos
próprios com verificação.

A personalização — banner e cor de destaque — está numa **rota à parte**
precisamente porque é paga: juntá-la ao `PATCH /users/me` faria alterar a
bio passar a exigir subscrição.

### Crews

| Rota | Quem pode |
|---|---|
| `GET /api/v1/crews/:crewId` | qualquer pessoa |
| `GET /api/v1/crews/:crewId/members` | qualquer pessoa |
| `POST /api/v1/crews` | qualquer conta |
| `POST /api/v1/crews/:crewId/join` | qualquer conta |
| `POST /api/v1/crews/:crewId/leave` | qualquer conta |
| `GET /api/v1/crews/:crewId/requests` | `crew:manage_members` |
| `POST /api/v1/crews/:crewId/requests/:userId/accept` | `crew:manage_members` |
| `POST /api/v1/crews/:crewId/requests/:userId/reject` | `crew:manage_members` |
| `DELETE /api/v1/crews/:crewId/members/:userId` | `crew:manage_members` |
| `PUT /api/v1/crews/:crewId/members/:userId/role` | `crew:manage` |
| `PATCH /api/v1/crews/:crewId` | `crew:manage` |
| `PATCH /api/v1/crews/:crewId/appearance` | `crew:manage` **e plano da crew** |

**Pertencer e mandar são coisas distintas.** O `Membership` diz quem
pertence e desde quando; o cargo dentro da crew é dado por `UserRole` com
âmbito de crew, e é o RBAC que decide quem pode o quê. Uma única fonte de
verdade evita que a interface diga que és oficial e o guard diga que não.

O serviço mantém as duas coerentes: entrar dá cargo, sair retira-o.

Entrar numa crew é por **aprovação**. Quem pede fica com adesão pendente e
sem cargo nenhum; só ao ser aceite recebe `crew_member`. A base de dados
impede dois pedidos em aberto na mesma crew, mas permite voltar a pedir
depois de sair ou de ser recusado — o histórico fica.

**Uma crew nunca fica sem líder.** Sair, ser removido ou ser despromovido
é recusado com 409 se fores o único `crew_leader`. Também não se altera o
próprio cargo nem se remove a si próprio pelas rotas de gestão.

**Alterar cargos exige `crew:manage`, e não a mera gestão de membros.**
Com `crew:manage_members` — que os oficiais têm — um oficial podia promover
um cúmplice a líder e tomar a crew a quem a fundou. A gestão de membros
cobre aceitar e remover; mexer em quem manda é outra coisa.

O âmbito é o que evita o erro mais perigoso: um cargo de líder noutra crew
**não** autoriza nada nesta, porque o guard lê o `crewId` da própria rota.

### Subscrições premium

O plano premium custa **10 USD por mês** e pode pertencer a um utilizador,
a uma crew ou a um servidor. O preço está em
`packages/database/src/plans.ts`, a mesma fonte única que a aplicação usa.

Cada período é uma **linha própria** na tabela `Subscription`, com o preço
cobrado nessa altura. Cancelar muda o estado, nunca apaga: o histórico de
quem teve premium, quando e por quanto, fica sempre disponível. É por isso
que o preço é gravado por linha — uma alteração de preços não reescreve o
passado.

Uma rota protege-se assim:

```ts
fastify.get(
    '/funcionalidade',
    { preHandler: [fastify.authenticate, fastify.requirePremium()] },
    handler,
);
```

O titular é indicado explicitamente — `requirePremium()` avalia o plano de
quem faz o pedido, `requirePremium('crew')` o da crew da rota. Numa rota de
crew, exigir o plano da crew ou o de quem a usa são decisões diferentes, e
adivinhar qual seria fonte de enganos.

Quem não tem plano recebe **402 Payment Required**, distinto do 403 de
falta de permissões: não faltam autorizações, falta o pagamento.

Dão acesso os estados `active` e `trialing`. O `past_due` fica de fora — se
quiseres um período de tolerância durante a cobrança, é acrescentá-lo a
`ENTITLING_SUBSCRIPTION_STATUSES`.

A base de dados garante por `CHECK` que cada subscrição tem exatamente um
titular, que o fim do período é posterior ao início e que o preço não é
negativo.

#### O que o plano desbloqueia

**Personalização do perfil.** Banner e cor de destaque (`#RRGGBB`), em
utilizadores, crews e servidores, por `PATCH .../appearance`. Numa crew ou
servidor são exigidas **duas** condições, porque são distintas: mandar lá
dentro (`crew:manage` / `server:manage`) e a crew ou o servidor terem plano.
Um líder com plano pessoal não personaliza uma crew que nunca pagou, e ter
plano não faz de ninguém líder.

O que fica gravado **não é apagado** quando o plano termina — quem voltar a
subscrever reencontra o que tinha —, mas **deixa de ser mostrado**. Sem
isso, bastava pagar um mês para ficar com a personalização para sempre: o
que se vende é exibi-la, não defini-la uma vez. A cor tem um `CHECK` na base
de dados além da validação da API, para que um valor mal formado não entre
por outra via.

**Destaque no diretório.** Os diretórios de crews e servidores devolvem um
bloco `featured` além de `items`. Vem à parte da lista, e não misturado com
ela, para que a paginação continue a dizer a verdade e para que quem
consome possa mostrar o destaque como destaque em vez de o disfarçar de
resultado.

São três lugares e **rodam de hora a hora** por todos os candidatos: sem
rotação, os três primeiros a subscrever ficavam com o topo para sempre e o
quarto pagava por uma coisa que nunca chegava a ter. A escolha é
determinística dentro de cada intervalo — dois pedidos seguidos dão a mesma
resposta —, e não aleatória, ou a mesma página vista duas vezes mostrava
coisas diferentes sem nada ter mudado.

O bloco só vem preenchido na **primeira página e sem filtros**. Quem
pesquisa, ou pede apenas os servidores online, fez um pedido concreto;
responder-lhe com colocação paga tornaria os resultados pouco fiáveis, que
é exatamente o que faria as pessoas deixarem de os usar.

### Eventos

| Rota (prefixo `/api/v1/events`) | Quem pode |
|---|---|
| `GET /crews/:crewId` | `event:read` |
| `POST /crews/:crewId` | `event:manage` |
| `GET /crews/:crewId/:eventId` | `event:read` |
| `PATCH /crews/:crewId/:eventId` | `event:manage` |
| `POST /crews/:crewId/:eventId/status` | `event:manage` |
| `POST /crews/:crewId/:eventId/signup` | qualquer membro |
| `DELETE /crews/:crewId/:eventId/signup` | qualquer membro |
| `GET /crews/:crewId/:eventId/participants` | `event:read` |
| `POST /crews/:crewId/:eventId/participants/:userId/confirm` | `event:confirm_attendance` |
| `POST /crews/:crewId/:eventId/participants/:userId/no-show` | `event:confirm_attendance` |

As mesmas rotas existem com `/servers/:serverId`. São declaradas **uma
vez** e registadas com os dois prefixos: escrevê-las duas vezes faria com
que uma correção só entrasse numa delas.

Os eventos existem para responder a uma pergunta que a tesouraria não
sabia responder sozinha: **quem participou nisto?** Sem eles, dividir
ganhos só podia ser por igual ou por cargo, e quem apareceu ao assalto
recebia o mesmo que quem não apareceu.

**Inscrever-se e ter presença confirmada são coisas distintas.** Quem se
inscreve diz que tenciona ir; só quem organiza pode afirmar que foi. É
essa afirmação — e não a inscrição — que dá direito a parte dos ganhos.
Por isso confirmar presenças exige uma permissão própria e não se
contenta com `event:manage`: organizar um evento e decidir quem é pago
por ele são poderes distintos, e uma comunidade pode querer dar um sem
dar o outro. Fica gravado quem confirmou e quando, com um `CHECK` que
impede uma presença confirmada sem autor.

Cada presença confirmada leva um **peso**. Quem lidera um assalto costuma
levar mais, e sem poder dizê-lo as comunidades voltariam a dividir fora
da plataforma.

Só membros ativos se inscrevem: sem isso, qualquer conta se inscrevia num
evento alheio e, uma vez confirmada, recebia parte dos ganhos de uma
comunidade a que não pertence.

Os estados são `scheduled`, `ongoing`, `completed` e `canceled`, e as
transições permitidas estão declaradas como dados num só sítio. A mudança
é aplicada condicionalmente na base de dados: dois pedidos simultâneos a
concluir o mesmo evento não o concluem duas vezes.

#### O que dá reputação

Concluir o evento é o que mexe na reputação de quem participou:

| Como ficou | Reputação |
|---|---|
| `confirmed` — quem organiza afirma que apareceu | **+1** |
| `no_show` — disse que ia e não foi | **−1** |
| `signed_up` — ninguém se pronunciou | não mexe |
| `withdrawn` — avisou que já não ia | não mexe |

Sai da presença confirmada porque é o único facto que a plataforma tem
sobre comparecer. Uma falta tira exatamente o que uma presença dá: se
custasse menos, a reputação subia a quem se inscreve em tudo e aparece em
metade — e é precisamente essa pessoa que o número existe para distinguir
de quem aparece sempre.

**Desistir não custa nada.** Avisar que já não se vai é o comportamento
que se quer, e não pode custar o mesmo que desaparecer sem dizer nada.
Ficar por confirmar também não custa: quem organiza não se pronunciou, e
castigar por isso seria castigar pelo silêncio de outra pessoa.

**O número pode ficar negativo**, e é deliberado. Um chão em zero faria a
soma das linhas deixar de ser o número, e apagaria a diferença entre quem
nunca foi a nada e quem falta a tudo a que se inscreve.

Cada ponto deixa uma linha em `ReputationAward`, com o evento de onde
veio — sem ela o número no perfil só se podia acreditar, e voltava a ser
contado à próxima. É um índice único por pessoa e evento que impede que o
mesmo evento conte duas vezes.

**Confirmar presenças depois de concluir conta.** Fechar o evento e só
depois arrumar quem apareceu é a ordem natural de trabalhar, e as contas
são refeitas a cada correção: quem for confirmado tarde recebe, e quem
passar a faltoso perde a reputação que tinha ganho. Refazer não duplica —
cada ganho é procurado antes de ser escrito, e a reputação é assentada no
valor que deve ter em vez de somada.

Duas coisas **não** são refeitas, e são-no de propósito:

- **O xp já pago não é retirado.** O xp mede o que se fez, e um nível a
  descer por uma correção de outra pessoa seria um castigo por engano
  alheio. Quem passa a faltoso perde reputação, que é o número que mede
  se apareceu.
- **A crew recebe uma vez.** O que o evento vale à crew foi assentado
  quando ela o fechou; voltar a pagá-lo a cada correção fazia o total
  subir por causa de arrumação, e não de eventos.

Antes de o evento fechar, confirmar não mexe em nada: a lista ainda está
a mudar, e é a conclusão que a fixa.

#### Dividir por participação

```http
POST /api/v1/treasury/crews/:crewId/distributions
{ "total": "400", "basis": "participation", "eventId": "..." }
```

Os pesos vêm das presenças confirmadas, não do pedido. Quem faltou não
recebe, mesmo sendo membro da crew — é isso que distingue esta base da
divisão por igual. O evento é procurado **pelo titular da carteira**:
sem isso, quem manda numa crew pagava o dinheiro dela aos participantes
do evento de outra, bastando-lhe saber o `eventId` de lá. O evento fica
gravado na divisão, para que se saiba porque é que aquelas pessoas em
concreto foram pagas.

#### Uma armadilha a evitar em rotas novas

O guard de autorização lê o âmbito de `request.params.crewId` e
`request.params.serverId`. **O Zod descarta o que o schema não declara.**
Uma rota `/crews/:crewId/:eventId` cujo schema de parâmetros só declare o
`eventId` fica sem `crewId` no momento em que o guard corre: a permissão
passa a ser avaliada sem âmbito nenhum, e quem manda na crew vê a própria
rota recusada com 403.

É silencioso — o schema parece correto e a rota parece correta. Há um
teste (`tests/integration/route-scope.test.ts`) que percorre **todas** as
rotas da aplicação e falha se alguma perder o seu âmbito na validação,
incluindo as que ainda não foram escritas.

Esse teste olha para as rotas por dentro. A sonda (`npm run sondar
--workspace @vicehub/api`) faz a pergunta do outro lado: põe o âmbito do
intruso no caminho e o identificador da vítima no fim, e exige uma recusa.
As duas juntas cobrem a armadilha nos dois sentidos — o âmbito que se perde
na validação, e o âmbito que passa mas não bate certo com o que vem a
seguir.

### O que custa uma página

Medido com `npm run medir`, contra uma base de desenvolvimento. Antes do
conteúdo de um ecrã, a casca faz três pedidos em **todas** as páginas: quem
sou eu, o que está à espera de mim, e quantos avisos tenho por ler.

| Pedido | Consultas |
|---|---|
| `GET /users/me` | 5 |
| `GET /notifications/unread` | 3 |
| `GET /users/me/pending` | 10 sem comunidades, 22 com |

Nenhum deles cresce com o uso — a caixa do que espera resposta crescia, duas
consultas por comunidade gerida, e deixou de crescer. O que resta é chão
fixo, e nenhum destes três exige uma permissão: a casca só precisa de saber
quem está do outro lado, não se essa pessoa pode gerir alguma coisa.

**Quem pede uma porta guardada é que pagava a mais.** Cada pedido a uma das
oitenta e cinco rotas que exigem uma permissão reunia-as do zero, e o Prisma
partia essa leitura aninhada — os cargos desta pessoa, e dentro de cada um as
permissões dele — em quatro instruções.

São duas leituras com ritmos diferentes metidas numa só. Que cargos uma
pessoa tem, e onde, muda a toda a hora. Que permissões dá cada cargo vive em
`rbac.ts`, e as linhas da base são um espelho que o `db:seed` grava: muda com
um deploy, e um deploy reinicia o processo. Separadas, a primeira é **uma**
instrução por pedido, e a segunda lê-se uma vez e fica em memória:

| Pedido | Antes | Agora |
|---|---|---|
| `GET /treasury/crews/:crewId` | 10 | 7 |
| `GET /events/crews/:crewId` | 7 | 4 |

Três consultas menos em cada pedido que verifica uma permissão. O catálogo
vale um minuto, para que mexer nas linhas com a aplicação de pé não espere
por um reinício; volta a ler-se se lhe pedirem um cargo que não conhece, para
que um cargo criado agora autorize já; e um identificador que uma leitura
fresca também não encontra fica marcado como ausente, ou quem tivesse um
cargo apagado punha a aplicação a reler o catálogo em cada pedido — o
contrário do que a cache veio fazer.

A cache está no caminho da autorização, que é onde um erro custa mais caro, e
por isso o que a prova não são os testes de unidade: é a sonda a correr
outra vez inteira, 24 portas em que o intruso continua a levar 403 e o dono
continua a conseguir.

E um caso à parte: `GET /notifications` custa quinze consultas **com a caixa
vazia**. Não cresce com o número de avisos; é o Prisma a ir buscar cada
relação à parte, haja ou não o que resolver. Encolhe-se numa linha —
`relationLoadStrategy: 'join'` — mas essa linha exige ligar a funcionalidade
em pré-visualização `relationJoins` no gerador, e isso muda o cliente gerado
da plataforma inteira. Por um ecrã que se abre de vez em quando, e a dias de
um primeiro deploy, não é uma troca que se faça sozinho.

### O quadro de um servidor

O xp de uma crew sobe com os eventos que ela conclui, e isso existia muito
antes de haver onde o ver: uma crew via o seu número e o lugar dela entre
todas as crews da plataforma. O quadro é o sítio onde o número quer dizer
alguma coisa a alguém — as crews que jogam **naquele** servidor, do xp mais
alto para o mais baixo.

**O lugar conta-se como se conta um lugar**: quantas estão estritamente à
frente, mais uma. Duas empatadas partilham-no, e a seguinte desce tantos
lugares quantos o empate ocupa — 1, 1, 3, e não 1, 1, 2. Desempatá-las pela
data em que se filiaram seria inventar uma diferença que ninguém ganhou.

Daí uma coisa que parece um pormenor e não é: **o lugar da primeira linha de
cada página vem de uma contagem, e não do salto da paginação**. Numa página
que comece a meio de um empate, o salto daria à segunda metade um lugar
diferente do da primeira — o mesmo xp com dois lugares, por causa de onde
calhou a quebra.

Só as filiações ativas. Um pedido por responder não é uma crew que joga ali,
e pô-la no quadro dava-lhe um lugar que ainda ninguém lhe deu.

| Rota | Quem pode |
|---|---|
| `GET /api/v1/servers/:serverId/leaderboard?page=` | qualquer pessoa |

Público como a lista das crews de um servidor: quem anda à procura de onde
levar a sua quer ver contra quem vai jogar, e um quadro fechado a quem não
está lá dentro não serve nem a quem está.

### Entrar com Discord

| Rota | O que faz |
|---|---|
| `GET /api/v1/auth/providers` | diz que formas de entrar esta instalação tem |
| `GET /api/v1/auth/discord` | manda para o Discord, com `state` num cookie |
| `GET /api/v1/auth/discord/callback` | o regresso: abre a sessão e encaminha |

```bash
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=https://.../api/v1/auth/discord/callback
```

As três são **opcionais e andam juntas**, como as do Stripe: sem elas a
plataforma arranca na mesma, o botão não aparece e a rota responde
**503**. Meia configuração é recusada ao arrancar — um identificador sem
segredo daria um botão que leva ao Discord e volta com um erro que
ninguém sabe ler.

**A que conta pertence uma identidade do Discord** é a única decisão que
aqui se toma, e tem três respostas por ordem:

1. já há uma identidade ligada → entra nessa conta;
2. não há, mas o email já tem conta → **liga-se a essa, e só se o
   Discord confirmar o endereço**;
3. nem uma coisa nem outra → cria conta.

O *se* do ponto 2 é a regra que não se pode perder de vista. O Discord
deixa mudar de email sem confirmar: sem exigir a confirmação, registar lá
o email de outra pessoa dava entrada na conta dela aqui, com um clique e
sem password nenhuma.

**Nenhum token passa pela barra de endereços.** O regresso do Discord
acaba num encaminhamento com o cookie do refresh token — que é HttpOnly —
e a aplicação arranca e pede `/auth/refresh` como já fazia. O que fosse
no endereço ficava no histórico do browser, no referer e nos logs de
tudo o que estivesse pelo meio.

O `state` liga a ida ao regresso e vive num cookie de dez minutos. Sem
ele, bastava mandar a alguém um endereço de retorno com o código de outra
pessoa para a deixar a usar a plataforma na conta dessa outra sem dar por
nada. O cookie é `SameSite=Lax` de propósito: quem volta do Discord vem
de outro sítio, e um `strict` não seria enviado nessa chegada.

Uma conta criada pelo Discord **não tem password**. A recuperação de
conta continua a responder o mesmo a toda a gente — quem não tem
credenciais simplesmente não recebe email —, e quem quiser uma password
define-a por aí.

### Cobrança pelo Stripe

| Rota | Quem pode |
|---|---|
| `GET /api/v1/billing/plans` | toda a gente, com conta ou sem ela |
| `POST /api/v1/billing/checkout` | conta com autoridade sobre o titular |
| `POST /api/v1/billing/webhook` | o Stripe, provado pela assinatura |

```bash
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...        # preço mensal recorrente
STRIPE_SUCCESS_URL=https://.../obrigado
STRIPE_CANCEL_URL=https://.../planos
```

As cinco variáveis são **opcionais e andam juntas**. Sem elas a
plataforma arranca na mesma e tudo funciona — incluindo a concessão
manual e o vitalício; o que não existe é a compra pelo próprio, e as
rotas respondem **503** a dizê-lo. Uma configuração meia-feita é recusada
ao arrancar: ter a chave e não ter o segredo do webhook seria pior do que
não ter nada, porque a compra funcionava, o Stripe cobrava, e a
plataforma nunca chegava a saber que alguém tinha pago.

**Quem pode comprometer cada titular a uma cobrança é verificado no
serviço, e não na rota.** O titular vem no corpo, e o guard de
autorização lê o âmbito dos *parâmetros* da rota — não o saberia
encontrar. Para si próprio basta ser-se o próprio; para uma crew ou um
servidor exige-se `crew:manage` ou `server:manage`.

Sem isto, qualquer conta punha o seu cartão a pagar a crew de outra
pessoa. Não é roubo — é pior de desfazer: fica uma cobrança recorrente
presa a uma comunidade que quem paga não controla, e quem lá manda não a
consegue cancelar, porque o cliente no Stripe não é dele. E bastava um
cartão contestado para arrastar uma crew alheia para uma disputa de
pagamento que ela nunca fez.

A verificação vem **antes** de olhar para a configuração do Stripe: "não
podes" é uma propriedade do pedido e não da instalação. Pela ordem
contrária, um sítio sem chaves respondia 503 a toda a gente e a recusa
por falta de autorização deixava de ser observável.

**O catálogo diz o preço e se a compra está sequer aberta.** O
`available` sai daí e não do clique: sem ele, o ecrã oferecia um botão
que responde 503, e um 503 depois de alguém decidir pagar lê-se como
avaria — a pior altura para parecer avariado. O vitalício fica de fora da
lista: anunciá-lo a zero seria prometer de graça o que é um gesto.

**Quem cobra é que sabe.** Enquanto o plano é concedido à mão, os
períodos são calculados aqui. A partir do momento em que o Stripe cobra,
as datas, o preço e o estado vêm dele — uma segunda contagem nossa
acabaria por discordar da fatura, sempre num dia em que alguém está a
olhar. O estado é lido ao Stripe a cada evento, e não deduzido do corpo:
eventos chegam fora de ordem, e aplicar um antigo por cima de um recente
daria acesso a quem já cancelou.

**A assinatura é o que protege o webhook.** A rota é pública por natureza
— quem a chama é o Stripe, que não tem conta aqui. Sem a verificação,
seria uma forma pública de conceder planos. Por isso o corpo chega **em
bruto**: a assinatura cobre os bytes tal como foram enviados, e voltar a
serializar o JSON invalidaria-a. O interpretador em bruto está
encapsulado no âmbito do webhook; registá-lo mais acima faria as
restantes rotas deixarem de receber JSON interpretado.

**O que a limpeza não pode apagar cedo é um refresh token rodado.** A
regra óbvia — "já foi rodado, já não serve" — está errada: é precisamente
a linha do token rodado que deteta um roubo. Se alguém apresentar um token
já substituído, a API sabe que existem duas cópias em circulação e derruba
a família inteira; sem a linha, o mesmo ataque dá apenas "token inválido"
e a sessão a sério continua aberta.

Por isso a condição é a expiração do **próprio token**, e não o seu
estado. O mesmo vale para as sessões, por uma porta menos visível: apagar
uma sessão leva os refresh tokens dela atrás por `onDelete: Cascade`, e
uma sessão revogada há cinco minutos ainda tem tokens dentro do prazo.

O que se perde é a deteção de um roubo mais velho do que o próprio token,
e essa é a troca. As regras vivem em `packages/database/src/prune.ts`, e
não no script, porque são a parte que pode estar errada — um `deleteMany`
com uma condição a mais apaga em silêncio o que ainda fazia falta.

**Um reenvio não cobra duas vezes.** O Stripe reenvia sempre que não
recebe resposta a tempo. A tabela `WebhookEvent` tem o identificador do
evento como chave primária, e é a *escrita* que serve de verificação:
tentar gravar e apanhar a chave duplicada é o que aguenta duas entregas
em paralelo, que uma leitura antes da escrita deixaria passar.

**Um pagamento em falta corta o acesso já.** `past_due` não dá direito ao
plano. O Stripe continua a tentar cobrar durante uns dias e, se
conseguir, manda outro evento e o acesso volta sozinho.

**Um vitalício não começa a pagar.** A compra é recusada com 409 a quem
já tem acesso que não termina: receber dinheiro por uma coisa que já foi
oferecida é a espécie de erro que ninguém repara e toda a gente acha mal.

### O servidor de jogo a falar connosco

O que o jogo diz hoje, o que falta, e as decisões que ficam por tomar
para quando houver ferramentas de servidor para GTA VI, estão em
[`docs/arquitetura/dados-do-jogo.md`](docs/arquitetura/dados-do-jogo.md).

| Rota | Quem pode |
|---|---|
| `POST /api/v1/servers/:serverId/api-keys` | quem manda no servidor |
| `GET /api/v1/servers/:serverId/api-keys` | quem manda no servidor |
| `DELETE /api/v1/servers/:serverId/api-keys/:apiKeyId` | quem manda no servidor |
| `GET /api/v1/ingest/me` | uma chave |
| `POST /api/v1/ingest/heartbeat` | uma chave |

Uma chave identifica **um servidor**, e nunca uma pessoa. É a distinção
que mantém isto seguro: o que um script consegue fazer com uma chave
roubada é mentir sobre o servidor dele — não mexe em contas, tesourarias
nem planos. Por isso o `authenticateServer` é um guard à parte do
`authenticate` das pessoas, e tem de continuar a ser.

**O segredo não é guardado.** Guarda-se o resumo, como nos tokens de
conta; o que fica em claro é o prefixo, que é o que permite listar
chaves sem revelar nenhuma e encontrar a linha sem percorrer a tabela. A
chave inteira aparece **uma vez**, na resposta que a cria. Quem a perder
gera outra — a alternativa era a plataforma poder ler as chaves de toda
a gente, e uma base de dados lida passaria a ser uma base de dados que
entrega os servidores todos.

```bash
curl -X POST https://.../api/v1/ingest/heartbeat \
  -H "authorization: Bearer vh_<prefixo>_<segredo>" \
  -H "content-type: application/json" \
  -d '{"playersOnline": 37}'
```

**Estar online deixou de ser uma marca e passou a ser uma data.** A
regra tem duas metades, e a ordem entre elas é o ponto:

- um servidor que já reportou alguma vez é julgado pelo relógio — cinco
  minutos sem sinal e sai do diretório. A marca manual deixa de contar,
  e o formulário deixa de a oferecer: um botão que não faz nada é pior
  do que botão nenhum;
- um servidor que nunca instalou o recurso continua a valer o que o
  dono marcou, porque é a única coisa que existe sobre ele.

A regra vive em `packages/database/src/heartbeat.ts` e é usada nos dois
sítios que respondem à mesma pergunta — o perfil, que a avalia em
memória, e o diretório, que a traduz em filtro. Vêm do mesmo sítio para
que não possam divergir.

#### O recurso

Vive em `resources/vicehub/` e é a outra metade disto: sem ele, quem
cria uma chave fica com uma chave e nada onde a colar. Copia-se para os
recursos do servidor, põe-se a chave no `server.cfg`, e ele reporta de
minuto a minuto.

O que sai de lá é uma linha de JSON com a contagem de jogadores, e mais
nada — não vai lista de quem está a jogar, nem identificadores de
ninguém.

**Corre em servidores de outras pessoas, por isso é testado.** O recurso
só corre dentro do jogo, mas o que decide se está certo não precisa de
jogo nenhum: o que vai no corpo, o que faz quando a chave é recusada,
quanto espera antes de tentar de novo. Isso corre-se contra um runtime
de mentira (`resources/vicehub/tests/`), e a CI corre-o em cada push:

```bash
npm run test:lua
```

O identificador do servidor **não** vai no corpo, e há um teste só para
isso: quem decide de que servidor é um sinal é a chave, do lado de cá.
Se viesse no corpo, uma chave podia reportar pelo servidor de outra
pessoa.

### O fórum

**A resposta aceite é de quem perguntou, e só.** Nem de quem modera: a
resposta que serviu é um facto de quem tinha o problema, e um moderador
a decidi-lo estaria a dizer por ele o que o resolveu. Um tópico fechado
continua a poder ser marcado — fechar impede respostas novas, e dizer
qual delas serviu é exatamente o que se quer fazer a seguir.

O apontador está **no tópico** e não na resposta, e isso é a diferença
entre uma regra que a base garante e uma que o código tem de lembrar-se
de verificar: marcar outra move o apontador, e não há estado em que duas
estejam aceites. O que a base não garante é o caso do apagar brando —
retirar a resposta aceite limpa a marca, senão o ecrã punha "resolvido"
por cima de um buraco —, e isso está no código com a razão ao lado.

| Rota | Quem pode |
|---|---|
| `POST /api/v1/forum/replies/:replyId/accept` | quem fez a pergunta |
| `DELETE /api/v1/forum/replies/:replyId/accept` | quem fez a pergunta |

**Procurar é `contains`, e não um índice de texto.** É o mesmo mecanismo
do diretório de crews e do de servidores — uma plataforma com três
caixas de procura não deve ter três maneiras de procurar —, e a esta
escala faz o que é preciso: quem escreve "corrida" encontra "corridas",
que um índice sem radicalizador não encontrava.

O que não faz, e é para saber antes de fazer falta: não ordena por
relevância nenhuma, e casa no meio das palavras, por isso "arte" também
aparece em "cartas". No dia em que o fórum tiver milhares de tópicos,
isto passa a ser um índice a sério — com a língua de cada tópico
guardada ao lado dele, para o radicalizador saber o que está a ler.

**As cinco partes são uma lista fechada, e não uma tabela.** Geral, crews,
servidores, roleplay e ajuda: o nome de cada uma aparece no idioma de quem lê,
e uma tabela guardá-lo-ia numa língua só — que é o erro que a descrição dos
planos já fez e que o ecrã de preços teve de contornar. Param nas cinco porque
um fórum que abre com vinte categorias tem dezanove vazias e uma cheia, e quem
chega com uma pergunta passa mais tempo a decidir onde a pôr do que a
escrevê-la.

A lista está escrita em três sítios — o tipo `ForumCategory` do Postgres, que
é quem recusa mesmo; a constante que a API valida; e o browser, que desenha as
abas e traduz os nomes. Não há como gerar uma a partir da outra, porque o tipo
da base nasce numa migração escrita à mão, e por isso há um teste que compara
o ficheiro do esquema com a lista, ordem incluída. A alternativa é descobrir a
diferença quando um tópico novo é recusado com um erro que ninguém sabe ler.

A parte vai **no endereço**, como a procura, e as duas cruzam-se: procurar de
dentro de uma parte procura dentro dela, carregar numa parte não perde a
palavra, e limpar a procura fica onde está. Uma parte escrita à mão que não
exista dá o fórum todo, e não um ecrã de erro por causa de uma letra trocada.

| Rota (prefixo `/api/v1/forum`) | Quem pode |
|---|---|
| `GET /topics?category=` | qualquer pessoa |
| `GET /topics/:topicId` | qualquer pessoa |
| `POST /topics` | `forum:post` |
| `POST /topics/:topicId/replies` | `forum:post` |
| `DELETE /topics/:topicId` | `forum:post` |
| `DELETE /replies/:replyId` | `forum:post` |

**Ler não pede sessão**, e é a decisão que faz o fórum valer a pena: uma
pergunta respondida serve sobretudo quem chega de uma pesquisa sem conta
nenhuma, e fechá-la atrás de um registo faria a plataforma responder à
mesma pergunta vezes sem conta.

Escrever pede sessão **e** `forum:post`, que o cargo de jogador traz. São
duas coisas e não uma: o dia em que for preciso calar alguém sem lhe
apagar a conta, tira-se-lhe a permissão.

**Retirar exige `forum:post` e não `forum:moderate`.** Quem pode retirar
um tópico decide-se no serviço: quem o escreveu, sempre, e quem tem
`forum:moderate`. Exigir a moderação à entrada fechava a porta a quem
quer apagar o que ele próprio escreveu — que é o caso mais comum de
todos, e o que uma pessoa espera poder fazer sem pedir a ninguém.

Retirar marca como apagado e não apaga: as respostas de outras pessoas
ficam, e o registo de que houve ali uma pergunta é o que permite a um
moderador explicar-se mais tarde.

**Escrever leva um limite próprio**, muito mais apertado do que o global
— é a única superfície onde qualquer pessoa registada deixa texto à
vista de toda a gente. Ler não leva limite nenhum: quem navega depressa
não está a abusar de nada.

#### O texto é texto

O que a pessoa escreve fica guardado **letra por letra**, sinais de maior
e de menor incluídos: quem explica um erro de configuração precisa de os
poder escrever. A segurança está em ser **mostrado como texto** e nunca
como HTML. Limpar a marcação ao guardar daria a ideia de que mostrar de
outra maneira passaria a ser seguro, e não passava.

O tamanho é medido **depois** de o texto ser arrumado, e não antes. Sem
isso, quinze quebras de linha e uma palavra passavam o mínimo — contava-se
o que não se ia guardar.

#### Quando alguém apaga a conta

A plataforma promete a quem sai que **o seu texto é apagado**, e o que
escreveu aqui é texto seu — muitas vezes com mais da pessoa lá dentro do
que a biografia alguma vez teve. Por isso o corpo sai com a conta.

O que **fica** é a linha, sem corpo. Um tópico que desaparecesse levava
consigo as respostas de outras pessoas, e uma resposta que desaparecesse
deixava a seguinte a falar com o vazio. Vazio quer dizer "retirado com a
conta", e é assim que aparece no ecrã.

### As notícias da página de entrada

| Rota | Quem pode |
|---|---|
| `GET /api/v1/news` | qualquer pessoa |

O bloco é um **agregador**, e não uma republicação. Mostra o título, um
excerto curto, a fonte à vista e o link para lá — o artigo é de quem o
escreveu, e quem o quiser ler lê-o no sítio dele. É por isso que o
excerto tem um teto de 220 caracteres em `packages/database/src/news.ts`:
**o corte é a funcionalidade**, e não uma poupança de espaço.

A recolha corre num cron, e **não dentro da API**:

```bash
npm run news:fetch
```

Pela mesma razão que a limpeza: com mais do que uma instância, um
temporizador em processo ia buscar o feed em todas ao mesmo tempo — N
pedidos ao site de outra pessoa para mostrar a mesma coisa. De hora a
hora chega.

Sem `NEWS_FEED_URL` a recolha não faz nada e diz porquê, e o bloco não
aparece. É deliberado: **a página de entrada não deve ficar de pé ou no
chão conforme o dia que o site de outra pessoa esteja a ter.**

Nada do que vem do feed é de confiança. Uma entrada sem endereço, sem
título ou sem data é saltada em vez de fazer a recolha falhar; um
endereço que não seja `http` ou `https` é recusado, porque é ele que vai
parar a um `href`; e a marcação e as entidades são desfeitas antes de
guardar, para o que fica ser texto e mais nada.

O mesmo artigo não entra duas vezes: um índice único sobre a chave que o
feed lhe dá — ou sobre o endereço, quando ele não dá nenhuma. Passar
duas vezes pelo mesmo feed atualiza o que mudou e não acrescenta nada.

### Recuperar a password e confirmar o email

| Rota | Quem pode |
|---|---|
| `POST /api/v1/auth/password-reset` | qualquer pessoa |
| `POST /api/v1/auth/password-reset/confirm` | quem tiver o link |
| `POST /api/v1/auth/email-verification` | a própria conta |
| `POST /api/v1/auth/email-verification/confirm` | quem tiver o link |

```bash
SMTP_URL=smtp://utilizador:password@host:587   # opcional
MAIL_FROM="ViceHub <no-reply@vicehub.com>"
APP_PUBLIC_URL=https://app.vicehub.com         # base dos links do email
PASSWORD_RESET_TTL_SECONDS=3600
EMAIL_VERIFICATION_TTL_SECONDS=86400
```

Os dois fluxos partilham a mesma mecânica — um segredo aleatório que
segue por email, guardado apenas em **resumo**, de uso único e com prazo
— e diferem no que autorizam: um abre a conta, o outro só confirma que o
endereço é mesmo daquela pessoa.

**O email sai na língua de quem o recebe.** Os dois pedidos levam um
campo `locale` — `en`, `pt`, `es` ou `fr` —, e o email é escrito nessa
língua. O campo é opcional: um pedido sem ele sai em inglês, que é o
idioma em que o produto abre, e não em português.

A escolha de idioma não fica guardada na conta, e é decisão: ela é deste
browser, porque quem usa o telemóvel em francês e o portátil em inglês
tem razão nos dois. O que vai no pedido é a língua do ecrã que o fez.
Esta é a única coisa que a API escreve diretamente a uma pessoa — tudo o
resto passa por um ecrã, e há um teste na web que impede as mensagens da
API de lá chegarem.

**O pedido não diz quem tem conta.** Pedir a recuperação de um endereço
que não existe responde exatamente como um que existe. Distinguir os dois
casos daria a qualquer pessoa uma forma de listar quem está registado
— basta experimentar endereços — e essa lista vale dinheiro a quem faz
phishing. Pela mesma razão, um link inexistente, um já usado e um fora do
prazo dão todos o mesmo erro.

**Recuperar a conta derruba as sessões abertas.** Quem recupera uma conta
costuma fazê-lo por desconfiar de que outra pessoa lá entrou; trocar a
password sem expulsar essa pessoa resolveria a metade errada do problema.
A `tokenVersion` sobe (os access tokens já emitidos deixam de valer) e as
sessões são revogadas. Confirmar um email não faz nada disto: não abre a
conta a ninguém.

**O token é gasto antes de a password mudar**, e a escrita que o gasta
leva a condição no `where`. Dois pedidos com o mesmo link ao mesmo tempo
passariam ambos por uma verificação feita numa leitura anterior, e o
segundo escreveria uma password que quem recuperou a conta não escolheu.

**Pedir um link novo mata o anterior.** De outra forma, um email antigo
continuaria a abrir a conta muito depois de a pessoa ter pedido outro
precisamente por desconfiar do primeiro.

**O resumo é SHA-256, não argon2.** O que protege estes tokens são os 32
bytes aleatórios de que são feitos, não o custo de os calcular: não há
aqui nada para adivinhar por dicionário, ao contrário de uma password
escolhida por uma pessoa. O resumo existe para que quem leia a tabela não
saia de lá com a chave de nenhuma conta.

**Estas rotas têm um limite próprio**, muito mais apertado do que o
global (`AUTH_RECOVERY_RATE_LIMIT_MAX`, cinco em quinze minutos). Pedir
recuperações em massa é a forma barata de usar a plataforma para encher a
caixa de correio de outra pessoa, e de arder a quota do fornecedor de
email a caminho disso.

**Sem `SMTP_URL` os emails ficam no log** e a plataforma arranca na mesma
— o que serve para desenvolver e para os testes, e é como se segue o
fluxo até ao fim sem servidor de correio nenhum. Não serve para
utilizadores a sério: um link de recuperação escrito no log é um link ao
alcance de quem lê logs. O arranque avisa quando é esse o caso.

### Valores BigInt nas respostas

O `xp` e o `balance` são `BigInt` no schema Prisma. O JSON não tem inteiros
de precisão arbitrária, por isso a API devolve-os **como string**:

```json
{ "xp": "9007199254740993", "wallet": { "balance": "1500" } }
```

Converter para número perderia o valor exato acima de
`Number.MAX_SAFE_INTEGER`, o que num sistema com economia e transações é
inaceitável. O cliente deve tratá-los como string ou `BigInt`, nunca como
`Number`.

A conversão é global, feita num hook `preSerialization`, pelo que nenhuma
rota precisa de se lembrar dela. Quando forem adicionados schemas de
resposta, os campos `BigInt` devem ser declarados como `type: 'string'`.

### O frontend

`apps/web` — React com Vite. Arranca com `npm run dev --workspace=@vicehub/web`
e serve em `http://localhost:5173`.

O servidor de desenvolvimento **encaminha `/api` para a API**. Não é
conveniência: o refresh token vive num cookie `HttpOnly` com `SameSite`, e um
cookie posto por `localhost:3000` não segue num pedido feito a partir de
`localhost:5173`. Servir as duas coisas na mesma origem faz o browser tratá-las
como o mesmo sítio, que é o que acontece em produção.

Ecrãs existentes: autenticação completa, o diretório de crews e de
servidores, o perfil de cada um, criar/registar, as minhas crews, o meu
perfil, o perfil público de um jogador, a tesouraria de uma crew, e os eventos.

**Inscrever-se e ter presença confirmada são coisas diferentes**, e o
ecrã separa-as de propósito. Só quem organiza pode afirmar que alguém
esteve lá, e é essa afirmação — não a inscrição — que dá direito a
receber quando a crew divide os ganhos por participação. O peso vai ao
lado da confirmação: quem lidera um assalto costuma levar mais.

O ecrã só oferece as transições que o estado atual aceita. Um evento
terminado não volta a decorrer, e oferecer o botão daria um erro que se
lê como avaria em vez de como "isso não se faz". Pela mesma razão, o
convite a inscrever-se não reaparece a quem já tem lugar.

**Os montantes são texto do princípio ao fim.** São `BigInt` na base de
dados e a API manda-os em texto de propósito; convertê-los no cliente
para os somar ou formatar apagaria o cuidado que a API teve. A função
que os formata recebe texto e devolve texto — nada de `Number`, nada de
`toLocaleString` — e o separador de milhares é um espaço inquebrável,
porque um montante partido ao meio lê-se como outro montante. O tamanho
do saldo em destaque acompanha o comprimento do número, para que
dezanove dígitos caibam num telemóvel em vez de ficarem cortados — e é
uma classe, não um `style`, porque a política de conteúdo com que a
aplicação é servida recusa estilos escritos dentro da página.

**A tesouraria mostra quatro saldos, e não um.** Sem os outros três
ninguém sabe quanto pode gastar: o liquidado não desconta o que já foi
autorizado a sair, e comprometer duas vezes o mesmo dinheiro é o erro
que se segue.

**O ecrã do premium vê-se sem conta.** Quem ainda não a tem é
precisamente quem precisa de saber o preço antes de a criar. O que muda
com a sessão é o que se pode fazer: sem conta, o convite a criá-la; com
conta e sem plano, o botão de compra; com vitalício, nem um nem outro —
pedir dinheiro por uma coisa que já foi oferecida é a espécie de erro que
ninguém repara e toda a gente acha mal.

**Com a compra fechada, o aviso vem antes do convite a criar conta.** A
compra não estar aberta é um facto da instalação, e não da pessoa: pela
ordem contrária, quem chegasse de fora criava conta para comprar uma coisa
que ainda não se vende, e só descobria isso depois de dar o email.

**O preço divide por cem, e a tesouraria nunca divide nada.** O que muda é
o que está a ser contado: a moeda do jogo vai a dezanove dígitos e viaja
como texto do princípio ao fim, porque `Number` a partiria; o preço do
plano é dinheiro a sério em cêntimos, vindo do Stripe, e nunca chega perto
do limite.

**O plano de uma comunidade compra-se a partir dela.** O ecrã do premium
aceita `?crew=<id>` e `?servidor=<id>`, e é o titular do endereço que
decide tudo: o nome no título, o plano que se consulta, e a quem vai a
compra. Sem isso, quem
viesse da página de uma crew comprava para si próprio e a crew continuava
sem nada — e ninguém repararia até ir procurar a personalização, que
continuava recusada. O que o plano dá também muda: dizer "personaliza o
teu perfil" a quem compra para uma crew é falar do produto errado à
pessoa certa.

**O titular é resolvido num sítio só.** Crews e servidores diferem no
endereço que se consulta e no substantivo das frases, e mais nada — por
isso a página resolve um titular à entrada (tipo, identificador, nome, se
tem plano, para onde voltar) e o resto lê só isso. Perguntar "é crew? é
servidor?" em cada linha faria um terceiro tipo de titular espalhar um
terceiro ramo por toda a página.

**As frases de cada titular são escritas por inteiro, e não montadas.**
Interpolar o substantivo — "o plano é da {comunidade}" — parte a
concordância de género assim que sai do inglês: diz-se "da crew" e "do
servidor". Cada idioma escreve as duas versões, e o ecrã escolhe qual
serve.

**O que a crew mostra do plano é se o tem, e não qual.** O perfil público
não diz a espécie de plano — isso diria a qualquer pessoa quais das crews
receberam o vitalício. Para a decisão em jogo, ter plano ativo chega.

**O formulário da personalização vive num sítio só**, em
`appearance/appearance-form.tsx`, e serve pessoas, crews e servidores. As
regras são as mesmas nos três: a cor é um hexadecimal de seis dígitos, o
campo vazio limpa em vez de deixar como está, e um **402 não é avaria** —
é a API a dizer que isto é do plano. Três cópias divergiriam, e a que
divergisse mostrava um erro genérico onde devia dizer o que falta.

**A personalização premium aparece a toda a gente**, e não só a quem tem
plano. Escondê-la faria com que quem recebe o premium não soubesse que
ganhou alguma coisa — e é precisamente isso que os primeiros
utilizadores vão receber. Sem plano, a API responde **402**, que o ecrã
lê como "isto é do plano" e não como avaria: um 402 diz que falta o
pagamento, não que algo correu mal.

**Um plano sem data de fim é vitalício.** A ausência da data é o que
distingue os dois casos, e por isso não é tratada como dado em falta.

**A mecânica de adesão vive num sítio só**, em `lib/membership.ts`.
Crews e servidores partilham-na por inteiro — candidatar, retirar, sair,
responder a candidaturas, remover, mudar cargo — e o que difere é o
prefixo do endereço. Está lá em vez de copiada porque **decide
permissões**: duas cópias de lógica de permissões acabam por divergir, e
a que divergir em silêncio é a que abre a porta errada.

**No telemóvel os destinos vivem numa barra em baixo.** Três links não
cabem no topo de um ecrã de 390px sem cortar o último, e em baixo estão
ao alcance do polegar. A partir dos 640px sobem para o topo.

**A raiz é pública.** É o endereço que se dá a alguém, e essa alguém
ainda não tem conta — antes disto caía numa caixa de início de sessão sem
nada que dissesse o que isto é. Quem já entrou não precisa da
apresentação e vai direto ao perfil.

O diretório e o perfil de uma crew são públicos pela mesma razão. O que
exige sessão é agir sobre eles.

**As candidaturas pendentes aparecem em "Onde pertenço"** de propósito:
sem isso, quem pede entrada não tem forma de saber se já foi respondido, e
é essa pergunta que faz a pessoa voltar ao site. Esse ecrã mostra crews e
servidores juntos — a função que ia buscar as adesões a servidores já
existia e não era chamada por ninguém, o que costuma ser sinal de um ecrã
que ficou por fazer.

**Quem gere membros descobre-se perguntando à API.** O ecrã de uma crew
pede a lista de candidaturas e trata o 403 como "não és tu que geres
isto", em vez de deduzir o cargo de outro sítio. Assim o que aparece é
sempre a permissão real, e um 403 esperado não é mostrado como avaria.

**A interface fala quatro idiomas**: inglês, português, espanhol e
francês. O inglês é a fonte de verdade — é dele que sai o tipo
`Messages`, e os outros três são tipados contra ele, por isso **uma
chave em falta é erro de compilação** em vez de texto em falta no ecrã.

O idioma de quem chega vem da preferência do browser (`pt-BR` vale tanto
como `pt`) e cai no inglês quando não reconhece nenhum. A escolha do
seletor fica guardada neste browser, e não na conta: quem usa o telemóvel
em francês e o portátil em inglês tem razão nos dois.

**Uma chave de tradução que ninguém usa também é erro.** O TypeScript
apanha as que faltam; um teste apanha as que sobram, lendo o dicionário
inglês e o código que o consome. Sem ele, uma tradução para um ecrã
apagado ficava lá a ser traduzida para quatro idiomas de cada vez que
alguém passasse por ela.

**Os plurais vêm do `Intl.PluralRules`, e não de um `n === 1 ? a : b`.**
Zero não se comporta da mesma maneira nos quatro: em português e em
francês usa a forma singular, em inglês e em espanhol a plural. Escrito à
mão, acerta em dois idiomas e falha nos outros dois em silêncio. É também
por isso que as formas singulares de pt e fr interpolam o número em vez
de escreverem "1" — nesses idiomas, a forma singular também tem de saber
dizer zero.

O separador de milhares dos montantes é o do idioma — vírgula em inglês,
ponto em português e espanhol, espaço fino em francês — e vem do `Intl`
sem que o montante lhe toque: pede-se ao `Intl` como agruparia um
milhão, lê-se o carácter que ele usou, e é só o carácter que se pede
emprestado. O valor continua a ser texto do princípio ao fim.

**O código continua em português** — identificadores e comentários. O que
mudou de idioma foi a interface, não a equipa que a escreve.

**Mobile-first.** As regras base do CSS servem o telemóvel; as media queries só
acrescentam à medida que há largura. Os campos têm 16px de texto — abaixo disso
o Safari do iPhone dá zoom ao campo mal lhe tocam — e os alvos de toque têm 48px
de altura.

**A política de conteúdo não leva `'unsafe-inline'` nem `'unsafe-eval'`**,
que é o que separa um XSS de uma execução. Abre-se exatamente ao que a
aplicação usa — a própria origem, mais os dois domínios do Google Fonts.

Vale a pena saber onde a linha passa, porque não é onde parece: a
política **não governa o CSSOM**. Um `style` do React — a cor de destaque
de uma crew, que é dado de quem a criou — é aplicado propriedade a
propriedade e passa. O que ela recusa é o atributo `style` que chega como
*markup*: `setAttribute('style', …)` e, sobretudo, HTML injetado com
`innerHTML`. Ou seja, trava exatamente o vetor de um XSS e não estorva a
personalização, que é a distinção que interessa. Um teste garante que
nenhum componente usa `dangerouslySetInnerHTML`, que é a porta por onde
isso voltaria a entrar.

**O access token vive em memória, e só em memória.** No `localStorage` ou num
cookie legível por script ficaria ao alcance de qualquer coisa que a página
venha a carregar: uma biblioteca comprometida, uma extensão, um XSS. Em memória
morre com o separador. O que sobrevive a um F5 é o refresh token, que está num
cookie `HttpOnly` que o JavaScript não lê — ao arrancar, a aplicação troca-o por
um access token novo.

**A renovação da sessão nunca corre duas vezes em paralelo.** A API roda o
refresh token a cada utilização e trata uma segunda utilização do mesmo token
como roubo: derruba a sessão inteira. Um ecrã com três pedidos ao mesmo tempo e
o access token expirado levaria três 401 — e três renovações com o mesmo cookie
fariam o próprio utilizador parecer um atacante. O cliente guarda a renovação em
curso e faz os outros pedidos esperar por ela.

**O segredo dos links de email não fica na barra de endereços.** As páginas de
recuperação leem o token da query string e apagam-no logo com `replaceState`.
Um token no endereço fica no histórico, aparece numa captura de ecrã, e seguiria
no `Referer` de qualquer recurso que a página fosse buscar lá fora — o
`index.html` declara `referrer: no-referrer` pela mesma razão.

**O ecrã não pode desfazer o que o servidor garante.** O pedido de recuperação
mostra sempre a mesma confirmação, exista ou não a conta, e engole o erro de
propósito: distinguir os dois casos na interface daria a qualquer pessoa a lista
de quem está registado. Pela mesma razão, o diretório não envia uma pesquisa
vazia — a API só devolve destaques quando não há pesquisa, e um `search=` vazio
fá-los-ia desaparecer sem ninguém ter pesquisado nada.

**Dois carregamentos que se cruzem não trocam de resultado.** Mudar de crew antes
de a primeira responder cruza dois pedidos; sem proteção, a resposta lenta do
primeiro chega depois e substitui a do segundo, e o ecrã fica a mostrar a crew
errada sem nada a indicar que está errada. O `useAsync` guarda o número do pedido
e só deixa o último escrever no estado.

`/recuperar-password` serve as duas metades: com código no link pede a password
nova, sem código pede o email. É por isso que é esse o endereço que segue nos
emails.

### Pôr em produção

Nada disto foi automatizado de propósito: quem faz o deploy é uma pessoa, uma
vez, e o que interessa é que as armadilhas estejam identificadas.

```bash
npm ci
npm run build                    # database, api e web
npm run db:migrate:deploy        # aplica as migrações pendentes
npm run db:seed                  # só na primeira vez
npm start                        # node apps/api/dist/server.js
```

**Sem o `db:seed` numa base de dados vazia, a API recusa arrancar.** O cargo
base de jogador é atribuído a quem se regista e não pode ser atribuído se não
existir, por isso a pergunta é feita ao arranque e não ao primeiro registo:

```
A base de dados não está pronta:

  O cargo base "player" não existe na base de dados, e sem ele ninguém consegue criar conta.
  Resolve com:  npm run db:seed
```

Num serviço que reinicia sozinho — o Railway, por exemplo — isto aparece como
um processo que não fica de pé. A razão está na primeira linha do log.

#### Neon, Railway e Vercel

A repartição escolhida: a base de dados no **Neon**, a API no **Railway**, a
interface no **Vercel**. O repositório traz a configuração dos dois últimos —
`railway.json` e `vercel.json` — e o que falta é o que não pode estar aqui: as
chaves, e os domínios.

**Os domínios não são um detalhe.** O refresh token vive num cookie
`SameSite=strict`: ele segue num pedido de `vicehub.com` para
`api.vicehub.com`, porque é o mesmo site registável, e **não segue** de
`vicehub.vercel.app` para `vicehub.up.railway.app`, porque não é. Com os nomes
por omissão dos dois serviços, o login funciona, o refresh devolve 401 e a
sessão morre a cada F5 — sem nada no ecrã a explicar porquê. Os domínios
próprios não são acabamento: são o que faz a sessão existir.

A ordem, uma vez:

1. **Neon.** Criar o projeto e guardar os dois endereços que ele dá — o do pool
   de ligações e o directo. `DATABASE_URL` leva o do pool, que é o que uma API
   deve usar; `DIRECT_DATABASE_URL` leva o directo, que é por onde as migrações
   têm de correr. As migrações correm num *advisory lock* e em sessões longas, e
   um pool em modo de transação não garante nem uma coisa nem outra: a migração
   ou falha, ou fica pendurada, e é sempre a meio de um deploy.

2. **Railway**, apontado a este repositório. O `railway.json` já diz o resto:
   compila, corre `db:migrate:deploy` antes de trocar de versão, arranca, e a
   sonda de prontidão é `/api/v1/health/ready`. As variáveis a preencher no
   painel são as do `.env.example` — e **`WEB_DIST_PATH` fica por definir**: aqui
   quem serve a interface é o Vercel.

3. **`npm run db:seed`, uma vez, contra a base nova.** Sem ele a API recusa
   arrancar, e diz-o na primeira linha do log com o comando que resolve: o
   cargo base de jogador é atribuído a quem se regista e não pode ser
   atribuído se não existir.

4. **Vercel**, apontado ao mesmo repositório, com a raiz do projeto na raiz do
   repositório — o `vercel.json` já traz o comando de compilação, a pasta de
   saída e a reescrita que faz um F5 em `/crews/alguma-coisa` devolver a página
   em vez de 404.

5. **Os domínios**, e as duas linhas que têm de os nomear: `connect-src` no
   `vercel.json`, para o browser poder falar com a API, e `CORS_ALLOWED_ORIGINS`
   no Railway, para a API aceitar o browser. Um teste (`mesma-politica.test.ts`)
   compara as duas políticas de conteúdo directiva a directiva — a que a API
   serve e a que o Vercel serve — e falha quando divergem em tudo o resto.

6. **O Stripe**, por fim: os quatro preços, o portal do cliente, e o webhook a
   apontar para `https://api.vicehub.com/api/v1/billing/webhook`. O segredo do
   webhook vai para o Railway e para lado nenhum mais.

7. **O ensaio, contra o que acabou de ficar de pé**, antes de dizer a alguém
   que abriu:

   ```bash
   npm run ensaiar --workspace @vicehub/api -- --base=https://api.vicehub.com
   ```

   Cria uma conta, renova a sessão pelo cookie, funda uma crew e um servidor,
   abre um tópico, põe um anúncio, vê os ecrãs que isso produz, e depois apaga
   tudo o que criou e a própria conta. Um ensaio limpo diz que a instalação
   serve; um 401 na renovação diz que os domínios não são o mesmo sítio
   registável; e um 500 no registo diz que o `db:seed` não correu.

**A política de conteúdo passa a estar em dois sítios.** Servida pela API, sai
do `helmet`; servida pelo Vercel, é uma linha de configuração, porque um
serviço de estáticos não corre código. As duas têm de dizer o mesmo, e o teste
acima é o que garante que continuam a dizer. A diferença legítima é uma só: o
`connect-src`, que na API é `'self'` e no Vercel tem de nomear o domínio dela.

**As notícias correm à parte.** `npm run news:fetch` num cron — do Railway ou
do GitHub — e não dentro da API: a página de entrada não deve ficar de pé ou no
chão conforme o dia que o site de outra pessoa esteja a ter.

#### A aplicação e a API têm de estar no mesmo domínio

Não é preferência de arrumação. O refresh token vive num cookie
`SameSite=strict`, e um cookie posto por `api.vicehub.com` **não segue** num
pedido feito a partir de `vicehub.com`. Separados, a sessão morre a cada F5 e
nada no ecrã explica porquê — o login funciona, o refresh devolve 401, e parece
avaria.

Há duas formas de os juntar, e a mais simples é a API servir a interface:

```bash
WEB_DIST_PATH="apps/web/dist"    # relativo à pasta onde o processo corre
```

Com isto, um processo só serve tudo: `/api/*` é a API, a raiz e os endereços do
router são a página, e `/assets/*` são os ficheiros com o resumo do conteúdo no
nome — guardados para sempre, porque um deploy novo pede nomes novos. O
`index.html` nunca é guardado: o nome é o mesmo entre deploys, e um em cache
continuaria a pedir os ficheiros do anterior.

Um caminho errado aqui **impede a API de arrancar**. É deliberado: sem isso, a
API subia bem e o site respondia 404 a toda a gente, e o pior sítio para
descobrir um erro de configuração é o browser de quem chega.

A outra forma é um proxy à frente — nginx, Caddy, o que for — a mandar `/api`
para a API e tudo o resto para o `apps/web/dist`, **com o `index.html` a
responder por tudo o que não é ficheiro**. Sem essa regra, um F5 em
`/crews/alguma-coisa` dá 404: esse endereço só existe dentro do router do
browser. Nesse caso, deixa-se o `WEB_DIST_PATH` por definir.

#### A configuração que a API recusa em produção

Duas variáveis são perigosas precisamente por terem um valor por omissão que
funciona. Com `NODE_ENV=production`, a API **recusa arrancar** sem elas:

| Variável | Porquê |
| --- | --- |
| `AUTH_COOKIE_SECURE="true"` | Sem isto o cookie da sessão não é marcado como `Secure` e viaja também em ligações não cifradas. |
| `APP_PUBLIC_URL="https://…"` | É daqui que sai o endereço dos emails de recuperação. No valor por omissão, manda toda a gente para o `localhost` de quem fez o deploy — e o pedido parece ter corrido bem. |

O `CORS_ALLOWED_ORIGINS` continua obrigatório em qualquer ambiente. Servindo
tudo na mesma origem, não há pedido entre origens para autorizar; fica lá o
domínio a sério na mesma, porque é ele que aparece nos pedidos com `Origin`.

**Sem `SMTP_URL` os emails ficam no log.** Em desenvolvimento serve; em
produção, um link de recuperação escrito no log é um link ao alcance de quem lê
logs, e ninguém recebe nada. Com `NODE_ENV=production` **a API recusa arrancar
sem ela**, pela mesma razão que recusa as outras duas: um aviso no arranque
perde-se entre as outras linhas, e quando se der por ela já há contas
dependentes de emails que nunca saíram.

#### O encerramento avisa antes de fechar a porta

Num deploy rolante, o orquestrador manda `SIGTERM` e o balanceador só fica a
saber que esta instância saiu quando voltar a sondar — segundos depois. Se a
porta fechar primeiro, os pedidos que ele mandar nesse intervalo batem numa
ligação recusada: o deploy dá-se por bem sucedido e quem está do outro lado vê
erros.

Por isso a ordem é ao contrário. Recebido o sinal, a sonda de prontidão passa
logo a responder `503 shutting_down`, a instância continua a servir o que lhe
chegar durante `SHUTDOWN_DRAIN_MS`, e só depois é que fecha.

```bash
SHUTDOWN_DRAIN_MS=10000    # acima do intervalo de sondagem de quem está à frente
```

Zero por omissão, que é o que se quer em desenvolvimento: o `Ctrl+C` é para ser
imediato, e não há balanceador nenhum à espera de ser avisado.

**A sonda de vida continua a responder 200 durante a espera**, e isso é de
propósito: uma sonda de vida a falhar faz o orquestrador **reiniciar** o
processo — desfazendo exatamente o que ele está a tentar fazer, e matando as
ligações que estava a servir.

As duas sondas, para quem configura o orquestrador:

| Sonda | Endereço | O que significa falhar |
| --- | --- | --- |
| Vida | `GET /api/v1/health` | O processo não responde. Reiniciar. |
| Prontidão | `GET /api/v1/health/ready` | Não consegue fazer o trabalho, ou está de saída. Tirar da rotação, não reiniciar. |

#### O que não tem dono automático

- **A limpeza dos tokens e das sessões expiradas** existe, mas não se
  agenda sozinha. Nada quebra por não correr — um token expirado é recusado
  na mesma —, mas são as três tabelas que mais crescem: cada login abre uma
  sessão, cada renovação escreve um refresh token, e cada pedido de
  recuperação escreve um token de conta.

  ```bash
  npm run db:prune            # apaga
  npm run db:prune -- --seco  # só conta, não apaga
  ```

  Põe-se num cron, uma vez por dia. **Não corre dentro da API de propósito:**
  com mais do que uma instância, um temporizador em processo correria em
  todas ao mesmo tempo, e o que se quer é uma passagem, não N.
- **As notícias não se recolhem sozinhas.** O `npm run news:fetch` vai ao
  feed e guarda o que for novo. Põe-se num cron, de hora a hora. Sem ele
  o bloco da página de entrada fica com o que lá estava da última vez —
  ou vazio, se nunca correu.

- **O primeiro administrador nasce da base de dados**, e não da API: nenhuma
  rota concede `system:manage`, porque a primeira conta a poder nomear
  administradores seria a porta que o cargo existe para guardar.

  ```bash
  npm run admin:grant -- eu@exemplo.com
  ```

- **Os planos vitalícios são dados à mão**, um a um, por quem tem
  `system:manage`, em `POST /api/v1/subscriptions/grant`. Não há caminho
  automático para eles, e é assim de propósito.

### Nota sobre as optionalDependencies da raiz

O `package.json` da raiz declara explicitamente os binários de plataforma do
`esbuild`, do `rolldown` e do `lightningcss`. **Não os remover.**

O npm só escreve no `package-lock.json` o binário da plataforma onde o
install é executado. Sem esta declaração, um lockfile gerado em Windows
deixa o `npm ci` em Linux sem os binários necessários, e o `tsx` e o
`vitest` passam a falhar no CI com um erro de módulo em falta. Declará-los
garante que o lockfile fica completo, seja gerada em que plataforma for.

O `lightningcss` entrou com o `vite`, que o usa para minificar CSS. Sem o
binário da plataforma o `npm run build` do `apps/web` falha com um módulo
`.node` em falta — e falha só no build, o que o torna fácil de não notar
em desenvolvimento.

Ao atualizar o `vitest`, o `tsx` ou o `vite`, confirmar se as versões do
`esbuild`, do `rolldown` e do `lightningcss` mudaram e acertar estas versões em
conformidade.

---

## 📦 Estado atual

🚧 Em desenvolvimento, ainda sem ninguém a usar

### O que está feito

✔ Base de dados, autenticação e autorização: sessões validadas na base de
dados, refresh token com rotação e deteção de reutilização, cookie HttpOnly,
terminar todas as sessões e permissões por papel  
✔ Recuperação de password e confirmação de email  
✔ Perfis, crews, servidores, eventos e tesouraria, com ecrã para cada um  
✔ Entrar com Discord e com Google  
✔ Levar os dados embora e apagar a conta, com o saldo a perder-se — a
exportação leva tudo o que a plataforma tem, anúncios e avisos incluídos  
✔ Cobrança pelo Stripe: checkout, webhooks, portal para cancelar o plano e
entitlements que o servidor calcula sozinho  
✔ Interface em quatro idiomas, com o inglês por omissão, sem misturar dois
no mesmo ecrã  
✔ Fórum com moderação inteira: retirar, fechar a conversa, denunciar, e uma
fila por onde as denúncias chegam a alguém  
✔ **Mercado de cada servidor**: catálogo com categorias, anúncio com imagem e
preço em moeda de jogo, conversa privada entre quem compra e quem vende,
avaliação depois da venda e a nota do vendedor ao lado do nome  
✔ **Uma fila de moderação só** para as cinco espécies de coisa que se
denunciam, com o historial do que já foi decidido sobre cada pessoa — a contar
publicações decididas, e não denúncias recebidas  
✔ **Avisos**: a plataforma diz a quem lhe falaram, com a contagem a acertar-se
sozinha enquanto a pessoa navega  
✔ **Histórico de actividade dos servidores**, hora a hora, com a média dos
sete dias e a tira do dia no perfil de cada um  
✔ Confirmação anti-robô à entrada — no login, no registo e no pedido de
recuperação — e desligada por omissão, sem script de terceiros nenhum  
✔ Caminho de produção verificado: a API serve a interface na sua própria
origem, tem sonda de arranque separada da de prontidão, e recusa arrancar com
a configuração que só faz mal em produção  
✔ **Quadro de classificação de cada servidor**: as crews que lá jogam, por xp,
com quem está empatado a partilhar o lugar — o xp já subia com os eventos, e
faltava o sítio onde ele quer dizer alguma coisa a alguém  
✔ **Cinco partes no fórum** — geral, crews, servidores, roleplay e ajuda —,
com a parte no endereço e a procura a cruzar-se com ela  
✔ Página de preços que diz a escada toda, venha ou não a cobrança configurada:
quanto custa é do catálogo e sabe-se sempre; saber cobrar é da instalação  
✔ **Quatro ferramentas que o CI não corre**, todas com controlo: uma varredura
que abre os trinta e um ecrãs num browser em quatro idiomas e duas larguras,
uma sonda que tenta com a conta de outra pessoa tudo o que um dono pode fazer,
uma medição do que cada ecrã custa à base de dados, e um ensaio de instalação
nova que se desfaz a si próprio — `varrer`, `sondar`, `medir` e `ensaiar`

### O que falta para abrir ao público

🚀 **O deploy.** Isto nunca correu fora de uma máquina de desenvolvimento. Não
há máquina, não há domínio, não há cópias de segurança. A sequência **está
ensaiada**: contra uma base de dados vazia, com `NODE_ENV=production`, as
migrações correm, o `db:seed` grava, a API arranca, e o `npm run ensaiar`
passa do registo ao anúncio e volta atrás sem deixar nada — mais o `db:prune`,
o `news:fetch` e o `admin:grant`, que são os comandos que correm sozinhos
depois. O que o ensaio não prova é o Neon, o Railway, o Vercel e os domínios:
esses só se provam com eles à frente. Os passos e as armadilhas estão escritos
em [Pôr em produção](#pôr-em-produção)  
🔑 **As chaves e o domínio**: os quatro preços do Stripe e o portal do cliente,
o SMTP, o Turnstile, as credenciais do Discord e da Google. Nenhuma delas pode
passar por uma conversa — vão do painel de quem as emite para o `.env` do
servidor e mais lado nenhum, porque este repositório é público  
🔑 **`npm run db:seed` na base de dados do deploy.** Sem ele a API recusa
arrancar — não há cargo base para dar a quem se regista — e as duas permissões
do mercado não existem  
⚖️ **A identificação legal de quem opera** — `apps/web/src/legal/operator.ts`
está vazio nos sete campos, e enquanto estiver as páginas de termos e de
privacidade dizem, em cima e com todas as letras, que não são definitivas  
💶 **A metade do mercado com dinheiro a sério**, que continua sem código
nenhum e de propósito: o que está feito move moeda de jogo, e a outra metade é
uma decisão de produto antes de ser uma de engenharia

---

## 📜 Licença

Privada / comercial (por definir)