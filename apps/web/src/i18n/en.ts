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
            'Playing is free, and stays free: your profile, your banner, applying to crews, being a member, seeing who is recruiting. What is paid is running a community.',
        planoCrew: 'Crew',
        planoCrewPreco: '\u20ac4.99 / month',
        planoCrewTexto:
            'A treasury that adds up, applications you answer instead of losing, ranks, events, and attendance nobody can argue with.',
        planoServidor: 'Server',
        planoServidorPreco: '\u20ac14.99 / month',
        planoServidorTexto:
            'Everything a crew gets, for the server and for the crews that play on it. Pay the crews you hire straight from the server treasury.',
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
        influencia: 'Influence',
        prestigio: 'Prestige',
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
        },
    },

    perfil: {
        titulo: 'My profile',
        verPublico: 'View as public',
        naoCarregou: 'Your profile could not be loaded.',
        jogador: 'Player',
        nivel: 'Level',
        reputacao: 'Reputation',
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
        titulo: 'Back the platform, get the extras',
        subtitulo:
            'ViceHub works without paying. Premium is for people who want the platform to keep being built — and who like their profile looking like theirs.',
        tituloComunidade: (nome: string) => `Premium for ${nome}`,
        subtituloCrew:
            'The plan belongs to the crew, not to whoever pays for it. Anyone who runs the crew can set its banner and colour while it is active.',
        crewCobertaPeloServidor: (servidor: string) =>
            `This crew is already covered by ${servidor}'s plan, the server it plays on. It keeps it while it plays there.`,
        crewTemPlano: 'This crew already has an active plan.',
        irParaCrew: 'Go to the crew',
        subtituloServidor:
            'The plan belongs to the server, not to whoever pays for it. Anyone who runs the server can set its banner and colour while it is active.',
        servidorDaPersonalizacao:
            "Customise the server: banner and accent colour on the server's public page.",
        servidorDaEquipa:
            'One plan for the whole server. Anyone who runs it can change the look — it does not depend on who paid.',
        servidorTemPlano: 'This server already has an active plan.',
        irParaServidor: 'Go to the server',
        porMes: 'per month',
        oQueDaPersonalizacao:
            'Customise your profile: banner and accent colour on your public page.',
        oQueDaCrew: 'Premium can be bought for a crew or a server, not just for you.',
        crewDaPersonalizacao:
            "Customise the crew: banner and accent colour on the crew's public page.",
        crewDaEquipa:
            'One plan for the whole crew. Anyone who runs it can change the look — it does not depend on who paid.',
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
        notaVitalicio:
            'Lifetime premium is not for sale. It is given by hand, one at a time, to people who backed ViceHub early.',
    },

    tesouraria: {
        titulo: 'Treasury',
        verCrew: 'See the crew',
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
        verCrew: 'See the crew',
        soParaMembros: "A crew's calendar is only visible to its members.",
        mostrarPassados: 'Also show the ones that have passed',
        todos: 'All events',
        oQueVem: 'What is coming',
        semEventos: 'Nothing scheduled. Schedule the first one below.',
        semHistorico: 'This crew has not held any events yet.',
        marcarTitulo: 'Schedule an event',
        nome: 'Name',
        comeca: 'Starts',
        lugares: 'Places',
        lugaresAjuda: 'Leave empty for no limit.',
        descricao: 'Description',
        marcar: 'Schedule the event',
        aMarcar: 'Scheduling…',
        marcado: 'Event scheduled.',
        soQuemGere: 'Scheduling events is for whoever runs the crew.',
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
            'Signing up and having attendance confirmed are different things. Only an organiser can assert that someone was there, and it is that assertion — not the sign-up — that earns a share when the crew splits by participation.',
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
