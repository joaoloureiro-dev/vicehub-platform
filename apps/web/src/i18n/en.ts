import type { Tools } from './tools.js';

/**
 * O inglês é a fonte de verdade.
 *
 * É daqui que sai o tipo `Messages`, e os outros idiomas são tipados
 * contra ele: uma chave em falta passa a ser erro de compilação em vez
 * de texto em falta no ecrã. Uma chave a mais também — uma tradução para
 * algo que já não existe fica lá esquecida a fingir que serve.
 */
export const en = (p: Tools) => ({
    comum: {
        aCarregar: 'Loading…',
        aGuardar: 'Saving…',
        guardar: 'Save',
        naoFoiPossivel: 'That did not work. Try again.',
        idioma: 'Language',
    },

    nav: {
        crews: 'Crews',
        servidores: 'Servers',
        asMinhas: 'Mine',
        perfil: 'Profile',
        principal: 'Main navigation',
        recrutamento: 'Recruiting',
        forum: 'Forum',
        premium: 'Pricing',
        entrar: 'Sign in',
        sair: 'Sign out',
    },

    landing: {
        aAcontecer: 'Happening across ViceHub',
        aDecorrerAgora: 'Happening now',
        comecaEm: (quando: string) => `Starts ${quando}`,
        naCrew: (nome: string) => `with ${nome}`,
        titulo: 'Your crew. Your server. Your cut.',
        subtitulo:
            'ViceHub is where gaming communities get organised: run your crew, move what you earn, and prove who actually turned up.',
        criarConta: 'Create your account',
        verRecrutamento: 'Who is recruiting',
        jaTenhoConta: 'I already have an account',

        quemRecruta: 'Crews looking for people',
        agoraOnline: 'Servers online right now',
        verTudo: 'See all',
        jogadores: (n: number) =>
            p.plural(n, { one: '1 player', other: `${n} players` }),
        planosTitulo: 'What it costs',
        planosGratis:
            'Playing is free, and stays free: your profile, your banner, applying to crews, being a member, running events, turning up. What is paid is moving the money.',
        planoCrew: 'Crew',
        planoCrewPreco: '\u20ac4.99 / month',
        planoCrewTexto:
            'A treasury that adds up: propose, approve, and split what the crew earns — everyone paid at once, or nobody. Thirty days free to try it.',
        planoServidor: 'Server',
        planoServidorPreco: '\u20acfrom 14.99 / month',
        planoServidorTexto:
            'Up to 10 crews playing on your server, and a treasury to pay them from. More crews, a bigger plan.',
        crewsTitulo: 'Crews and servers',
        crewsTexto:
            'Bring your people together under ranks that mean something. Applications get answered, not ignored.',

        tesourariaTitulo: 'A treasury that adds up',
        tesourariaTexto:
            'Move in-game earnings by proposal and approval, with four balances so nobody commits the same money twice. Everyone is paid at once, or nobody is.',

        eventosTitulo: 'Paid for turning up',
        eventosTexto:
            'Run the job, confirm who was there, and split the take by attendance — with weights, because whoever leads a heist usually takes more.',

        verPremium: 'What premium gives you',
        honesto: 'Early days',
        honestoTexto:
            'ViceHub is being built in the open, starting with GTA VI. Some of it is finished, some of it is not, and the fastest way to change that is to tell us what is missing.',
    },
    auth: {
        ouEntao: 'or',
        entrarComDiscord: 'Continue with Discord',
        entrarComGoogle: 'Continue with Google',
        entrarTitulo: 'Sign in',
        entrarSub: 'Welcome back to ViceHub.',
        email: 'Email',
        password: 'Password',
        aEntrar: 'Signing in…',
        credenciaisErradas: 'That email and password do not match.',
        contaBloqueada: 'Too many failed attempts. Try again shortly.',
        esqueciPassword: 'I forgot my password',
        criarConta: 'Create account',
        jaTensConta: 'Already have an account?',

        registoTitulo: 'Create account',
        registoSub: 'It takes less than a minute.',
        nomeJogador: 'Player name',
        aCriar: 'Creating…',
        passwordMinima: (n: number) => `At least ${n} characters.`,
        captchaNaoCarregou:
            'The anti-robot check could not load. Reload the page to try again — it has to pass before you can continue.',
        emailOcupado: 'An account with this email already exists.',
        nomeOcupado: 'That name is taken. Pick another.',
        naoFoiPossivelCriar: 'The account could not be created.',

        recuperarTitulo: 'Reset your password',
        recuperarSub:
            'Tell us the account address and we will send a link to set a new password.',
        enviarLink: 'Send the link',
        aEnviar: 'Sending…',
        verificaEmail: 'Check your email',
        seExistir:
            'If an account exists for that address, the link is on its way. It works once and expires within an hour.',
        voltarAoLogin: 'Back to sign in',
        jaMeLembro: 'I remember it after all',

        novaPasswordTitulo: 'New password',
        novaPasswordSub:
            'Saving this ends every open session on the account — including anyone who should not be there.',
        novaPassword: 'New password',
        guardarPassword: 'Save the password',
        linkNaoServe: 'This link no longer works. Ask for another.',
        pedirOutroLink: 'Ask for another link',
        naoFoiPossivelPassword: 'The password could not be set.',

        confirmarEmailTitulo: 'Confirm your email',
        aConfirmar: 'Confirming…',
        emailConfirmado: 'Address confirmed. Your account is ready.',
        linkSemCodigo:
            'This address carries no code. Open the link exactly as it arrived.',
        irParaViceHub: 'Go to ViceHub',
    },

    crews: {
        titulo: 'Crews',
        criar: 'Create crew',
        procurar: 'Search by name or tag',
        procurarLabel: 'Search crews',
        botaoProcurar: 'Search',
        emDestaque: 'Featured',
        destaque: 'Featured',
        aRecrutarAgora: 'Looking for people',
        todas: 'All crews',
        resultados: (termo: string) => `Results for "${termo}"`,
        semResultados: 'No crew by that name. Try another term.',
        aindaNaoHa: 'No crews yet. Create the first one.',
        anterior: 'Previous',
        seguinte: 'Next',
        paginaDe: (atual: number, total: number) => `Page ${atual} of ${total}`,
        ordenarPor: 'Sort by',
        ordemRecentes: 'Newest',
        ordemNivel: 'Level',
        ordemNome: 'Name',
        lugar: (posicao: number, total: number) =>
            `#${posicao} of ${total} ranked crews`,
        naoCarregou: 'The directory could not be loaded.',
        nivel: (n: number) => `Level ${n}`,
        membros: (n: number) =>
            p.plural(n, { one: '1 member', other: `${n} members` }),

        criarTitulo: 'Create crew',
        criarSub: 'You become the leader, and can invite people afterwards.',
        nome: 'Name',
        nomeAjuda: 'Between 3 and 48 characters.',
        tag: 'Tag',
        tagAjuda:
            'Between 2 and 8 letters or digits. It appears beside the name, like [VICE].',
        descricao: 'Description',
        caracteresDisponiveis: (n: number) =>
            p.plural(n, {
                one: 'Optional. 1 character left.',
                other: `Optional. ${n} characters left.`,
            }),
        criarBotao: 'Create the crew',
        nomeOcupado: 'A crew with this name already exists.',
        tagOcupada: 'That tag is taken. Pick another.',
        naoFoiPossivelCriar: 'The crew could not be created.',
        voltarDiretorio: 'Back to the directory',

        naoEncontrada: 'We could not find this crew.',
        xp: 'XP',
        contagemMembros: 'Members',
        recruta: 'Recruiting',
        recrutaTitulo: 'This crew is recruiting',
        recrutaDesde: (data: string) => `Recruiting since ${data}.`,
        recrutaLabel: 'Say this crew is recruiting',
        recrutaAjuda:
            'It puts the crew on the recruitment board and marks it in the directory. Nothing else changes: people still have to ask, and you still decide. Turn it off when you are full — the board shows how long each notice has been up.',
        recrutamentoTitulo: 'Crews recruiting',
        recrutamentoExplica: 'Only crews that said they are looking for people.',
        verQuemRecruta: 'See which crews are recruiting',
        verTodas: 'See every crew',
        requisitos: 'What this crew asks of you',
        requisitosAjuda:
            'One condition per line. Nobody is checked against this: it tells people what to expect before they apply, and you still decide who gets in.',
        cartaLabel: 'Tell them who you are',
        cartaPlaceholder: 'Age, when you play, what you are looking for…',
        cartaAjuda:
            'Optional, but it is the only thing they will read before deciding. Whoever runs the crew sees this and nobody else.',
        pedirEntrada: 'Ask to join',
        responderamQueNao: 'They answered no',
        candidaturaRecusada: 'Not this time',
        procuram: 'Looking for',
        respostaNova: 'New',
        entrasteAgora: 'You are in',
        enviadaEm: (data: string) => `Sent on ${data}`,
        candidaturaEnviada: 'Application sent',
        retirarCandidatura: 'Withdraw application',
        sair: 'Leave the crew',
        tesouraria: 'Treasury',
        eventos: 'Events',
        entraParaCandidatar: 'to apply to this crew.',
        entraLink: 'Sign in',
        candidaturasPorResponder: 'Applications awaiting an answer',
        aceitar: 'Accept',
        recusar: 'Decline',
        remover: 'Remove',
        listaMembros: 'Members',
        cargoDe: (nome: string) => `Role for ${nome}`,
        oQueOCargoDa:
            'A role decides what someone may do here. Officers propose and decide on money; leaders also change roles. You cannot change your own, and the last leader cannot be demoted.',

        asMinhasTitulo: 'What I belong to',
        minhasCrews: 'Crews',
        meusServidores: 'Servers',
        semComunidades: 'You do not belong to any crew or server yet.',
        naoCarregouMinhas: 'Your crews could not be loaded.',
        procuraUma: 'Find one',
        ouCriaTua: 'or create your own',
        definicoes: 'Crew settings',
        definicoesGuardadas: 'Crew settings saved.',
        nomeJaExiste: 'A crew with this name already exists.',
        planoVemDoServidor: 'The plan covering this crew comes from',
        planoAtivo:
            "The crew's plan is active. The banner and colour show on its public page.",
        precisaDePlano:
            'These fields are part of the premium plan — the plan belongs to the crew, not to you. You can fill them in, but they only save while the crew has one.',
        verPremium: 'See what premium gives the crew',
        aEsperaResposta: 'Awaiting an answer',
    },

    cargos: {
        crew_leader: 'Leader',
        crew_officer: 'Officer',
        crew_member: 'Member',
        server_owner: 'Owner',
        server_moderator: 'Moderator',
        server_member: 'Member',
    },

    servidores: {
        titulo: 'Servers',
        registar: 'Register server',
        procurar: 'Search by name',
        procurarLabel: 'Search servers',
        soOnline: 'Show only the ones that are online',
        online: 'Online',
        offline: 'Offline',
        todos: 'All servers',
        semResultados: 'No server matches these filters.',
        aindaNaoHa: 'No servers yet. Register the first one.',
        naoCarregou: 'The servers could not be loaded.',
        registarTitulo: 'Register server',
        registarSub: 'You become the owner, and can accept whoever applies.',
        regiao: 'Region',
        regiaoAjuda:
            'Optional. Helps people looking for low latency — Europe, for example.',
        registarBotao: 'Register the server',
        nomeOcupado: 'A server with this name already exists.',
        naoFoiPossivelRegistar: 'The server could not be registered.',
        naoEncontrado: 'We could not find this server.',
        sair: 'Leave the server',
        definicoes: 'Server settings',
        definicoesGuardadas: 'Server settings saved.',
        nomeJaExiste: 'A server with this name already exists.',
        nome: 'Name',
        descricao: 'Description',
        requisitos: 'What this server asks of you',
        requisitosAjuda:
            'One condition per line. Nobody is checked against this: it tells people what to expect before they apply, and you still decide who gets in.',
        reportaPorSi:
            'This server reports for itself: whether it is online comes from its last heartbeat, not from a box ticked here.',
        estaOnline: 'The server is online right now',
        planoAtivo:
            "The server's plan is active. The banner and colour show on its public page.",
        precisaDePlano:
            'These fields are part of the premium plan — the plan belongs to the server, not to you. You can fill them in, but they only save while the server has one.',
        verPremium: 'See what premium gives the server',
        entraParaCandidatar: 'to apply to this server.',
    },

    conquistas: {
        titulo: 'Achievements',
        nomes: {
            attended_1: 'Turned up',
            attended_10: 'Ten nights in',
            attended_50: 'Fifty nights in',
            ran_1: 'Ran an event',
            ran_10: 'Ran ten events',
            ran_50: 'Ran fifty events',
            paid_1: 'Paid its people',
            paid_10: 'Paid out ten times',
            paid_50: 'Paid out fifty times',
            level_5: 'Level 5',
            level_10: 'Level 10',
            level_25: 'Level 25',
        },
    },

    pendentes: {
        titulo: 'What needs you',
        pedidosDeEntrada: (n: number) =>
            p.plural(n, {
                one: '1 request to join',
                other: `${n} requests to join`,
            }),
        pedidosDeFiliacao: (n: number) =>
            p.plural(n, {
                one: '1 crew asking to play there',
                other: `${n} crews asking to play there`,
            }),
        decisoesDeDinheiro: (n: number) =>
            p.plural(n, {
                one: '1 decision waiting in the treasury',
                other: `${n} decisions waiting in the treasury`,
            }),
        amizades: 'Friends',
        pedidosDeAmizade: (n: number) =>
            p.plural(n, {
                one: '1 friend request',
                other: `${n} friend requests`,
            }),
        porResponder: (n: number) =>
            p.plural(n, { one: '1 waiting', other: `${n} waiting` }),
    },

    /**
     * Só o que envolve as páginas legais: o título, o aviso, os links.
     *
     * O corpo dos documentos não passa por aqui. Está em inglês, num
     * sítio só, pela razão que o próprio documento explica — e é
     * precisamente por isso que a chave `idioma` existe.
     */
    /**
     * Os nomes dos planos, por chave.
     *
     * Lidos por índice a partir do que a API devolve, como os cargos.
     * Estiveram escritos no catálogo de dados, em português, e era isso
     * que toda a gente lia: a página de preços em inglês oferecia
     * "Servidor sem limite" com tudo o resto traduzido à volta.
     */
    planos: {
        premium: 'Crew',
        server_base: 'Server',
        server_plus: 'Server +',
        server_unlimited: 'Server unlimited',
    },

    legal: {
        atualizado: (iso: string) => `Last updated ${p.data(iso)}`,
        rascunho: 'Draft — not yet in force',
        rascunhoTexto:
            'This document is still missing the details of the company behind ViceHub, so it does not bind anyone yet. It is published so it can be read and reviewed, not relied on.',
        idioma:
            'Published in English. Any translation is offered for convenience; the English text is the one that applies.',
        termos: 'Terms',
        privacidade: 'Privacy',
        rodape: 'Legal',
        marcas:
            'ViceHub is an independent platform, not affiliated with or endorsed by Rockstar Games, Take-Two Interactive, or any game publisher. Game names and trademarks belong to their owners.',
    },

    erros: {

        CAPTCHA_FAILED: 'The check that you are not a robot did not pass. Try again.',

        INVALID_CREDENTIALS: 'That email and password do not match.',

        ACCOUNT_LOCKED: 'Too many failed attempts. Try again shortly.',

        EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',

        USERNAME_ALREADY_EXISTS: 'That name is taken. Pick another.',

        INVALID_ACCESS_TOKEN: 'Your session is no longer valid. Sign in again.',

        INVALID_REFRESH_TOKEN: 'Your session expired. Sign in again.',

        SESSION_EXPIRED: 'Your session expired. Sign in again.',

        REFRESH_TOKEN_REUSED: 'This session was ended for safety. Sign in again.',

        SESSION_NOT_FOUND: 'This session no longer exists.',

        USER_NOT_FOUND: 'We could not find this player.',

        INVALID_ACCOUNT_TOKEN: 'This link no longer works. Ask for another.',

        EMAIL_ALREADY_VERIFIED: 'This address is already confirmed.',

        ACCOUNT_DELETION_NOT_CONFIRMED: 'The confirmation does not match. Type your name exactly as it appears.',

        ACCOUNT_LEADS_COMMUNITIES: 'You still lead a crew or a server. Hand it over or close it first.',

        ACCOUNT_HAS_ACTIVE_PLAN: 'You still have an active plan. Cancel it before deleting the account.',

        FEDERATED_NOT_CONFIGURED: 'This way of signing in is not available yet.',

        FEDERATED_UNAVAILABLE: 'We could not reach that service. Try again shortly.',

        FEDERATED_EXCHANGE_FAILED: 'Signing in that way did not work. Try again.',

        FEDERATED_STATE_MISMATCH: 'This sign-in took too long or was started elsewhere. Start again.',

        FEDERATED_EMAIL_UNUSABLE: 'That account has no usable email address.',

        INSUFFICIENT_PERMISSIONS: 'You are not allowed to do that.',

        LAST_ROLE_HOLDER: 'This is the last person with that role. Give it to someone else first.',

        CREW_NOT_FOUND: 'We could not find this crew.',

        CREW_NAME_TAKEN: 'A crew with this name already exists.',

        CREW_TAG_TAKEN: 'That tag is taken. Pick another.',

        SERVER_NOT_FOUND: 'We could not find this server.',

        SERVER_NAME_TAKEN: 'A server with this name already exists.',

        MEMBERSHIP_NOT_FOUND: 'We could not find that application.',

        ALREADY_MEMBER: 'You are already a member.',

        NOT_A_MEMBER: 'Only members can do that.',

        MEMBERSHIP_NOT_PENDING: 'This application has already been answered.',

        CANNOT_MANAGE_SELF: 'You cannot do that to yourself.',

        CREW_HAS_FUNDS: 'The crew treasury still holds money. Empty it first.',

        SERVER_HAS_FUNDS: 'The server treasury still holds money. Empty it first.',

        CREW_HAS_OPEN_DECISIONS: 'There are still decisions waiting. Settle them first.',

        SERVER_HAS_OPEN_DECISIONS: 'There are still decisions waiting. Settle them first.',

        CREW_HAS_ACTIVE_PLAN: 'The crew still has an active plan. Cancel it first.',

        SERVER_HAS_ACTIVE_PLAN: 'The server still has an active plan. Cancel it first.',

        AFFILIATION_NOT_FOUND: 'We could not find that affiliation.',

        CREW_ALREADY_AFFILIATED: 'This crew already plays on a server.',

        AFFILIATION_ALREADY_REQUESTED: 'This crew has already asked to play here.',

        AFFILIATION_NOT_PENDING: 'This request has already been answered.',

        SERVER_CREW_LIMIT_REACHED: 'This server has as many crews as its plan allows.',

        EVENT_NOT_FOUND: 'We could not find this event.',

        INVALID_EVENT_OWNER: 'This event belongs to another community.',

        EVENT_NOT_SCHEDULED: 'You can only sign up to an event that has not started.',

        EVENT_ALREADY_CLOSED: 'This event is already closed.',

        INVALID_STATUS_TRANSITION: 'This event is no longer in a state that allows that.',

        EVENT_FULL: 'This event is full.',

        ALREADY_SIGNED_UP: 'You are already signed up.',

        NOT_SIGNED_UP: 'This player did not sign up to this event.',

        ATTENDANCE_NOT_CONFIRMABLE: 'You cannot confirm attendance at a cancelled event.',

        STARTS_IN_THE_PAST: 'An event cannot start in the past.',

        ENDS_BEFORE_IT_STARTS: 'An event cannot end before it starts.',

        WALLET_NOT_FOUND: 'We could not find that wallet.',

        INVALID_WALLET_OWNER: 'That wallet belongs to somebody else.',

        MOVEMENT_NOT_FOUND: 'We could not find that movement.',

        MOVEMENT_NOT_PENDING: 'This movement has already been decided.',

        INSUFFICIENT_FUNDS: 'There is not enough available to cover this.',

        BALANCE_WOULD_OVERFLOW: 'That amount is larger than a treasury can hold.',

        NOT_THE_PROPOSER: 'Only whoever proposed this can withdraw it.',

        DISTRIBUTION_NOT_FOUND: 'We could not find that split.',

        DISTRIBUTION_NOT_PENDING: 'This split has already been decided.',

        NO_MEMBERS_TO_PAY: 'There is nobody to pay.',

        EVENT_NOT_IN_THIS_TREASURY: 'That event does not belong to this community.',

        NO_CONFIRMED_PARTICIPANTS: 'Nobody had their attendance confirmed at that event.',

        SHARES_DO_NOT_MATCH_TOTAL: 'The shares do not add up to the total.',

        CREW_DOES_NOT_PLAY_HERE: 'That crew does not play on this server.',

        SUBSCRIPTION_REQUIRED: 'This needs an active plan.',

        INVALID_SUBSCRIPTION_OWNER: 'That plan belongs to somebody else.',

        SUBSCRIPTION_OWNER_NOT_FOUND: 'We could not find who that plan is for.',

        SUBSCRIPTION_NOT_FOUND: 'We could not find that plan.',

        SUBSCRIPTION_ALREADY_CANCELED: 'This plan is already set to end.',

        SUBSCRIPTION_ALREADY_ENDED: 'This plan has already ended.',

        LIFETIME_HAS_NO_DURATION: 'A lifetime plan has no end date.',

        LIFETIME_CANNOT_BE_CANCELED: 'A lifetime plan does not get cancelled. It gets revoked.',

        ALREADY_LIFETIME: 'This account already has a lifetime plan.',

        BILLING_NOT_CONFIGURED: 'Payments are not set up yet. Try again later.',

        BILLING_OWNER_NOT_FOUND: 'We could not find who this payment is for.',

        STRIPE_REQUEST_FAILED: 'The payment service did not answer. Try again shortly.',

        SUBSCRIPTION_NOT_FROM_STRIPE: 'This plan was not bought here, so it cannot be managed here.',

        PLAN_IS_FOR_COMMUNITIES: 'That plan is for a crew or a server, not for a person.',

        PLAN_NOT_PURCHASABLE: 'That plan is not for sale.',

        PLAN_WRONG_OWNER: 'That plan does not go with this kind of owner.',

        API_KEY_NOT_FOUND: 'We could not find that key.',

        INVALID_API_KEY: 'That key was refused.',

        TOO_MANY_API_KEYS: 'This server already has as many keys as it can hold. Revoke one first.',

        CANNOT_FRIEND_SELF: 'You cannot add yourself.',

        ALREADY_FRIENDS: 'You are already friends.',

        ALREADY_REQUESTED: 'You have already asked.',

        FRIENDSHIP_NOT_FOUND: 'We could not find that request.',

        FRIENDSHIP_NOT_PENDING: 'This request has already been answered.',

        CANNOT_ACCEPT_OWN_REQUEST: 'You cannot accept your own request.',

        TOPIC_NOT_FOUND: 'This question does not exist or was removed.',

        REPLY_NOT_FOUND: 'This reply does not exist or was removed.',

        TOPIC_LOCKED: 'This question is closed to new replies.',

        NOT_YOURS: 'Only whoever wrote this can remove it.',

    },

    forum: {

        titulo: 'Forum',

        subtitulo: 'Ask, answer, and help each other out.',

        perguntar: 'Ask a question',

        aindaSemPerguntas: 'No questions yet. Be the first to ask one.',

        naoCarregou: 'The forum could not be loaded.',

        naoEncontrada: 'We could not find this question.',

        tituloDaPergunta: 'Your question, in one line',

        corpoDaPergunta: 'Say what you tried and what happened',

        publicar: 'Post the question',

        naoFoiPossivelPublicar: 'The question could not be posted.',

        responder: 'Write a reply',

        enviarResposta: 'Post the reply',

        naoFoiPossivelResponder: 'The reply could not be posted.',

        semRespostas: 'No replies yet.',

        retirar: 'Remove',

        naoFoiPossivelRetirar: 'That could not be removed.',

        retiradoComAConta: 'This text was removed along with the account.',

        contaApagada: 'a deleted account',

        fechada: 'Closed to new replies',

        fechar: 'Close to replies',

        reabrir: 'Reopen to replies',

        naoFoiPossivelFechar: 'That could not be changed.',

        voltar: 'Back to the forum',

        entrarParaPerguntar: 'Sign in to ask a question',

        denunciar: 'Report',

        porqueDenuncias: 'What is wrong with it?',

        razoes: {
            spam: 'Spam or advertising',
            abuse: 'Insults, harassment or hate',
            off_topic: 'Nothing to do with the question',
            other: 'Something else',
        },

        notaDaDenuncia: 'Anything a moderator should know (optional)',

        enviarDenuncia: 'Send the report',

        cancelarDenuncia: 'Cancel',

        denunciaRecebida: 'Reported. A moderator will look at it.',

        naoFoiPossivelDenunciar: 'The report could not be sent.',

        irParaFila: 'Reports waiting',

        filaTitulo: 'Reports',

        filaSub: 'Oldest first, because the oldest has waited longest.',

        filaEstados: {
            open: 'Waiting',
            acted: 'Acted on',
            dismissed: 'Nothing wrong',
        },

        filaVazia: 'Nothing here.',

        filaNegada: 'This is for moderators.',

        alvoPergunta: 'A question',

        alvoResposta: 'A reply',

        jaRetirado: 'Already removed.',

        verNoForum: 'Read it in the forum',

        marcarTratada: 'I dealt with it',

        marcarSemRazao: 'Dismiss it',

        jaTratada: 'Acted on.',

        jaDispensada: 'Looked at, nothing wrong.',

        naoFoiPossivelDecidir: 'That could not be saved.',

    },

    noticias: {

        titulo: 'What\'s happening in the game',

    },

    perfil: {
        apagarConta: 'Delete my account',
        apagarContaExplicacao:
            'You can leave whenever you like. Your account and everything that identifies you go; what your crews need to keep their books straight stays, under a name that says nothing about you.',
        apagarContaFica:
            'Your email, your name, your picture and your text are erased, and so are your password and any Discord or Google sign-in. What stays: the movements you proposed or approved, and the events you turned up to — those belong to your crews, not to you, and removing them would leave their books not adding up.',
        apagarContaPerdeSaldo: (saldo: string) =>
            `Your wallet holds ${saldo}. Deleting your account loses it — there is no way to send it anywhere first, and it does not come back.`,
        apagarContaPassword: 'Your password, if your account has one',
        apagarContaConfirmar: 'Delete my account for good',
        terminarSessoes: 'Sign out everywhere',
        terminarSessoesExplicacao:
            'Ends every session on every device, this one included, so you will be signed out here too. Use it if you think someone else got into your account — changing your password does not remove whoever is already inside.',
        terminarSessoesConfirmar: 'End every session',
        terminarSessoesATerminar: 'Signing out…',
        terminarSessoesFalhou:
            'The sessions could not be ended. Try again shortly.',
        primeiroPassoTitulo: 'Start here',
        primeiroPassoExplicacao:
            'ViceHub works around a crew: its people, its events, and the money it earns. You are not in one yet — make one and bring your people, or find one that is looking.',
        primeiroPassoCriar: 'Create a crew',
        primeiroPassoProcurar: 'See who is recruiting',
        levarDados: 'Take your data with you',
        levarDadosExplicacao:
            'A file with everything ViceHub holds about you: your account, the communities you are in, the events you turned up to, what you proposed and decided in a treasury, and what the platform gave you. Your password and your sign-ins are not in it — those are keys to the account, not facts about you.',
        levarDadosBotao: 'Download my data',
        levarDadosAPreparar: 'Preparing…',
        levarDadosFalhou: 'The file could not be prepared. Try again shortly.',
        titulo: 'My profile',
        verPublico: 'View as public',
        naoCarregou: 'Your profile could not be loaded.',
        jogador: 'Player',
        nivel: 'Level',
        reputacao: 'Reputation',
        reputacaoDeOnde: 'Where your reputation came from',
        reputacaoVazia: 'Nothing yet. Reputation comes from events: turning up to one someone confirmed you at earns a point, signing up and not turning up costs one.',
        reputacaoApareceu: 'turned up',
        reputacaoFaltou: 'did not turn up',
        reputacaoEventoApagado: 'an event that no longer exists',
        conta: 'Account',
        confirmado: 'Confirmed',
        porConfirmar: 'Not confirmed',
        plano: 'Plan',
        semPlano: 'No plan',
        premiumVitalicio: 'Lifetime premium',
        premiumAte: (data: string) => `Premium until ${data}`,
        enviarConfirmacao: 'Send confirmation email',
        emailEnviado: 'Email sent',
        naoFoiPossivelEmail: 'The confirmation email could not be sent.',
        apresentacao: 'Presentation',
        sobreTi: 'About you',
        avatar: 'Avatar',
        perfilGuardado: 'Profile saved.',
        naoFoiPossivelPerfil: 'Your profile could not be saved.',
        personalizacao: 'Customisation',
        premium: 'Premium',
        banner: 'Banner',
        cor: 'Accent colour',
        corAjuda: 'Six-digit hexadecimal, like #E93CEF.',
        guardarPersonalizacao: 'Save customisation',
        personalizacaoGuardada: 'Customisation saved.',
        ehPremium: 'Customisation is part of the premium plan.',
        naoFoiPossivelPersonalizacao: 'The customisation could not be saved.',
        naoEncontrado: 'We could not find this player.',
        desde: 'Since',
        irParaCrews: 'Go to crews',
    },

    premium: {
        etiqueta: 'Premium',
        titulo: 'The plan is the crew\u2019s, not yours',
        subtitulo:
            'Playing on ViceHub is free, and stays free. What is paid for is running a community: moving the money a crew earns, and having crews play on your server.',
        tituloComunidade: (nome: string) => `Premium for ${nome}`,
        subtituloCrew:
            'The plan belongs to the crew, not to whoever pays for it. While it is active, anyone who runs the crew can move its money — and set its banner and colour.',
        crewCobertaPeloServidor: (servidor: string) =>
            `This crew is already covered by ${servidor}'s plan, the server it plays on. It keeps it while it plays there.`,
        crewTemPlano: 'This crew already has an active plan.',
        irParaCrew: 'Go to the crew',
        subtituloServidor:
            'The plan belongs to the server, not to whoever pays for it. It sets how many crews can play there, and opens the server treasury.',
        servidorDaPersonalizacao:
            'Pay the crews that play on your server, straight from the server treasury.',
        servidorDaEquipa:
            'One plan for the whole server, and for the crews playing on it. It does not depend on who paid.',
        servidorTemPlano: 'This server already has an active plan.',
        irParaServidor: 'Go to the server',
        aTesourariaDaCrew: 'The treasury of one crew',
        escolheEscalao: 'Choose your tier',
        ateCrews: (n: number) =>
            p.plural(n, {
                one: 'Up to 1 crew playing on your server',
                other: `Up to ${n} crews playing on your server`,
            }),
        semLimiteDeCrews: 'No limit on how many crews play there',
        todosPorMes: 'All prices are per month.',
        porMes: 'per month',
        planoEDeComunidade:
            'There is nothing here to buy for your own account. The plan belongs to a crew or a server — open the one you run and buy it there.',
        asMinhasComunidades: 'My communities',
        oQueDaPersonalizacao:
            'A treasury that adds up: a crew proposes, approves and splits what it earns — everyone paid at once, or nobody.',
        oQueDaCrew:
            'Applying, being a member, running events and turning up stay free for everyone. So does your profile.',
        crewDaPersonalizacao:
            'A treasury that adds up: propose, approve, and split what the crew earns — everyone paid at once, or nobody.',
        crewDaEquipa:
            'One plan for the whole crew. Anyone who runs it can move the money — it does not depend on who paid.',
        oQueDaApoio:
            'It keeps the platform running, and pays for the time that goes into it.',
        comprar: 'Get premium',
        aAbrir: 'Opening checkout…',
        cancelarQuando: 'Cancel whenever you like. It runs to the end of the month you paid for.',
        criarConta: 'Create your account',
        jaTenhoConta: 'I already have an account',
        tensPlano: 'Your plan is active.',
        tensPlanoAte: (data: string) => `Your plan is active until ${data}.`,
        tensVitalicio: 'You have lifetime premium. It does not end, and it is never charged.',
        irParaPerfil: 'Go to my profile',
        aindaNaoAbriu:
            'Buying is not open yet — it opens shortly. Everything else on ViceHub works as normal in the meantime.',
        naoFoiPossivelComprar: 'Checkout could not be opened. Try again shortly.',
        gerirPlano: 'Manage plan',
        gerirOndeSeCancela:
            'Cancel, change the card, or download invoices. Cancelling stops the next renewal — the period you already paid for runs to the end.',
        naoFoiPossivelGerir:
            'The billing page could not be opened. Try again shortly.',
        notaVitalicio:
            'Lifetime premium is not for sale. It is given by hand, one at a time, to people who backed ViceHub early.',
    },

    carteira: {
        titulo: 'My wallet',
        dondeVem:
            'What a crew paid you lands here. It is yours to see, not to move: there is no way to send it anywhere, so nothing here pretends otherwise.',
        aindaSemNada: 'Nothing has reached your wallet yet.',
        verCarteira: 'My wallet',
    },

    rasto: {
        titulo: 'What was decided here',
        aindaNada: 'Nothing has been decided about anyone yet.',
        contaApagada: 'a deleted account',
        alguem: 'someone',
        semCargo: 'no role',
        admitiu: (quem: string, alvo: string) => `${quem} let ${alvo} in`,
        recusou: (quem: string, alvo: string) => `${quem} turned ${alvo} down`,
        removeu: (quem: string, alvo: string, cargo: string) =>
            `${quem} removed ${alvo}, who was ${cargo}`,
        mudouCargo: (quem: string, alvo: string, de: string, para: string) =>
            `${quem} changed ${alvo} from ${de} to ${para}`,
        aceitouCrew: (quem: string, crew: string) =>
            `${quem} let ${crew} play here`,
        foiAceiteEm: (quem: string, servidor: string) =>
            `${quem} let this crew play on ${servidor}`,
        recusouCrew: (quem: string, crew: string) =>
            `${quem} turned ${crew} away`,
        foiRecusadaEm: (quem: string, servidor: string) =>
            `${quem} turned this crew away from ${servidor}`,
        tirouCrew: (quem: string, crew: string) =>
            `${quem} put ${crew} off this server`,
        foiTiradaDe: (quem: string, servidor: string) =>
            `${quem} put this crew off ${servidor}`,
        fez: (quem: string, acao: string) => `${quem}: ${acao}`,
    },

    tesouraria: {
        montanteAEnviar: 'Amount to send',
        transferirTitulo: 'Send money to a crew',
        transferirAviso:
            'What a server earns funds the crews that play there. This moves straight away — it is your own treasury paying out.',
        paraQueCrew: 'To which crew',
        escolheCrew: 'Choose a crew',
        semCrewsNoServidor:
            'No crew plays here yet. Accept a crew and you can fund it from here.',
        transferir: 'Send it',
        aTransferir: 'Sending…',
        transferida: 'Sent.',
        totalADividir: 'Amount to split',
        dividirTitulo: 'Split what the crew earned',
        dividirAviso:
            'Nothing moves until someone with the power to decide approves it — the same as any other movement.',
        comoDividir: 'How to split it',
        deQueEvento: 'From which event',
        escolheEvento: 'Choose an event',
        semEventosComPresencas:
            'No event has confirmed attendance yet. Confirm who turned up on an event and you can split by that.',
        presencas: (n: number) =>
            p.plural(n, { one: '1 turned up', other: `${n} turned up` }),
        nota: 'Note',
        dividir: 'Propose the split',
        aDividir: 'Proposing…',
        divisaoProposta: 'Split proposed. It is waiting on a decision.',
        titulo: 'Treasury',
        verCrew: 'See the crew',
        precisaDePlano:
            "Moving money is part of the crew's plan — the plan belongs to the crew, not to you. The balance, the statement and past splits stay visible to everyone; proposing and approving need an active plan.",
        verPlano: 'See what the plan gives the crew',
        avaliacaoAcaba: (dias: number) =>
            p.plural(dias, {
                one: 'Your trial ends tomorrow. After that the balance stays visible, but proposing and approving need a plan.',
                other: `Your trial ends in ${dias} days. After that the balance stays visible, but proposing and approving need a plan.`,
            }),
        soParaMembros: "A crew's books are only visible to its members.",
        disponivel: 'Available',
        liquidado: 'Settled',
        aEntrar: 'Incoming',
        aSair: 'Outgoing',
        explicacaoDisponivel:
            'Available already subtracts the outgoings awaiting a decision. That is the number that says how much can be committed without counting the same money twice.',
        proporTitulo: 'Propose a movement',
        proporAviso:
            'Proposing moves nothing. It waits until someone with authority approves it.',
        montante: 'Amount',
        montanteAjuda: 'In whole units of the in-game currency.',
        direcao: 'Direction',
        entrada: 'Incoming',
        saida: 'Outgoing',
        categoria: 'Category',
        descricao: 'Description',
        propor: 'Propose the movement',
        aPropor: 'Proposing…',
        proposto: 'Movement proposed. It now awaits a decision.',
        extrato: 'Statement',
        semMovimentos: 'No movements yet.',
        aprovar: 'Approve',
        recusar: 'Decline',
        cancelar: 'Cancel',
        aprovado: 'Movement approved.',
        recusado: 'Movement declined.',
        cancelado: 'Proposal cancelled.',
        pagar: 'Pay it out',
        divisaoPaga: 'Split paid. Each share is now in its own wallet.',
        naoFoiPossivel: 'The operation could not be completed.',
        divisoes: 'Earnings splits',
        pessoas: (n: number) =>
            p.plural(n, { one: '1 person', other: `${n} people` }),
    },

    categorias: {
        contribution: 'Contribution',
        server_costs: 'Server costs',
        marketing: 'Marketing',
        event: 'Event',
        prize: 'Prize',
        service: 'Service',
        payout: 'Payout',
        other: 'Other',
    },

    estadosMovimento: {
        pending: 'Awaiting decision',
        approved: 'Approved',
        rejected: 'Declined',
        canceled: 'Cancelled',
    },

    bases: {
        equal: 'Equally',
        by_role: 'Weighted by rank',
        manual: 'Amounts given one by one',
        participation: 'By who turned up',
    },

    eventos: {
        quemVe: 'Who sees it',
        naMontra: 'On the front page',
        soAComunidade: 'Only this community',
        porNaMontra: 'Show this on the front page',
        tirarDaMontra: 'Take it off the front page',
        montraAjuda:
            'Off by default. Turned on, the name, the time and the community show to anyone who opens ViceHub — never who signed up.',
        publicado: 'This event now shows on the front page.',
        tirado: 'This event no longer shows on the front page.',
        titulo: 'Events',
        verComunidade: 'Back to the community',
        soParaMembros:
            'This calendar is only visible to members of the community.',
        mostrarPassados: 'Also show the ones that have passed',
        todos: 'All events',
        oQueVem: 'What is coming',
        semEventos: 'Nothing scheduled. Schedule the first one below.',
        semHistorico: 'No events have been held here yet.',
        marcarTitulo: 'Schedule an event',
        nome: 'Name',
        comeca: 'Starts',
        lugares: 'Places',
        lugaresAjuda: 'Leave empty for no limit.',
        descricao: 'Description',
        marcar: 'Schedule the event',
        aMarcar: 'Scheduling…',
        marcado: 'Event scheduled.',
        soQuemGere: 'Scheduling events is for whoever runs the community.',
        naoFoiPossivelMarcar: 'The event could not be scheduled.',
        inscritos: (n: number) =>
            p.plural(n, { one: '1 signed up', other: `${n} signed up` }),
        deLugares: (n: number) => ` of ${n}`,
        comPresenca: (n: number) =>
            p.plural(n, {
                one: '1 attendance confirmed',
                other: `${n} attendances confirmed`,
            }),

        naoEncontrado: 'We could not find this event.',
        todosOsEventos: 'All events',
        estado: 'Status',
        contagemInscritos: 'Signed up',
        confirmados: 'Confirmed',
        inscreverMe: 'Sign me up',
        inscrito: 'Signed up',
        retirarInscricao: 'Withdraw',
        presencaConfirmada: (peso: number) =>
            `Attendance confirmed · weight ${peso}`,
        inscricaoFeita:
            'Signed up. Attendance is confirmed by whoever organises the event.',
        inscricaoRetirada: 'Sign-up withdrawn.',
        soQuemOrganiza: 'That is for whoever organises the event.',
        quemSeInscreveu: 'Who signed up',
        diferenca:
            'Signing up and having attendance confirmed are different things. Only an organiser can assert that someone was there, and it is that assertion — not the sign-up — that earns a share when the community splits by participation.',
        semInscricoes: 'No sign-ups yet.',
        pesoDe: (nome: string) => `Weight for ${nome}`,
        confirmarPresenca: 'Confirm attendance',
        naoApareceu: 'Did not show',
        presencaDe: (nome: string) => `Attendance confirmed for ${nome}.`,
        ausente: (nome: string) => `${nome} marked as absent.`,
        comecar: 'Start',
        terminar: 'Finish',
        cancelarEvento: 'Cancel',
        estadoMudou: (estado: string) => `Event: ${estado.toLowerCase()}.`,
        jaPodeDividir: (n: number) =>
            p.plural(n, {
                one: '1 attendance confirmed. The crew can now split earnings by participation from this event.',
                other: `${n} attendances confirmed. The crew can now split earnings by participation from this event.`,
            }),
    },

    filiacao: {
        titulo: 'Server',
        jogaEm: 'This crew plays on',
        semServidor: 'This crew does not play on any server yet.',
        procurar: 'Search for a server',
        semResultados: 'No server matches that.',
        pedir: 'Ask to play here',
        pedidoEnviado: 'Waiting for an answer from',
        desistir: 'Withdraw the request',
        sair: 'Leave the server',
        crewsDoServidor: 'Crews',
        semCrews: 'No crew plays on this server yet.',
        pedidos: 'Crews asking to play here',
        aceitar: 'Accept',
        recusar: 'Reject',
        remover: 'Remove',
        crewsDoPlano: (usadas: number, limite: number) =>
            `${usadas} of the ${limite} crews your plan allows`,
        crewsSemLimite: (usadas: number) =>
            p.plural(usadas, {
                one: '1 crew plays here. Your plan sets no limit.',
                other: `${usadas} crews play here. Your plan sets no limit.`,
            }),
        planoCheio:
            'You already have every crew your plan allows. The ones playing here stay; accepting another needs a bigger plan.',
        verEscaloes: 'See the plans for servers',
    },

    chaves: {
        titulo: 'Server keys',
        comoInstalar: 'How to install it',
        paraQueServem:
            'A key lets your server report to ViceHub — whether it is up, and how many people are in. Install the resource on the server and paste the key into its config.',
        nome: 'Key name',
        nomeExemplo: 'production',
        criar: 'Create a key',
        copiaAgora:
            'Copy it now. This is the only time it is shown — we keep a digest, not the key.',
        revogar: 'Revoke',
        revogada: 'revoked',
        nuncaUsada: 'never used',
        usadaEm: (quando: string) => `last used ${quando}`,
        aindaNenhuma: 'This server has no keys yet.',
        jogadoresOnline: (quantos: number) =>
            quantos === 1 ? '1 player online' : `${quantos} players online`,
    },

    feed: {
        titulo: 'What happened',
        aindaNada:
            'Nothing yet. Join a crew, run an event, or add a friend — this fills up on its own.',
        eventoFeito: (xp: number) => `+${xp} XP from an event ·`,
        entrouEm: 'joined',
        naoCarregou: 'This could not be loaded.',
    },

    amigos: {
        titulo: 'Friends',
        adicionar: 'Add friend',
        aceitar: 'Accept',
        recusar: 'Decline',
        retirar: 'Withdraw',
        desfazer: 'Remove',
        saoAmigos: 'Friends',
        pedidoEnviado: 'Request sent',
        pedidos: 'Waiting for you',
        aindaNenhum: 'No friends yet. Open someone’s profile and ask.',
        desde: (quando: string) => `Friends since ${quando}`,
        naoCarregou: 'Your friends could not be loaded.',
    },

    progressao: {
        nivelAtual: (nivel: number) => `Level ${nivel}`,
        faltam: (xp: string, proximo: number) =>
            `${xp} XP to level ${proximo}`,
        noTopo: (nivel: number) =>
            `Level ${nivel} — as far as the levels go, for now.`,
        historico: 'Where this level came from',
        aindaSemGanhos:
            'No XP yet. Run an event, confirm who turned up, and finish it.',
        eventoApagado: 'an event that no longer exists',
        deOndeVem:
            'A crew earns XP when an event it ran is finished with people who actually turned up. Whoever turned up earns some too.',
    },

    zonaPerigo: {

        aindaMandasEm: (nomes: string) => `You are the only person in charge of: ${nomes}. Hand the role to somebody else, or delete those communities, before deleting your account.`,
        crewTitulo: 'Delete this crew',
        servidorTitulo: 'Delete this server',
        crewExplicacao:
            'The crew leaves the directory, its members lose their membership, and it stops being affiliated with the server where it plays. The name and the tag go back to being free.',
        servidorExplicacao:
            'The server leaves the directory, its members lose their membership, the crews playing there stop being affiliated — including any covered by its plan — and its keys stop working. The name goes back to being free.',
        escreveONome: (nome: string) => `Type ${nome} to confirm.`,
        confirmacao: 'Confirmation',
        botao: 'Delete',
        aApagar: 'Deleting…',
        temSaldo:
            'The treasury still has a balance. Split it or withdraw it first.',
        temDecisoes:
            'There are movements or splits still waiting for a decision in the treasury.',
        temPlano: 'There is an active plan. Cancel it first.',
        naoFoiPossivel: 'It could not be deleted.',
    },

    estadosEvento: {
        scheduled: 'Scheduled',
        ongoing: 'Under way',
        completed: 'Finished',
        canceled: 'Cancelled',
    },

    participacao: {
        signed_up: 'Signed up',
        confirmed: 'Attendance confirmed',
        no_show: 'Did not show',
        withdrawn: 'Withdrew',
    },
});

/**
 * A forma que todos os idiomas têm de cumprir, exatamente.
 */
export type Messages = ReturnType<typeof en>;
