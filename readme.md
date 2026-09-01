# 🚀 ViceHub

ViceHub is a **modular SaaS ecosystem for online gaming communities**, initially focused on GTA VI, designed to scale into a multi-game platform.

It acts as a **second screen for players**, combining social networking, progression systems, crew management, server ecosystems, real-time economy and a full digital marketplace.

---

## 🧠 Vision

To become the central platform where gaming communities interact, grow, compete and trade — all in one unified ecosystem.

---

## ⚙️ Core Features (Planned)

### 👤 Players
- XP & Level system
- Reputation & Prestige
- Badges & Achievements
- Friends & Social graph
- Activity tracking

### 🏴 Crews
- Crew progression system
- Economy & treasury
- Events & missions
- Recruitment system
- Ranking system

### 🌐 Servers
- Server profiles
- Activity tracking
- Leaderboards
- Events integration
- Community engagement metrics

### 🛒 Marketplace
- Digital services trading
- Escrow system
- Stripe Connect integration
- Reviews & reputation system

### 🎮 Events System
- Live events
- Rewards & XP distribution
- Competitive challenges
- History tracking

---

## 🏗️ Architecture

- Monorepo (npm workspaces)
- Node.js + TypeScript
- Fastify backend (planned)
- PostgreSQL + Prisma 7
- Redis for real-time systems
- BullMQ for background jobs
- Stripe for payments
- Discord API integration

---

## 🔐 Security

- JWT + Refresh Tokens
- RBAC (Role-Based Access Control)
- Soft delete + audit logs
- Rate limiting
- Input validation (Zod)
- Bloqueio temporário da conta após tentativas de login falhadas

---

## 🎨 UI/UX

- Neon cyberpunk theme inspired by Vice City
- Dark mode first
- Glassmorphism HUD interface
- Mobile-first design
- Real-time dashboard experience

---

## 🛠️ Desenvolvimento

### Requisitos

- Node.js 24 ou superior
- npm 11 ou superior
- PostgreSQL (local ou Neon)

### Arranque

```bash
npm ci
cp apps/api/.env.example .env   # preencher DATABASE_URL e os segredos JWT
npm run db:generate             # gera o Prisma Client
npm run build                   # compila os packages
npm run db:migrate:dev
npm run db:seed                 # cargos e permissões base
npm run dev
```

O `.env` é lido a partir da raiz do monorepo.

**O `npm run build` não é opcional.** A API importa `@vicehub/database`, que
resolve para `packages/database/dist`, e esse diretório não é versionado. A
ordem também conta: o `db:generate` vem antes, porque a compilação do package
`database` precisa dos tipos do Prisma Client.

Depois de um `git pull` que traga alterações a `packages/database`, volta a
correr `npm run db:generate && npm run build`. O sinal de que falta é o
TypeScript queixar-se de que `@vicehub/database` não exporta algo que
claramente lá está — está, mas no código-fonte, não no `dist` compilado.

### Verificação

```bash
npm run build      # packages antes de apps, por ordem de dependência
npm run typecheck
npm run test       # não precisa de base de dados
```

Os testes usam duplos em memória em vez do Prisma, por isso correm em
qualquer máquina sem preparação. O mesmo conjunto de comandos corre no CI,
em `.github/workflows/ci.yml`.

### Autorização por permissões

Os cargos e permissões estão definidos num só sítio,
`packages/database/src/rbac.ts`. É esse catálogo que alimenta o
`db:seed` e é dele que a API importa as permissões, pelo que o que está
gravado e o que o código exige não podem divergir.

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

### Perfis de utilizador

| Rota | Autenticação | Devolve |
|---|---|---|
| `GET /api/v1/users/:username` | não | perfil público |
| `GET /api/v1/users/me` | sim | perfil do próprio |
| `PATCH /api/v1/users/me` | sim | perfil atualizado |
| `PATCH /api/v1/users/me/appearance` | sim, **com plano ativo** | perfil atualizado |

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

### Nota sobre as optionalDependencies da raiz

O `package.json` da raiz declara explicitamente os binários de plataforma do
`esbuild` e do `rolldown`. **Não os remover.**

O npm só escreve no `package-lock.json` o binário da plataforma onde o
install é executado. Sem esta declaração, um lockfile gerado em Windows
deixa o `npm ci` em Linux sem os binários necessários, e o `tsx` e o
`vitest` passam a falhar no CI com um erro de módulo em falta. Declará-los
garante que o lockfile fica completo, seja gerada em que plataforma for.

Ao atualizar o `vitest` ou o `tsx`, confirmar se as versões do `esbuild` e do
`rolldown` mudaram e acertar estas versões em conformidade.

---

## 📦 Current Status

🚧 Early development stage  
✔ Database core architecture implemented  
✔ Authentication implemented: sessões validadas na base de dados, refresh
token com rotação e deteção de reutilização, cookie HttpOnly e logout global  
🚀 Gestão de utilizadores e RBAC a seguir  

---

## 📜 License

Private / Commercial (to be defined)