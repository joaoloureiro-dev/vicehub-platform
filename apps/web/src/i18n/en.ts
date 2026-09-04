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
        entrar: 'Sign in',
        sair: 'Sign out',
    },

    auth: {
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
        todas: 'All crews',
        resultados: (termo: string) => `Results for "${termo}"`,
        semResultados: 'No crew by that name. Try another term.',
        aindaNaoHa: 'No crews yet. Create the first one.',
        anterior: 'Previous',
        seguinte: 'Next',
        paginaDe: (atual: number, total: number) => `Page ${atual} of ${total}`,
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
        pedirEntrada: 'Ask to join',
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
        entraParaCandidatar: 'to apply to this server.',
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
        planoAtivo:
            'Your plan is active. The banner and colour show on your public profile.',
        precisaDePlano:
            'These fields are part of the premium plan. You can fill them in, but they only save with an active plan.',
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
