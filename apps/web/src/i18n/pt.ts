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
        naoFoiPossivel: 'Não resultou. Tenta outra vez.',
        idioma: 'Idioma',
    },

    nav: {
        crews: 'Crews',
        servidores: 'Servidores',
        asMinhas: 'As minhas',
        perfil: 'Perfil',
        principal: 'Navegação principal',
        recrutamento: 'Recrutamento',
        premium: 'Preços',
        entrar: 'Entrar',
        sair: 'Sair',
    },

    landing: {
        aAcontecer: 'A acontecer no ViceHub',
        aDecorrerAgora: 'A decorrer agora',
        comecaEm: (quando: string) => `Começa ${quando}`,
        naCrew: (nome: string) => `com ${nome}`,
        titulo: 'A tua crew. O teu servidor. A tua parte.',
        subtitulo:
            'O ViceHub é onde as comunidades de jogo se organizam: gere a tua crew, move o que ganham, e prova quem apareceu mesmo.',
        criarConta: 'Criar a minha conta',
        verRecrutamento: 'Quem está a recrutar',
        jaTenhoConta: 'Já tenho conta',

        quemRecruta: 'Crews à procura de gente',
        agoraOnline: 'Servidores online agora',
        verTudo: 'Ver todos',
        jogadores: (n: number) =>
            p.plural(n, { one: '1 jogador', other: `${n} jogadores` }),
        planosTitulo: 'Quanto custa',
        planosGratis:
            'Jogar é grátis, e continua a ser: o teu perfil, o teu banner, candidatares-te a crews, seres membro, marcares eventos, apareceres. O que se paga é mexer no dinheiro.',
        planoCrew: 'Crew',
        planoCrewPreco: '4,99 \u20ac / mês',
        planoCrewTexto:
            'Uma tesouraria que bate certo: propor, aprovar e dividir o que a crew ganha — todos pagos ao mesmo tempo, ou nenhum. Trinta dias para experimentar.',
        planoServidor: 'Servidor',
        planoServidorPreco: 'desde 14,99 \u20ac / mês',
        planoServidorTexto:
            'Até 10 crews a jogar no teu servidor, e uma tesouraria para lhes pagar. Mais crews, plano maior.',
        crewsTitulo: 'Crews e servidores',
        crewsTexto:
            'Junta a tua gente com cargos que significam alguma coisa. As candidaturas são respondidas, não ignoradas.',

        tesourariaTitulo: 'Uma tesouraria que bate certo',
        tesourariaTexto:
            'Movimentos por proposta e aprovação, com quatro saldos para ninguém comprometer duas vezes o mesmo dinheiro. Ou toda a gente é paga, ou não é paga ninguém.',

        eventosTitulo: 'Pago a quem aparece',
        eventosTexto:
            'Fazem o trabalho, confirma-se quem lá esteve, e divide-se por presença — com pesos, porque quem lidera um assalto costuma levar mais.',

        verPremium: 'O que o premium dá',
        honesto: 'Ainda no princípio',
        honestoTexto:
            'O ViceHub está a ser construído às claras, a começar pelo GTA VI. Há coisas prontas e outras não, e a forma mais rápida de mudar isso é dizeres o que falta.',
    },
    auth: {
        ouEntao: 'ou',
        entrarComDiscord: 'Continuar com Discord',
        entrarComGoogle: 'Continuar com Google',
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
        aRecrutarAgora: 'À procura de gente',
        todas: 'Todas as crews',
        resultados: (termo: string) => `Resultados para "${termo}"`,
        semResultados: 'Nenhuma crew com esse nome. Experimenta outro termo.',
        aindaNaoHa: 'Ainda não há crews. Cria a primeira.',
        anterior: 'Anterior',
        seguinte: 'Seguinte',
        paginaDe: (atual: number, total: number) => `Página ${atual} de ${total}`,
        ordenarPor: 'Ordenar por',
        ordemRecentes: 'Mais recentes',
        ordemNivel: 'Nível',
        ordemNome: 'Nome',
        lugar: (posicao: number, total: number) =>
            `#${posicao} entre ${total} crews classificadas`,
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
        recruta: 'A recrutar',
        recrutaTitulo: 'Esta crew está a recrutar',
        recrutaDesde: (data: string) => `A recrutar desde ${data}.`,
        recrutaLabel: 'Dizer que esta crew está a recrutar',
        recrutaAjuda:
            'Põe a crew no quadro de recrutamento e marca-a no diretório. Não muda mais nada: continuam a ter de pedir, e continuas a decidir. Desliga quando estiveres cheio — o quadro mostra há quanto tempo cada anúncio está no ar.',
        recrutamentoTitulo: 'Crews a recrutar',
        recrutamentoExplica: 'Só as crews que disseram que procuram gente.',
        verQuemRecruta: 'Ver que crews estão a recrutar',
        verTodas: 'Ver todas as crews',
        requisitos: 'O que esta crew te pede',
        requisitosAjuda:
            'Uma condição por linha. Ninguém é verificado contra isto: serve para quem se candidata saber ao que vai, e quem decide quem entra continuas a ser tu.',
        cartaLabel: 'Diz-lhes quem és',
        cartaPlaceholder: 'Idade, a que horas jogas, o que procuras…',
        cartaAjuda:
            'Opcional, mas é a única coisa que vão ler antes de decidir. Quem manda na crew vê isto e mais ninguém.',
        pedirEntrada: 'Pedir para entrar',
        responderamQueNao: 'Responderam que não',
        candidaturaRecusada: 'Desta vez não',
        enviadaEm: (data: string) => `Enviada a ${data}`,
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

        asMinhasTitulo: 'Onde pertenço',
        minhasCrews: 'Crews',
        meusServidores: 'Servidores',
        semComunidades: 'Ainda não pertences a nenhuma crew nem servidor.',
        naoCarregouMinhas: 'Não foi possível carregar as tuas crews.',
        procuraUma: 'Procura uma',
        ouCriaTua: 'ou cria a tua',
        definicoes: 'Definições da crew',
        definicoesGuardadas: 'Definições da crew guardadas.',
        nomeJaExiste: 'Já existe uma crew com este nome.',
        planoVemDoServidor: 'O plano que cobre esta crew vem do servidor',
        planoAtivo:
            'O plano da crew está ativo. O banner e a cor aparecem na página pública dela.',
        precisaDePlano:
            'Estes campos são do plano premium — e o plano é da crew, não teu. Podes preenchê-los, mas só ficam guardados enquanto a crew tiver um.',
        verPremium: 'Ver o que o premium dá à crew',
        aEsperaResposta: 'À espera de resposta',
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
        definicoes: 'Definições do servidor',
        definicoesGuardadas: 'Definições do servidor guardadas.',
        nomeJaExiste: 'Já existe um servidor com este nome.',
        nome: 'Nome',
        descricao: 'Descrição',
        requisitos: 'O que este servidor te pede',
        requisitosAjuda:
            'Uma condição por linha. Ninguém é verificado contra isto: serve para dizer o que esperar antes de se candidatarem, e quem decide quem entra continuas a ser tu.',
        reportaPorSi:
            'Este servidor reporta por si: estar online vem do último sinal que enviou, e não de uma caixa marcada aqui.',
        estaOnline: 'O servidor está online neste momento',
        planoAtivo:
            'O plano do servidor está ativo. O banner e a cor aparecem na página pública dele.',
        precisaDePlano:
            'Estes campos são do plano premium — e o plano é do servidor, não teu. Podes preenchê-los, mas só ficam guardados enquanto o servidor tiver um.',
        verPremium: 'Ver o que o premium dá ao servidor',
        entraParaCandidatar: 'para te candidatares a este servidor.',
    },

    conquistas: {
        titulo: 'Conquistas',
        nomes: {
            attended_1: 'Apareceu',
            attended_10: 'Dez noites',
            attended_50: 'Cinquenta noites',
            ran_1: 'Correu um evento',
            ran_10: 'Correu dez eventos',
            ran_50: 'Correu cinquenta eventos',
            paid_1: 'Pagou aos seus',
            paid_10: 'Pagou dez vezes',
            paid_50: 'Pagou cinquenta vezes',
            level_5: 'Nível 5',
            level_10: 'Nível 10',
            level_25: 'Nível 25',
        },
    },

    perfil: {
        levarDados: 'Levar os teus dados',
        levarDadosExplicacao:
            'Um ficheiro com tudo o que o ViceHub tem sobre ti: a conta, as comunidades onde estás, os eventos em que estiveste, o que propuseste e decidiste numa tesouraria, e o que a plataforma te deu. A password e as tuas entradas não vão lá — isso são chaves da conta, e não factos sobre ti.',
        levarDadosBotao: 'Descarregar os meus dados',
        levarDadosAPreparar: 'A preparar…',
        levarDadosFalhou: 'Não foi possível preparar o ficheiro. Tenta daqui a pouco.',
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

    premium: {
        etiqueta: 'Premium',
        titulo: 'O plano é da comunidade, não é teu',
        subtitulo:
            'Jogar no ViceHub é de graça, e continua a ser. O que se paga é gerir uma comunidade: mexer no dinheiro que a crew ganha, e ter crews a jogar no teu servidor.',
        tituloComunidade: (nome: string) => `Premium para ${nome}`,
        subtituloCrew:
            'O plano é da crew, e não de quem o paga. Enquanto estiver ativo, quem gere a crew pode mexer no dinheiro dela — e definir o banner e a cor.',
        crewCobertaPeloServidor: (servidor: string) =>
            `Esta crew já está coberta pelo plano do ${servidor}, o servidor onde joga. Fica com ele enquanto lá jogar.`,
        crewTemPlano: 'Esta crew já tem um plano ativo.',
        irParaCrew: 'Ir para a crew',
        subtituloServidor:
            'O plano é do servidor, e não de quem o paga. Decide quantas crews podem jogar lá, e abre a tesouraria do servidor.',
        servidorDaPersonalizacao:
            'Paga às crews que jogam no teu servidor, diretamente da tesouraria dele.',
        servidorDaEquipa:
            'Um plano para o servidor inteiro, e para as crews que lá jogam. Não depende de quem pagou.',
        servidorTemPlano: 'Este servidor já tem um plano ativo.',
        irParaServidor: 'Ir para o servidor',
        aTesourariaDaCrew: 'A tesouraria de uma crew',
        escolheEscalao: 'Escolhe o escalão',
        ateCrews: (n: number) =>
            p.plural(n, {
                one: 'Até 1 crew a jogar no teu servidor',
                other: `Até ${n} crews a jogar no teu servidor`,
            }),
        semLimiteDeCrews: 'Sem limite de crews a jogar lá',
        todosPorMes: 'Todos os preços são por mês.',
        porMes: 'por mês',
        planoEDeComunidade:
            'Aqui não há nada para comprares para a tua conta. O plano é de uma crew ou de um servidor — abre a que geres e compra-o lá.',
        asMinhasComunidades: 'As minhas comunidades',
        oQueDaPersonalizacao:
            'Uma tesouraria que bate certo: uma crew propõe, aprova e divide o que ganha — todos pagos ao mesmo tempo, ou nenhum.',
        oQueDaCrew:
            'Candidatar-se, pertencer, marcar eventos e aparecer continuam de graça para toda a gente. O teu perfil também.',
        crewDaPersonalizacao:
            'Uma tesouraria que bate certo: propor, aprovar e dividir o que a crew ganha — todos pagos ao mesmo tempo, ou nenhum.',
        crewDaEquipa:
            'Um plano para a crew inteira. Quem a gere pode mexer no dinheiro — não depende de quem pagou.',
        oQueDaApoio:
            'É o que mantém a plataforma de pé, e paga o tempo que isto leva.',
        comprar: 'Ficar premium',
        aAbrir: 'A abrir o pagamento…',
        cancelarQuando: 'Cancelas quando quiseres. Corre até ao fim do mês que pagaste.',
        criarConta: 'Criar conta',
        jaTenhoConta: 'Já tenho conta',
        tensPlano: 'O teu plano está ativo.',
        tensPlanoAte: (data: string) => `O teu plano está ativo até ${data}.`,
        tensVitalicio: 'Tens premium vitalício. Não termina, e nunca é cobrado.',
        irParaPerfil: 'Ir para o meu perfil',
        aindaNaoAbriu:
            'A compra ainda não está aberta — abre em breve. Até lá, tudo o resto no ViceHub funciona como sempre.',
        naoFoiPossivelComprar: 'Não foi possível abrir o pagamento. Tenta daqui a pouco.',
        notaVitalicio:
            'O vitalício não está à venda. É dado à mão, um a um, a quem apoiou o ViceHub no princípio.',
    },

    tesouraria: {
        titulo: 'Tesouraria',
        verCrew: 'Ver a crew',
        precisaDePlano:
            'Mexer no dinheiro faz parte do plano da crew — o plano é da crew, e não teu. O saldo, o extrato e as divisões passadas ficam à vista de todos; propor e aprovar é que exigem plano ativo.',
        verPlano: 'Ver o que o plano dá à crew',
        avaliacaoAcaba: (dias: number) =>
            p.plural(dias, {
                one: 'A tua avaliação acaba amanhã. Depois disso o saldo continua à vista, mas propor e aprovar exigem plano.',
                other: `A tua avaliação acaba daqui a ${dias} dias. Depois disso o saldo continua à vista, mas propor e aprovar exigem plano.`,
            }),
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
        quemVe: 'Quem vê',
        naMontra: 'Na página de entrada',
        soAComunidade: 'Só esta comunidade',
        porNaMontra: 'Mostrar na página de entrada',
        tirarDaMontra: 'Tirar da página de entrada',
        montraAjuda:
            'Desligado por omissão. Ligado, o nome, a hora e a comunidade aparecem a quem abrir o ViceHub — nunca quem se inscreveu.',
        publicado: 'Este evento passou a aparecer na página de entrada.',
        tirado: 'Este evento deixou de aparecer na página de entrada.',
        titulo: 'Eventos',
        verComunidade: 'Voltar à comunidade',
        soParaMembros:
            'Este calendário só é visível a quem pertence à comunidade.',
        mostrarPassados: 'Mostrar também os que já passaram',
        todos: 'Todos os eventos',
        oQueVem: 'O que está para vir',
        semEventos: 'Nada marcado. Marca o primeiro aqui em baixo.',
        semHistorico: 'Ainda não houve eventos aqui.',
        marcarTitulo: 'Marcar um evento',
        nome: 'Nome',
        comeca: 'Começa',
        lugares: 'Lugares',
        lugaresAjuda: 'Deixa vazio para não haver limite.',
        descricao: 'Descrição',
        marcar: 'Marcar o evento',
        aMarcar: 'A marcar…',
        marcado: 'Evento marcado.',
        soQuemGere: 'Marcar eventos é de quem gere a comunidade.',
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
            'Inscrever-se e ter presença confirmada são coisas diferentes. Só quem organiza pode afirmar que alguém esteve lá, e é essa afirmação — não a inscrição — que dá direito a receber na divisão por participação da comunidade.',
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

    filiacao: {
        titulo: 'Servidor',
        jogaEm: 'Esta crew joga em',
        semServidor: 'Esta crew ainda não joga em nenhum servidor.',
        procurar: 'Procurar um servidor',
        semResultados: 'Nenhum servidor corresponde a isso.',
        pedir: 'Pedir para jogar aqui',
        pedidoEnviado: 'À espera de resposta de',
        desistir: 'Desistir do pedido',
        sair: 'Sair do servidor',
        crewsDoServidor: 'Crews',
        semCrews: 'Ainda não há crews a jogar neste servidor.',
        pedidos: 'Crews que pediram para jogar aqui',
        aceitar: 'Aceitar',
        recusar: 'Recusar',
        remover: 'Remover',
        crewsDoPlano: (usadas: number, limite: number) =>
            `${usadas} das ${limite} crews que o teu plano permite`,
        crewsSemLimite: (usadas: number) =>
            p.plural(usadas, {
                one: '1 crew joga aqui. O teu plano não põe limite.',
                other: `${usadas} crews jogam aqui. O teu plano não põe limite.`,
            }),
        planoCheio:
            'Já tens todas as crews que o teu plano permite. As que jogam aqui ficam; aceitar mais uma pede um plano maior.',
        verEscaloes: 'Ver os planos para servidores',
    },

    chaves: {
        titulo: 'Chaves do servidor',
        comoInstalar: 'Como se instala',
        paraQueServem:
            'Uma chave deixa o teu servidor reportar ao ViceHub — se está de pé, e com quantas pessoas dentro. Instala o recurso no servidor e cola lá a chave.',
        nome: 'Nome da chave',
        nomeExemplo: 'produção',
        criar: 'Criar uma chave',
        copiaAgora:
            'Copia-a agora. É a única vez que aparece — do lado de cá fica um resumo, e não a chave.',
        revogar: 'Revogar',
        revogada: 'revogada',
        nuncaUsada: 'nunca usada',
        usadaEm: (quando: string) => `usada a ${quando}`,
        aindaNenhuma: 'Este servidor ainda não tem chaves.',
        jogadoresOnline: (quantos: number) =>
            quantos === 1 ? '1 jogador online' : `${quantos} jogadores online`,
    },

    feed: {
        titulo: 'O que aconteceu',
        aindaNada:
            'Ainda nada. Entra numa crew, marca um evento, ou adiciona um amigo — isto enche-se sozinho.',
        eventoFeito: (xp: number) => `+${xp} XP de um evento ·`,
        entrouEm: 'entrou em',
        naoCarregou: 'Não foi possível carregar isto.',
    },

    amigos: {
        titulo: 'Amigos',
        adicionar: 'Adicionar',
        aceitar: 'Aceitar',
        recusar: 'Recusar',
        retirar: 'Retirar',
        desfazer: 'Desfazer',
        saoAmigos: 'Amigos',
        pedidoEnviado: 'Pedido enviado',
        pedidos: 'À tua espera',
        aindaNenhum: 'Ainda não tens amigos. Abre o perfil de alguém e pede.',
        desde: (quando: string) => `Amigos desde ${quando}`,
        naoCarregou: 'Não foi possível carregar os teus amigos.',
    },

    progressao: {
        nivelAtual: (nivel: number) => `Nível ${nivel}`,
        faltam: (xp: string, proximo: number) =>
            `Faltam ${xp} XP para o nível ${proximo}`,
        noTopo: (nivel: number) =>
            `Nível ${nivel} — o máximo que há, para já.`,
        historico: 'De onde veio este nível',
        aindaSemGanhos:
            'Ainda não há XP. Marca um evento, confirma quem apareceu, e conclui-o.',
        eventoApagado: 'um evento que já não existe',
        deOndeVem:
            'Uma crew ganha XP quando um evento que marcou acaba com gente que apareceu mesmo. Quem apareceu também ganha.',
    },

    zonaPerigo: {
        crewTitulo: 'Apagar esta crew',
        servidorTitulo: 'Apagar este servidor',
        crewExplicacao:
            'A crew sai do diretório, os membros perdem a adesão e deixa de estar filiada no servidor onde joga. O nome e a tag voltam a ficar livres.',
        servidorExplicacao:
            'O servidor sai do diretório, os membros perdem a adesão, as crews que lá jogam deixam de estar filiadas — incluindo as que o plano dele cobria — e as chaves deixam de servir. O nome volta a ficar livre.',
        escreveONome: (nome: string) => `Escreve ${nome} para confirmar.`,
        confirmacao: 'Confirmação',
        botao: 'Apagar',
        aApagar: 'A apagar…',
        temSaldo: 'A tesouraria ainda tem saldo. Divide-o ou retira-o primeiro.',
        temDecisoes: 'Há movimentos ou divisões por decidir na tesouraria.',
        temPlano: 'Há um plano ativo. Cancela-o primeiro.',
        naoFoiPossivel: 'Não foi possível apagar.',
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
