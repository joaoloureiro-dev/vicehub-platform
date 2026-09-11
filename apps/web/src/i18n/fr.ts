import type { Messages } from './en.js';
import type { Tools } from './tools.js';

/**
 * Francês.
 *
 * **A forma singular cobre o zero.** Em francês diz-se "0 membre", e não
 * "0 membres" — ao contrário do inglês, do português e do espanhol. Por
 * isso as formas `one` aqui interpolam o número em vez de o escreverem
 * como "1": escrito à mão, um evento sem inscritos anunciaria
 * "1 inscrit".
 */
export const fr = (p: Tools): Messages => ({
    comum: {
        aCarregar: 'Chargement…',
        aGuardar: 'Enregistrement…',
        guardar: 'Enregistrer',
        naoFoiPossivel: 'Cela n’a pas marché. Réessaie.',
        idioma: 'Langue',
    },

    nav: {
        crews: 'Crews',
        servidores: 'Serveurs',
        asMinhas: 'Les miennes',
        perfil: 'Profil',
        principal: 'Navigation principale',
        recrutamento: 'Recrutement',
        premium: 'Tarifs',
        entrar: 'Connexion',
        sair: 'Déconnexion',
    },

    landing: {
        aAcontecer: 'En ce moment sur ViceHub',
        aDecorrerAgora: 'En cours',
        comecaEm: (quando: string) => `Commence ${quando}`,
        naCrew: (nome: string) => `avec ${nome}`,
        titulo: 'Ta crew. Ton serveur. Ta part.',
        subtitulo:
            'ViceHub, c’est là où les communautés de jeu s’organisent : dirige ta crew, fais circuler ce que vous gagnez, et prouve qui était vraiment là.',
        criarConta: 'Créer mon compte',
        verRecrutamento: 'Qui recrute',
        jaTenhoConta: 'J’ai déjà un compte',

        quemRecruta: 'Crews qui cherchent du monde',
        agoraOnline: 'Serveurs en ligne maintenant',
        verTudo: 'Voir tout',
        jogadores: (n: number) =>
            p.plural(n, { one: '1 joueur', other: `${n} joueurs` }),
        planosTitulo: 'Ce que \u00e7a co\u00fbte',
        planosGratis:
            'Jouer est gratuit, et le restera : ton profil, ta banni\u00e8re, postuler \u00e0 des crews, en \u00eatre membre, organiser des \u00e9v\u00e9nements, venir. Ce qui se paie, c\u2019est de d\u00e9placer l\u2019argent.',
        planoCrew: 'Crew',
        planoCrewPreco: '4,99 \u20ac / mois',
        planoCrewTexto:
            'Une tr\u00e9sorerie qui tombe juste : proposer, approuver et partager ce que la crew gagne \u2014 tout le monde pay\u00e9 en m\u00eame temps, ou personne. Trente jours pour essayer.',
        planoServidor: 'Serveur',
        planoServidorPreco: '\u00e0 partir de 14,99 \u20ac / mois',
        planoServidorTexto:
            "Jusqu'\u00e0 10 crews sur votre serveur, et une tr\u00e9sorerie pour les payer. Plus de crews, une offre plus grande.",
        crewsTitulo: 'Crews et serveurs',
        crewsTexto:
            'Rassemble les tiens avec des rangs qui veulent dire quelque chose. Les candidatures reçoivent une réponse, elles ne sont pas ignorées.',

        tesourariaTitulo: 'Une trésorerie qui tombe juste',
        tesourariaTexto:
            'Des mouvements par proposition et approbation, avec quatre soldes pour que personne n’engage deux fois le même argent. Ou tout le monde est payé, ou personne.',

        eventosTitulo: 'Payé pour être venu',
        eventosTexto:
            'Vous faites le travail, on confirme qui était là, et on partage selon la présence — avec des poids, parce que celui qui mène un braquage prend souvent plus.',

        verPremium: 'Ce que donne le premium',
        honesto: 'Encore au début',
        honestoTexto:
            'ViceHub se construit à découvert, en commençant par GTA VI. Certaines choses sont prêtes, d’autres non, et le plus rapide pour changer ça est de nous dire ce qui manque.',
    },
    auth: {
        ouEntao: 'ou',
        entrarComDiscord: 'Continuer avec Discord',
        entrarComGoogle: 'Continuer avec Google',
        entrarTitulo: 'Se connecter',
        entrarSub: 'Bon retour sur ViceHub.',
        email: 'E-mail',
        password: 'Mot de passe',
        aEntrar: 'Connexion…',
        credenciaisErradas: 'Cet e-mail et ce mot de passe ne correspondent pas.',
        contaBloqueada: 'Trop de tentatives échouées. Réessaie dans un moment.',
        esqueciPassword: 'J’ai oublié mon mot de passe',
        criarConta: 'Créer un compte',
        jaTensConta: 'Tu as déjà un compte ?',

        registoTitulo: 'Créer un compte',
        registoSub: 'Cela prend moins d’une minute.',
        nomeJogador: 'Nom de joueur',
        aCriar: 'Création…',
        passwordMinima: (n: number) => `Au moins ${n} caractères.`,
        emailOcupado: 'Un compte existe déjà avec cet e-mail.',
        nomeOcupado: 'Ce nom est déjà pris. Choisis-en un autre.',
        naoFoiPossivelCriar: 'Le compte n’a pas pu être créé.',

        recuperarTitulo: 'Réinitialiser le mot de passe',
        recuperarSub:
            'Indique-nous l’adresse du compte et nous envoyons un lien pour définir un nouveau mot de passe.',
        enviarLink: 'Envoyer le lien',
        aEnviar: 'Envoi…',
        verificaEmail: 'Vérifie tes e-mails',
        seExistir:
            'Si un compte existe pour cette adresse, le lien est en route. Il sert une fois et expire dans l’heure.',
        voltarAoLogin: 'Retour à la connexion',
        jaMeLembro: 'Finalement je m’en souviens',

        novaPasswordTitulo: 'Nouveau mot de passe',
        novaPasswordSub:
            'En enregistrant, toutes les sessions ouvertes sur ce compte sont fermées — y compris celle de qui ne devrait pas y être.',
        novaPassword: 'Nouveau mot de passe',
        guardarPassword: 'Enregistrer le mot de passe',
        linkNaoServe: 'Ce lien ne fonctionne plus. Demandes-en un autre.',
        pedirOutroLink: 'Demander un autre lien',
        naoFoiPossivelPassword: 'Le mot de passe n’a pas pu être défini.',

        confirmarEmailTitulo: 'Confirmer l’e-mail',
        aConfirmar: 'Confirmation…',
        emailConfirmado: 'Adresse confirmée. Ton compte est prêt.',
        linkSemCodigo:
            'Cette adresse ne porte aucun code. Ouvre le lien tel qu’il est arrivé.',
        irParaViceHub: 'Aller sur ViceHub',
    },

    crews: {
        titulo: 'Crews',
        criar: 'Créer une crew',
        procurar: 'Chercher par nom ou par tag',
        procurarLabel: 'Chercher des crews',
        botaoProcurar: 'Chercher',
        emDestaque: 'En vedette',
        destaque: 'En vedette',
        aRecrutarAgora: 'À la recherche de monde',
        todas: 'Toutes les crews',
        resultados: (termo: string) => `Résultats pour « ${termo} »`,
        semResultados: 'Aucune crew de ce nom. Essaie un autre terme.',
        aindaNaoHa: 'Pas encore de crews. Crée la première.',
        anterior: 'Précédent',
        seguinte: 'Suivant',
        paginaDe: (atual: number, total: number) => `Page ${atual} sur ${total}`,
        ordenarPor: 'Trier par',
        ordemRecentes: 'Plus récents',
        ordemNivel: 'Niveau',
        ordemNome: 'Nom',
        lugar: (posicao: number, total: number) =>
            `#${posicao} sur ${total} crews classés`,
        naoCarregou: 'L’annuaire n’a pas pu être chargé.',
        nivel: (n: number) => `Niveau ${n}`,
        membros: (n: number) =>
            p.plural(n, { one: `${n} membre`, other: `${n} membres` }),

        criarTitulo: 'Créer une crew',
        criarSub: 'Tu en deviens le chef, et tu pourras inviter qui tu veux ensuite.',
        nome: 'Nom',
        nomeAjuda: 'Entre 3 et 48 caractères.',
        tag: 'Tag',
        tagAjuda:
            'Entre 2 et 8 lettres ou chiffres. Il apparaît à côté du nom, ainsi : [VICE].',
        descricao: 'Description',
        caracteresDisponiveis: (n: number) =>
            p.plural(n, {
                one: `Facultatif. Il reste ${n} caractère.`,
                other: `Facultatif. Il reste ${n} caractères.`,
            }),
        criarBotao: 'Créer la crew',
        nomeOcupado: 'Une crew porte déjà ce nom.',
        tagOcupada: 'Ce tag est déjà pris. Choisis-en un autre.',
        naoFoiPossivelCriar: 'La crew n’a pas pu être créée.',
        voltarDiretorio: 'Retour à l’annuaire',

        naoEncontrada: 'Nous n’avons pas trouvé cette crew.',
        xp: 'XP',
        influencia: 'Influence',
        prestigio: 'Prestige',
        contagemMembros: 'Membres',
        recruta: 'Recrute',
        recrutaTitulo: 'Cette crew recrute',
        recrutaDesde: (data: string) => `Recrute depuis le ${data}.`,
        recrutaLabel: 'Indiquer que cette crew recrute',
        recrutaAjuda:
            'Cela place la crew sur le tableau de recrutement et la signale dans l\u2019annuaire. Rien d\u2019autre ne change : il faut toujours postuler, et c\u2019est toujours toi qui décides. Désactive-le quand tu es au complet — le tableau montre depuis combien de temps chaque annonce est en ligne.',
        recrutamentoTitulo: 'Crews qui recrutent',
        recrutamentoExplica: 'Uniquement les crews qui ont dit chercher du monde.',
        verQuemRecruta: 'Voir quelles crews recrutent',
        verTodas: 'Voir toutes les crews',
        requisitos: 'Ce que cette crew attend de toi',
        requisitosAjuda:
            'Une condition par ligne. Personne n\u2019est vérifié là-dessus : cela dit à qui postule ce qui l\u2019attend, et c\u2019est toujours toi qui décides qui entre.',
        cartaLabel: 'Dis-leur qui tu es',
        cartaPlaceholder: 'Âge, quand tu joues, ce que tu cherches…',
        cartaAjuda:
            'Facultatif, mais c\u2019est la seule chose qu\u2019ils liront avant de décider. Seuls ceux qui dirigent la crew le voient.',
        pedirEntrada: 'Demander à rejoindre',
        responderamQueNao: 'Ils ont répondu non',
        candidaturaRecusada: 'Pas cette fois',
        enviadaEm: (data: string) => `Envoyée le ${data}`,
        candidaturaEnviada: 'Candidature envoyée',
        retirarCandidatura: 'Retirer la candidature',
        sair: 'Quitter la crew',
        tesouraria: 'Trésorerie',
        eventos: 'Événements',
        entraParaCandidatar: 'pour postuler à cette crew.',
        entraLink: 'Connecte-toi',
        candidaturasPorResponder: 'Candidatures en attente',
        aceitar: 'Accepter',
        recusar: 'Refuser',
        remover: 'Exclure',
        listaMembros: 'Membres',

        asMinhasTitulo: 'Où j’appartiens',
        minhasCrews: 'Crews',
        meusServidores: 'Serveurs',
        semComunidades: 'Tu n’appartiens encore à aucune crew ni serveur.',
        naoCarregouMinhas: 'Tes crews n’ont pas pu être chargées.',
        procuraUma: 'Cherches-en une',
        ouCriaTua: 'ou crée la tienne',
        definicoes: 'Réglages de la crew',
        definicoesGuardadas: 'Réglages de la crew enregistrés.',
        nomeJaExiste: 'Une crew porte déjà ce nom.',
        planoVemDoServidor: 'Le plan qui couvre cette crew vient du serveur',
        planoAtivo:
            'L’offre de la crew est active. La bannière et la couleur apparaissent sur sa page publique.',
        precisaDePlano:
            "Ces champs font partie de l'offre premium — et l'offre appartient à la crew, pas à toi. Tu peux les remplir, mais ils ne sont enregistrés que tant que la crew en a une.",
        verPremium: 'Voir ce que le premium donne à la crew',
        aEsperaResposta: 'En attente de réponse',
    },

    cargos: {
        crew_leader: 'Chef',
        crew_officer: 'Officier',
        crew_member: 'Membre',
        server_owner: 'Propriétaire',
        server_moderator: 'Modérateur',
        server_member: 'Membre',
    },

    servidores: {
        titulo: 'Serveurs',
        registar: 'Enregistrer un serveur',
        procurar: 'Chercher par nom',
        procurarLabel: 'Chercher des serveurs',
        soOnline: 'N’afficher que ceux qui sont en ligne',
        online: 'En ligne',
        offline: 'Hors ligne',
        todos: 'Tous les serveurs',
        semResultados: 'Aucun serveur avec ces filtres.',
        aindaNaoHa: 'Pas encore de serveurs. Enregistre le premier.',
        naoCarregou: 'Les serveurs n’ont pas pu être chargés.',
        registarTitulo: 'Enregistrer un serveur',
        registarSub: 'Tu en deviens le propriétaire, et tu pourras accepter qui postule.',
        regiao: 'Région',
        regiaoAjuda:
            'Facultatif. Aide qui cherche une faible latence, par exemple Europe.',
        registarBotao: 'Enregistrer le serveur',
        nomeOcupado: 'Un serveur porte déjà ce nom.',
        naoFoiPossivelRegistar: 'Le serveur n’a pas pu être enregistré.',
        naoEncontrado: 'Nous n’avons pas trouvé ce serveur.',
        sair: 'Quitter le serveur',
        definicoes: 'Réglages du serveur',
        definicoesGuardadas: 'Réglages du serveur enregistrés.',
        nomeJaExiste: 'Un serveur porte déjà ce nom.',
        nome: 'Nom',
        descricao: 'Description',
        requisitos: 'Ce que ce serveur vous demande',
        requisitosAjuda:
            "Une condition par ligne. Personne n'est vérifié là-dessus : cela dit à quoi s'attendre avant de postuler, et c'est toujours vous qui décidez qui entre.",
        reportaPorSi:
            "Ce serveur fait son propre rapport : être en ligne vient de son dernier signal, et non d'une case cochée ici.",
        estaOnline: 'Le serveur est en ligne en ce moment',
        planoAtivo:
            'L’offre du serveur est active. La bannière et la couleur apparaissent sur sa page publique.',
        precisaDePlano:
            "Ces champs font partie de l'offre premium — et l'offre appartient au serveur, pas à toi. Tu peux les remplir, mais ils ne sont enregistrés que tant que le serveur en a une.",
        verPremium: 'Voir ce que le premium donne au serveur',
        entraParaCandidatar: 'pour postuler à ce serveur.',
    },

    conquistas: {
        titulo: 'Hauts faits',
        nomes: {
            attended_1: 'Présent',
            attended_10: 'Dix soirées',
            attended_50: 'Cinquante soirées',
            ran_1: 'A organisé un événement',
            ran_10: 'A organisé dix événements',
            ran_50: 'A organisé cinquante événements',
            paid_1: 'A payé les siens',
            paid_10: 'A payé dix fois',
            paid_50: 'A payé cinquante fois',
            level_5: 'Niveau 5',
            level_10: 'Niveau 10',
            level_25: 'Niveau 25',
        },
    },

    perfil: {
        apagarConta: 'Supprimer mon compte',
        apagarContaExplicacao:
            'Tu peux partir quand tu veux. Le compte et tout ce qui t\u2019identifie disparaissent ; ce dont tes crews ont besoin pour que leurs comptes tombent juste reste, sous un nom qui ne dit rien de toi.',
        apagarContaFica:
            'L\u2019adresse, le nom, l\u2019image et le texte sont effacés, ainsi que le mot de passe et les connexions Discord ou Google. Ce qui reste : les mouvements que tu as proposés ou approuvés, et les événements où tu étais — cela appartient à tes crews et non à toi, et les retirer laisserait leurs comptes faux.',
        apagarContaPassword: 'Ton mot de passe, si le compte en a un',
        apagarContaConfirmar: 'Supprimer le compte définitivement',
        titulo: 'Mon profil',
        verPublico: 'Voir en public',
        naoCarregou: 'Ton profil n’a pas pu être chargé.',
        jogador: 'Joueur',
        nivel: 'Niveau',
        reputacao: 'Réputation',
        conta: 'Compte',
        confirmado: 'Confirmé',
        porConfirmar: 'À confirmer',
        plano: 'Formule',
        semPlano: 'Sans formule',
        premiumVitalicio: 'Premium à vie',
        premiumAte: (data: string) => `Premium jusqu’au ${data}`,
        enviarConfirmacao: 'Envoyer l’e-mail de confirmation',
        emailEnviado: 'E-mail envoyé',
        naoFoiPossivelEmail: 'L’e-mail de confirmation n’a pas pu être envoyé.',
        apresentacao: 'Présentation',
        sobreTi: 'À propos de toi',
        avatar: 'Avatar',
        perfilGuardado: 'Profil enregistré.',
        naoFoiPossivelPerfil: 'Le profil n’a pas pu être enregistré.',
        personalizacao: 'Personnalisation',
        premium: 'Premium',
        banner: 'Bannière',
        cor: 'Couleur d’accent',
        corAjuda: 'Hexadécimal à six chiffres, comme #E93CEF.',
        guardarPersonalizacao: 'Enregistrer la personnalisation',
        personalizacaoGuardada: 'Personnalisation enregistrée.',
        ehPremium: 'La personnalisation fait partie de la formule premium.',
        naoFoiPossivelPersonalizacao:
            'La personnalisation n’a pas pu être enregistrée.',
        naoEncontrado: 'Nous n’avons pas trouvé ce joueur.',
        desde: 'Depuis',
        irParaCrews: 'Aller aux crews',
    },

    premium: {
        etiqueta: 'Premium',
        titulo: "L'offre est celle de la communauté, pas la vôtre",
        subtitulo:
            "Jouer sur ViceHub est gratuit, et le reste. Ce qui se paie, c'est gérer une communauté : déplacer l'argent que la crew gagne, et avoir des crews sur votre serveur.",
        tituloComunidade: (nome: string) => `Premium pour ${nome}`,
        subtituloCrew:
            "L'offre appartient à la crew, pas à celui qui la paie. Tant qu'elle est active, qui gère la crew peut déplacer son argent — et définir sa bannière et sa couleur.",
        crewCobertaPeloServidor: (servidor: string) =>
            `Cette crew est déjà couverte par le plan de ${servidor}, le serveur où elle joue. Elle le garde tant qu'elle y joue.`,
        crewTemPlano: 'Cette crew a déjà une offre active.',
        irParaCrew: 'Aller à la crew',
        subtituloServidor:
            "L'offre appartient au serveur, pas à celui qui la paie. Elle décide combien de crews peuvent y jouer, et ouvre la trésorerie du serveur.",
        servidorDaPersonalizacao:
            'Payez les crews qui jouent sur votre serveur, directement depuis sa trésorerie.',
        servidorDaEquipa:
            "Une offre pour tout le serveur, et pour les crews qui y jouent. Ça ne dépend pas de qui a payé.",
        servidorTemPlano: 'Ce serveur a déjà une offre active.',
        irParaServidor: 'Aller au serveur',
        aTesourariaDaCrew: 'La trésorerie d\u2019une crew',
        escolheEscalao: 'Choisis ton palier',
        ateCrews: (n: number) =>
            p.plural(n, {
                one: 'Jusqu\u2019à 1 crew jouant sur ton serveur',
                other: `Jusqu\u2019à ${n} crews jouant sur ton serveur`,
            }),
        semLimiteDeCrews: 'Aucune limite de crews jouant là-bas',
        todosPorMes: 'Tous les prix sont par mois.',
        porMes: 'par mois',
        planoEDeComunidade:
            "Il n'y a rien à acheter ici pour votre compte. L'offre appartient à une crew ou à un serveur — ouvrez celle que vous gérez et achetez-la là.",
        asMinhasComunidades: 'Mes communautés',
        oQueDaPersonalizacao:
            "Une trésorerie qui tombe juste : une crew propose, approuve et partage ce qu'elle gagne — tout le monde payé en même temps, ou personne.",
        oQueDaCrew:
            "Postuler, être membre, organiser des événements et venir restent gratuits pour tout le monde. Votre profil aussi.",
        crewDaPersonalizacao:
            "Une trésorerie qui tombe juste : proposer, approuver et partager ce que la crew gagne — tout le monde payé en même temps, ou personne.",
        crewDaEquipa:
            "Une offre pour toute la crew. Qui la gère peut déplacer l'argent — ça ne dépend pas de qui a payé.",
        oQueDaApoio:
            "C'est ce qui fait tourner la plateforme, et ça paie le temps que tout ça demande.",
        comprar: 'Passer en premium',
        aAbrir: 'Ouverture du paiement…',
        cancelarQuando: 'Annule quand tu veux. Ça court jusqu’à la fin du mois payé.',
        criarConta: 'Créer un compte',
        jaTenhoConta: 'J’ai déjà un compte',
        tensPlano: 'Ton offre est active.',
        tensPlanoAte: (data: string) => `Ton offre est active jusqu’au ${data}.`,
        tensVitalicio: 'Tu as le premium à vie. Il ne se termine pas, et il n’est jamais facturé.',
        irParaPerfil: 'Aller à mon profil',
        aindaNaoAbriu:
            "L'achat n'est pas encore ouvert — il ouvre bientôt. En attendant, tout le reste de ViceHub fonctionne normalement.",
        naoFoiPossivelComprar: 'Le paiement n’a pas pu s’ouvrir. Réessaie dans un moment.',
        notaVitalicio:
            'Le premium à vie n’est pas en vente. Il est donné à la main, un par un, à celles et ceux qui ont soutenu ViceHub au début.',
    },

    tesouraria: {
        titulo: 'Trésorerie',
        verCrew: 'Voir la crew',
        precisaDePlano:
            "Déplacer de l'argent fait partie de l'offre de la crew — l'offre est celle de la crew, pas la vôtre. Le solde, le relevé et les partages passés restent visibles par tous ; proposer et approuver demandent une offre active.",
        verPlano: "Voir ce que l'offre donne à la crew",
        avaliacaoAcaba: (dias: number) =>
            p.plural(dias, {
                one: "Votre essai se termine demain. Ensuite le solde reste visible, mais proposer et approuver demandent une offre.",
                other: `Votre essai se termine dans ${dias} jours. Ensuite le solde reste visible, mais proposer et approuver demandent une offre.`,
            }),
        soParaMembros:
            'Les comptes d’une crew ne sont visibles que par ses membres.',
        disponivel: 'Disponible',
        liquidado: 'Réglé',
        aEntrar: 'À entrer',
        aSair: 'À sortir',
        explicacaoDisponivel:
            'Le disponible déduit déjà les sorties en attente de décision. C’est ce chiffre qui dit combien on peut engager sans compter deux fois le même argent.',
        proporTitulo: 'Proposer un mouvement',
        proporAviso:
            'Proposer ne déplace rien. Cela reste en attente jusqu’à ce que quelqu’un d’habilité approuve.',
        montante: 'Montant',
        montanteAjuda: 'En unités entières de la monnaie du jeu.',
        direcao: 'Sens',
        entrada: 'Entrée',
        saida: 'Sortie',
        categoria: 'Catégorie',
        descricao: 'Description',
        propor: 'Proposer le mouvement',
        aPropor: 'Proposition…',
        proposto: 'Mouvement proposé. Il attend une décision.',
        extrato: 'Relevé',
        semMovimentos: 'Pas encore de mouvements.',
        aprovar: 'Approuver',
        recusar: 'Refuser',
        cancelar: 'Annuler',
        aprovado: 'Mouvement approuvé.',
        recusado: 'Mouvement refusé.',
        cancelado: 'Proposition annulée.',
        naoFoiPossivel: 'L’opération n’a pas pu être menée à bien.',
        divisoes: 'Partages des gains',
        pessoas: (n: number) =>
            p.plural(n, { one: `${n} personne`, other: `${n} personnes` }),
    },

    categorias: {
        contribution: 'Contribution',
        server_costs: 'Frais de serveur',
        marketing: 'Marketing',
        event: 'Événement',
        prize: 'Prix',
        service: 'Service',
        payout: 'Versement',
        other: 'Autre',
    },

    estadosMovimento: {
        pending: 'En attente',
        approved: 'Approuvé',
        rejected: 'Refusé',
        canceled: 'Annulé',
    },

    bases: {
        equal: 'À parts égales',
        by_role: 'Pondéré par rang',
        manual: 'Montants indiqués un à un',
        participation: 'Selon qui est venu',
    },

    eventos: {
        quemVe: 'Qui le voit',
        naMontra: "Sur la page d'accueil",
        soAComunidade: 'Cette communauté seulement',
        porNaMontra: "Afficher sur la page d'accueil",
        tirarDaMontra: "Retirer de la page d'accueil",
        montraAjuda:
            "Désactivé par défaut. Activé, le nom, l'heure et la communauté s'affichent à qui ouvre ViceHub — jamais qui s'est inscrit.",
        publicado: "Cet événement apparaît désormais sur la page d'accueil.",
        tirado: "Cet événement n'apparaît plus sur la page d'accueil.",
        titulo: 'Événements',
        verComunidade: 'Revenir à la communauté',
        soParaMembros:
            'Ce calendrier n’est visible que par les membres de la communauté.',
        mostrarPassados: 'Afficher aussi ceux qui sont passés',
        todos: 'Tous les événements',
        oQueVem: 'Ce qui arrive',
        semEventos: 'Rien de prévu. Planifie le premier ci-dessous.',
        semHistorico: 'Aucun événement n’a encore eu lieu ici.',
        marcarTitulo: 'Planifier un événement',
        nome: 'Nom',
        comeca: 'Commence',
        lugares: 'Places',
        lugaresAjuda: 'Laisse vide pour qu’il n’y ait pas de limite.',
        descricao: 'Description',
        marcar: 'Planifier l’événement',
        aMarcar: 'Planification…',
        marcado: 'Événement planifié.',
        soQuemGere:
            'Planifier des événements revient à qui dirige la communauté.',
        naoFoiPossivelMarcar: 'L’événement n’a pas pu être planifié.',
        inscritos: (n: number) =>
            p.plural(n, { one: `${n} inscrit`, other: `${n} inscrits` }),
        deLugares: (n: number) => ` de ${n}`,
        comPresenca: (n: number) =>
            p.plural(n, {
                one: `${n} présence confirmée`,
                other: `${n} présences confirmées`,
            }),

        naoEncontrado: 'Nous n’avons pas trouvé cet événement.',
        todosOsEventos: 'Tous les événements',
        estado: 'Statut',
        contagemInscritos: 'Inscrits',
        confirmados: 'Confirmés',
        inscreverMe: 'M’inscrire',
        inscrito: 'Inscrit',
        retirarInscricao: 'Retirer l’inscription',
        presencaConfirmada: (peso: number) =>
            `Présence confirmée · poids ${peso}`,
        inscricaoFeita:
            'Inscription faite. La présence est confirmée par l’organisateur.',
        inscricaoRetirada: 'Inscription retirée.',
        soQuemOrganiza: 'Cela revient à l’organisateur de l’événement.',
        quemSeInscreveu: 'Qui s’est inscrit',
        diferenca:
            'S’inscrire et avoir sa présence confirmée sont deux choses différentes. Seul l’organisateur peut affirmer que quelqu’un était là, et c’est cette affirmation — non l’inscription — qui donne droit à une part dans le partage par participation de la communauté.',
        semInscricoes: 'Pas encore d’inscriptions.',
        pesoDe: (nome: string) => `Poids de ${nome}`,
        confirmarPresenca: 'Confirmer la présence',
        naoApareceu: 'Absent',
        presencaDe: (nome: string) => `Présence de ${nome} confirmée.`,
        ausente: (nome: string) => `${nome} marqué absent.`,
        comecar: 'Commencer',
        terminar: 'Terminer',
        cancelarEvento: 'Annuler',
        estadoMudou: (estado: string) => `Événement : ${estado.toLowerCase()}.`,
        jaPodeDividir: (n: number) =>
            p.plural(n, {
                one: `${n} présence confirmée. La crew peut désormais partager les gains par participation à partir de cet événement.`,
                other: `${n} présences confirmées. La crew peut désormais partager les gains par participation à partir de cet événement.`,
            }),
    },

    filiacao: {
        titulo: 'Serveur',
        jogaEm: 'Cette crew joue sur',
        semServidor: 'Cette crew ne joue encore sur aucun serveur.',
        procurar: 'Chercher un serveur',
        semResultados: 'Aucun serveur ne correspond.',
        pedir: 'Demander à jouer ici',
        pedidoEnviado: 'En attente de la réponse de',
        desistir: 'Retirer la demande',
        sair: 'Quitter le serveur',
        crewsDoServidor: 'Crews',
        semCrews: 'Aucune crew ne joue encore sur ce serveur.',
        pedidos: 'Crews qui demandent à jouer ici',
        aceitar: 'Accepter',
        recusar: 'Refuser',
        remover: 'Retirer',
        crewsDoPlano: (usadas: number, limite: number) =>
            `${usadas} des ${limite} crews que votre offre autorise`,
        crewsSemLimite: (usadas: number) =>
            p.plural(usadas, {
                one: '1 crew joue ici. Votre offre ne met pas de limite.',
                other: `${usadas} crews jouent ici. Votre offre ne met pas de limite.`,
            }),
        planoCheio:
            "Vous avez déjà toutes les crews que votre offre autorise. Celles qui jouent ici restent ; en accepter une autre demande une offre plus grande.",
        verEscaloes: 'Voir les offres pour serveurs',
    },

    chaves: {
        titulo: 'Clés du serveur',
        comoInstalar: 'Comment l’installer',
        paraQueServem:
            "Une clé permet à ton serveur de faire son rapport à ViceHub — s'il tourne, et avec combien de monde. Installe la ressource sur le serveur et colles-y la clé.",
        nome: 'Nom de la clé',
        nomeExemplo: 'production',
        criar: 'Créer une clé',
        copiaAgora:
            "Copie-la maintenant. C'est la seule fois qu'elle apparaît — de notre côté il ne reste qu'une empreinte, pas la clé.",
        revogar: 'Révoquer',
        revogada: 'révoquée',
        nuncaUsada: 'jamais utilisée',
        usadaEm: (quando: string) => `utilisée le ${quando}`,
        aindaNenhuma: "Ce serveur n'a encore aucune clé.",
        jogadoresOnline: (quantos: number) =>
            quantos === 1 ? '1 joueur en ligne' : `${quantos} joueurs en ligne`,
    },

    feed: {
        titulo: 'Ce qui s’est passé',
        aindaNada:
            'Rien encore. Rejoins un crew, organise un événement ou ajoute un ami — ça se remplit tout seul.',
        eventoFeito: (xp: number) => `+${xp} XP d’un événement ·`,
        entrouEm: 'a rejoint',
        naoCarregou: 'Impossible de charger ceci.',
    },

    amigos: {
        titulo: 'Amis',
        adicionar: 'Ajouter',
        aceitar: 'Accepter',
        recusar: 'Refuser',
        retirar: 'Retirer',
        desfazer: 'Supprimer',
        saoAmigos: 'Amis',
        pedidoEnviado: 'Demande envoyée',
        pedidos: 'En attente de toi',
        aindaNenhum: 'Pas encore d’amis. Ouvre le profil de quelqu’un et demande.',
        desde: (quando: string) => `Amis depuis ${quando}`,
        naoCarregou: 'Impossible de charger tes amis.',
    },

    progressao: {
        nivelAtual: (nivel: number) => `Niveau ${nivel}`,
        faltam: (xp: string, proximo: number) =>
            `${xp} XP pour le niveau ${proximo}`,
        noTopo: (nivel: number) =>
            `Niveau ${nivel} — le maximum pour l’instant.`,
        historico: 'D’où vient ce niveau',
        aindaSemGanhos:
            'Pas encore d’XP. Organise un événement, confirme qui est venu, puis termine-le.',
        eventoApagado: 'un événement qui n’existe plus',
        deOndeVem:
            'Un crew gagne de l’XP quand un événement qu’il a organisé se termine avec des gens qui sont venus pour de vrai. Ceux qui sont venus en gagnent aussi.',
    },

    zonaPerigo: {
        crewTitulo: 'Supprimer ce crew',
        servidorTitulo: 'Supprimer ce serveur',
        crewExplicacao:
            'Le crew quitte l’annuaire, ses membres perdent leur adhésion et il n’est plus affilié au serveur où il joue. Le nom et le tag redeviennent libres.',
        servidorExplicacao:
            'Le serveur quitte l’annuaire, ses membres perdent leur adhésion, les crews qui y jouent ne sont plus affiliés — y compris ceux que son abonnement couvrait — et ses clés cessent de fonctionner. Le nom redevient libre.',
        escreveONome: (nome: string) => `Tape ${nome} pour confirmer.`,
        confirmacao: 'Confirmation',
        botao: 'Supprimer',
        aApagar: 'Suppression…',
        temSaldo:
            'La trésorerie a encore un solde. Répartis-le ou retire-le d’abord.',
        temDecisoes:
            'Des mouvements ou des répartitions attendent encore une décision dans la trésorerie.',
        temPlano: 'Un abonnement est actif. Annule-le d’abord.',
        naoFoiPossivel: 'La suppression n’a pas fonctionné.',
    },

    estadosEvento: {
        scheduled: 'Planifié',
        ongoing: 'En cours',
        completed: 'Terminé',
        canceled: 'Annulé',
    },

    participacao: {
        signed_up: 'Inscrit',
        confirmed: 'Présence confirmée',
        no_show: 'Absent',
        withdrawn: 'S’est retiré',
    },
});
