import type { Messages } from './en.js';
import type { Tools } from './tools.js';

/**
 * Português.
 *
 * **A forma singular cobre o zero**, como em francês e ao contrário do
 * inglês e do espanhol: a regra do CLDR para pt é `i = 0..1`. Por isso
 * as formas `one` interpolam o número em vez de o escreverem como "1" —
 * escrito à mão, uma crew sem inscritos anunciaria "1 inscrito".
 */
export const pt = (p: Tools): Messages => ({
    comum: {
        aCarregar: 'A carregar…',
        aGuardar: 'A guardar…',
        guardar: 'Guardar',
        cancelar: 'Cancelar',
        voltar: 'Voltar',
        opcional: 'Opcional.',
        naoFoiPossivel: 'Não resultou. Tenta outra vez.',
        idioma: 'Idioma',
    },

    nav: {
        crews: 'Crews',
        servidores: 'Servidores',
        asMinhas: 'As minhas',
        perfil: 'Perfil',
        entrar: 'Entrar',
        sair: 'Sair',
    },

    auth: {
        entrarTitulo: 'Entrar',
        entrarSub: 'Bem-vindo de volta ao ViceHub.',
        email: 'Email',
        password: 'Password',
        aEntrar: 'A entrar…',
        credenciaisErradas: 'Email ou password que não conferem.',
        contaBloqueada: 'Demasiadas tentativas falhadas. Tenta daqui a pouco.',
        esqueciPassword: 'Esqueci-me da password',
        criarConta: 'Criar conta',
        jaTensConta: 'Já tens conta?',

        registoTitulo: 'Criar conta',
        registoSub: 'Leva menos de um minuto.',
        nomeJogador: 'Nome de jogador',
        aCriar: 'A criar…',
        passwordMinima: (n: number) => `Pelo menos ${n} caracteres.`,
        emailOcupado: 'Já existe uma conta com este email.',
        nomeOcupado: 'Este nome já está ocupado. Escolhe outro.',
        naoFoiPossivelCriar: 'Não foi possível criar a conta.',

        recuperarTitulo: 'Recuperar a password',
        recuperarSub:
            'Diz-nos o endereço da conta e enviamos um link para definir uma password nova.',
        enviarLink: 'Enviar o link',
        aEnviar: 'A enviar…',
        verificaEmail: 'Verifica o teu email',
        seExistir:
            'Se existir uma conta com esse endereço, o link já vai a caminho. Serve uma vez e expira dentro de uma hora.',
        voltarAoLogin: 'Voltar ao início de sessão',
        jaMeLembro: 'Afinal já me lembro',

        novaPasswordTitulo: 'Nova password',
        novaPasswordSub:
            'Ao guardar, todas as sessões abertas nesta conta são terminadas — incluindo a de quem não devia lá estar.',
        novaPassword: 'Password nova',
        guardarPassword: 'Guardar a password',
        linkNaoServe: 'Este link já não serve. Pede outro.',
        pedirOutroLink: 'Pedir outro link',
        naoFoiPossivelPassword: 'Não foi possível definir a password.',

        confirmarEmailTitulo: 'Confirmar o email',
        aConfirmar: 'A confirmar…',
        emailConfirmado: 'Endereço confirmado. A tua conta está pronta.',
        linkSemCodigo:
            'Este endereço não traz nenhum código. Abre o link tal como veio no email.',
        irParaViceHub: 'Ir para o ViceHub',
    },

    crews: {
        titulo: 'Crews',
        criar: 'Criar crew',
        procurar: 'Procurar pelo nome ou pela tag',
        procurarLabel: 'Pesquisar crews',
        botaoProcurar: 'Procurar',
        emDestaque: 'Em destaque',
        destaque: 'Destaque',
        todas: 'Todas as crews',
        resultados: (termo: string) => `Resultados para "${termo}"`,
        semResultados: 'Nenhuma crew com esse nome. Experimenta outro termo.',
        aindaNaoHa: 'Ainda não há crews. Cria a primeira.',
        anterior: 'Anterior',
        seguinte: 'Seguinte',
        paginaDe: (atual: number, total: number) => `Página ${atual} de ${total}`,
        naoCarregou: 'Não foi possível carregar o diretório.',
        nivel: (n: number) => `Nível ${n}`,
        membros: (n: number) =>
            p.plural(n, { one: `${n} membro`, other: `${n} membros` }),

        criarTitulo: 'Criar crew',
        criarSub: 'Ficas líder, e podes convidar quem quiseres a seguir.',
        nome: 'Nome',
        nomeAjuda: 'Entre 3 e 48 caracteres.',
        tag: 'Tag',
        tagAjuda:
            'Entre 2 e 8 letras ou números. Aparece ao lado do nome, assim: [VICE].',
        descricao: 'Descrição',
        caracteresDisponiveis: (n: number) =>
            p.plural(n, {
                one: `Opcional. Falta ${n} caractere.`,
                other: `Opcional. Faltam ${n} caracteres.`,
            }),
        criarBotao: 'Criar a crew',
        nomeOcupado: 'Já existe uma crew com este nome.',
        tagOcupada: 'Esta tag já está ocupada. Escolhe outra.',
        naoFoiPossivelCriar: 'Não foi possível criar a crew.',
        voltarDiretorio: 'Voltar ao diretório',

        naoEncontrada: 'Não encontrámos esta crew.',
        xp: 'XP',
        influencia: 'Influência',
        prestigio: 'Prestígio',
        contagemMembros: 'Membros',
        pedirEntrada: 'Pedir para entrar',
        candidaturaEnviada: 'Candidatura enviada',
        retirarCandidatura: 'Retirar candidatura',
        sair: 'Sair da crew',
        tesouraria: 'Tesouraria',
        eventos: 'Eventos',
        entraParaCandidatar: 'para te candidatares a esta crew.',
        entraLink: 'Entra',
        candidaturasPorResponder: 'Candidaturas por responder',
        aceitar: 'Aceitar',
        recusar: 'Recusar',
        remover: 'Remover',
        listaMembros: 'Membros',

        asMinhasTitulo: 'As minhas crews',
        verDiretorio: 'Ver o diretório',
        naoCarregouMinhas: 'Não foi possível carregar as tuas crews.',
        semCrews: 'Ainda não pertences a nenhuma crew.',
        procuraUma: 'Procura uma',
        ouCriaTua: 'ou cria a tua',
        aEsperaResposta: 'À espera de resposta',
        ondeEntrei: 'Onde já entrei',
    },

    cargos: {
        crew_leader: 'Líder',
        crew_officer: 'Oficial',
        crew_member: 'Membro',
        server_owner: 'Dono',
        server_moderator: 'Moderador',
        server_member: 'Membro',
    },

    servidores: {
        titulo: 'Servidores',
        registar: 'Registar servidor',
        procurar: 'Procurar pelo nome',
        procurarLabel: 'Pesquisar servidores',
        soOnline: 'Mostrar apenas os que estão online',
        online: 'Online',
        offline: 'Offline',
        todos: 'Todos os servidores',
        semResultados: 'Nenhum servidor com estes filtros.',
        aindaNaoHa: 'Ainda não há servidores. Regista o primeiro.',
        naoCarregou: 'Não foi possível carregar os servidores.',
        registarTitulo: 'Registar servidor',
        registarSub: 'Ficas dono, e podes aceitar quem se candidatar.',
        regiao: 'Região',
        regiaoAjuda:
            'Opcional. Ajuda quem procura latência baixa, por exemplo Europa.',
        registarBotao: 'Registar o servidor',
        nomeOcupado: 'Já existe um servidor com este nome.',
        naoFoiPossivelRegistar: 'Não foi possível registar o servidor.',
        naoEncontrado: 'Não encontrámos este servidor.',
        sair: 'Sair do servidor',
        entraParaCandidatar: 'para te candidatares a este servidor.',
    },

    perfil: {
        titulo: 'O meu perfil',
        verPublico: 'Ver como público',
        naoCarregou: 'Não foi possível carregar o teu perfil.',
        jogador: 'Jogador',
        nivel: 'Nível',
        reputacao: 'Reputação',
        conta: 'Conta',
        confirmado: 'Confirmado',
        porConfirmar: 'Por confirmar',
        plano: 'Plano',
        semPlano: 'Sem plano',
        premiumVitalicio: 'Premium vitalício',
        premiumAte: (data: string) => `Premium até ${data}`,
        enviarConfirmacao: 'Enviar email de confirmação',
        emailEnviado: 'Email enviado',
        naoFoiPossivelEmail: 'Não foi possível enviar o email de confirmação.',
        apresentacao: 'Apresentação',
        sobreTi: 'Sobre ti',
        avatar: 'Avatar',
        perfilGuardado: 'Perfil guardado.',
        naoFoiPossivelPerfil: 'Não foi possível guardar o perfil.',
        personalizacao: 'Personalização',
        premium: 'Premium',
        planoAtivo:
            'O teu plano está ativo. O banner e a cor aparecem no teu perfil público.',
        precisaDePlano:
            'Estes campos fazem parte do plano premium. Podes escrevê-los, mas só são guardados com um plano ativo.',
        banner: 'Banner',
        cor: 'Cor de destaque',
        corAjuda: 'Hexadecimal de seis dígitos, como #E93CEF.',
        guardarPersonalizacao: 'Guardar personalização',
        personalizacaoGuardada: 'Personalização guardada.',
        ehPremium: 'A personalização faz parte do plano premium.',
        naoFoiPossivelPersonalizacao:
            'Não foi possível guardar a personalização.',
        naoEncontrado: 'Não encontrámos este jogador.',
        desde: 'Desde',
        irParaCrews: 'Ir para as crews',
    },

    tesouraria: {
        titulo: 'Tesouraria',
        verCrew: 'Ver a crew',
        soParaMembros:
            'As contas de uma crew só são visíveis a quem pertence a ela.',
        disponivel: 'Disponível',
        liquidado: 'Liquidado',
        aEntrar: 'A entrar',
        aSair: 'A sair',
        explicacaoDisponivel:
            'O disponível já desconta as saídas por decidir. É esse o número que diz quanto se pode comprometer sem contar duas vezes o mesmo dinheiro.',
        proporTitulo: 'Propor um movimento',
        proporAviso:
            'Nada se move ao propor. Fica por decidir até alguém com autoridade aprovar.',
        montante: 'Montante',
        montanteAjuda: 'Em unidades inteiras da moeda do jogo.',
        direcao: 'Direção',
        entrada: 'Entrada',
        saida: 'Saída',
        categoria: 'Categoria',
        descricao: 'Descrição',
        propor: 'Propor o movimento',
        aPropor: 'A propor…',
        proposto: 'Movimento proposto. Fica à espera de decisão.',
        extrato: 'Extrato',
        semMovimentos: 'Ainda não há movimentos.',
        aprovar: 'Aprovar',
        recusar: 'Recusar',
        cancelar: 'Cancelar',
        aprovado: 'Movimento aprovado.',
        recusado: 'Movimento recusado.',
        cancelado: 'Proposta cancelada.',
        naoFoiPossivel: 'Não foi possível completar a operação.',
        divisoes: 'Divisões de ganhos',
        pessoas: (n: number) =>
            p.plural(n, { one: `${n} pessoa`, other: `${n} pessoas` }),
    },

    categorias: {
        contribution: 'Contribuição',
        server_costs: 'Custos do servidor',
        marketing: 'Marketing',
        event: 'Evento',
        prize: 'Prémio',
        service: 'Serviço',
        payout: 'Pagamento',
        other: 'Outro',
    },

    estadosMovimento: {
        pending: 'Por decidir',
        approved: 'Aprovado',
        rejected: 'Recusado',
        canceled: 'Cancelado',
    },

    bases: {
        equal: 'Em partes iguais',
        by_role: 'Ponderada por cargo',
        manual: 'Valores indicados um a um',
        participation: 'Por quem apareceu',
    },

    eventos: {
        titulo: 'Eventos',
        verCrew: 'Ver a crew',
        soParaMembros:
            'O calendário de uma crew só é visível a quem pertence a ela.',
        mostrarPassados: 'Mostrar também os que já passaram',
        todos: 'Todos os eventos',
        oQueVem: 'O que está para vir',
        semEventos: 'Nada marcado. Marca o primeiro aqui em baixo.',
        semHistorico: 'Esta crew ainda não teve eventos.',
        marcarTitulo: 'Marcar um evento',
        nome: 'Nome',
        comeca: 'Começa',
        lugares: 'Lugares',
        lugaresAjuda: 'Deixa vazio para não haver limite.',
        descricao: 'Descrição',
        marcar: 'Marcar o evento',
        aMarcar: 'A marcar…',
        marcado: 'Evento marcado.',
        soQuemGere: 'Marcar eventos é de quem gere a crew.',
        naoFoiPossivelMarcar: 'Não foi possível marcar o evento.',
        inscritos: (n: number) =>
            p.plural(n, { one: `${n} inscrito`, other: `${n} inscritos` }),
        deLugares: (n: number) => ` de ${n}`,
        comPresenca: (n: number) =>
            p.plural(n, {
                one: `${n} com presença confirmada`,
                other: `${n} com presença confirmada`,
            }),

        naoEncontrado: 'Não encontrámos este evento.',
        todosOsEventos: 'Todos os eventos',
        estado: 'Estado',
        contagemInscritos: 'Inscritos',
        confirmados: 'Confirmados',
        inscreverMe: 'Inscrever-me',
        inscrito: 'Inscrito',
        retirarInscricao: 'Retirar inscrição',
        presencaConfirmada: (peso: number) =>
            `Presença confirmada · peso ${peso}`,
        inscricaoFeita:
            'Inscrição feita. A presença é confirmada por quem organiza.',
        inscricaoRetirada: 'Inscrição retirada.',
        soQuemOrganiza: 'Isso é de quem organiza o evento.',
        quemSeInscreveu: 'Quem se inscreveu',
        diferenca:
            'Inscrever-se e ter presença confirmada são coisas diferentes. Só quem organiza pode afirmar que alguém esteve lá, e é essa afirmação — não a inscrição — que dá direito a receber na divisão por participação.',
        semInscricoes: 'Ainda não há inscrições.',
        pesoDe: (nome: string) => `Peso de ${nome}`,
        confirmarPresenca: 'Confirmar presença',
        naoApareceu: 'Não apareceu',
        presencaDe: (nome: string) => `Presença de ${nome} confirmada.`,
        ausente: (nome: string) => `${nome} marcado como ausente.`,
        comecar: 'Começar',
        terminar: 'Terminar',
        cancelarEvento: 'Cancelar',
        estadoMudou: (estado: string) => `Evento: ${estado.toLowerCase()}.`,
        jaPodeDividir: (n: number) =>
            p.plural(n, {
                one: `${n} presença confirmada. A crew já pode dividir ganhos por participação a partir deste evento.`,
                other: `${n} presenças confirmadas. A crew já pode dividir ganhos por participação a partir deste evento.`,
            }),
    },

    estadosEvento: {
        scheduled: 'Marcado',
        ongoing: 'A decorrer',
        completed: 'Terminado',
        canceled: 'Cancelado',
    },

    participacao: {
        signed_up: 'Inscrito',
        confirmed: 'Presença confirmada',
        no_show: 'Não apareceu',
        withdrawn: 'Desistiu',
    },
});
