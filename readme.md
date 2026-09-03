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

### Cobrança pelo Stripe

| Rota | Quem pode |
|---|---|
| `POST /api/v1/billing/checkout` | qualquer conta |
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
dezanove dígitos caibam num telemóvel em vez de ficarem cortados.

**A tesouraria mostra quatro saldos, e não um.** Sem os outros três
ninguém sabe quanto pode gastar: o liquidado não desconta o que já foi
autorizado a sair, e comprometer duas vezes o mesmo dinheiro é o erro
que se segue.

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

O diretório e o perfil de uma crew são **públicos** — é assim que alguém
de fora descobre a plataforma. O que exige sessão é agir sobre eles.

**As candidaturas pendentes aparecem em "As minhas crews"** de propósito:
sem isso, quem pede entrada não tem forma de saber se já foi respondido, e
é essa pergunta que faz a pessoa voltar ao site.

**Quem gere membros descobre-se perguntando à API.** O ecrã de uma crew
pede a lista de candidaturas e trata o 403 como "não és tu que geres
isto", em vez de deduzir o cargo de outro sítio. Assim o que aparece é
sempre a permissão real, e um 403 esperado não é mostrado como avaria.

**Mobile-first.** As regras base do CSS servem o telemóvel; as media queries só
acrescentam à medida que há largura. Os campos têm 16px de texto — abaixo disso
o Safari do iPhone dá zoom ao campo mal lhe tocam — e os alvos de toque têm 48px
de altura.

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

## 📦 Current Status

🚧 Early development stage  
✔ Database core architecture implemented  
✔ Authentication implemented: sessões validadas na base de dados, refresh
token com rotação e deteção de reutilização, cookie HttpOnly e logout global  
✔ Recuperação de password e confirmação de email  
✔ Frontend arrancado: `apps/web`, com a superfície de autenticação  
🚀 Ecrãs de crews, servidores e tesouraria a seguir  

---

## 📜 License

Private / Commercial (to be defined)