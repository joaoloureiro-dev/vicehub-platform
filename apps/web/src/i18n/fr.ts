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
        entrar: 'Connexion',
        sair: 'Déconnexion',
    },

    landing: {
        titulo: 'Ta crew. Ton serveur. Ta part.',
        subtitulo:
            'ViceHub, c’est là où les communautés de jeu s’organisent : dirige ta crew, fais circuler ce que vous gagnez, et prouve qui était vraiment là.',
        criarConta: 'Créer mon compte',
        verCrews: 'Voir les crews',
        jaTenhoConta: 'J’ai déjà un compte',

        crewsTitulo: 'Crews et serveurs',
        crewsTexto:
            'Rassemble les tiens avec des rangs qui veulent dire quelque chose. Les candidatures reçoivent une réponse, elles ne sont pas ignorées.',

        tesourariaTitulo: 'Une trésorerie qui tombe juste',
        tesourariaTexto:
            'Des mouvements par proposition et approbation, avec quatre soldes pour que personne n’engage deux fois le même argent. Ou tout le monde est payé, ou personne.',

        eventosTitulo: 'Payé pour être venu',
        eventosTexto:
            'Vous faites le travail, on confirme qui était là, et on partage selon la présence — avec des poids, parce que celui qui mène un braquage prend souvent plus.',

        honesto: 'Encore au début',
        honestoTexto:
            'ViceHub se construit à découvert, en commençant par GTA VI. Certaines choses sont prêtes, d’autres non, et le plus rapide pour changer ça est de nous dire ce qui manque.',
    },
    auth: {
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
        todas: 'Toutes les crews',
        resultados: (termo: string) => `Résultats pour « ${termo} »`,
        semResultados: 'Aucune crew de ce nom. Essaie un autre terme.',
        aindaNaoHa: 'Pas encore de crews. Crée la première.',
        anterior: 'Précédent',
        seguinte: 'Suivant',
        paginaDe: (atual: number, total: number) => `Page ${atual} sur ${total}`,
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
        pedirEntrada: 'Demander à rejoindre',
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
        entraParaCandidatar: 'pour postuler à ce serveur.',
    },

    perfil: {
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
        planoAtivo:
            'Ta formule est active. La bannière et la couleur apparaissent sur ton profil public.',
        precisaDePlano:
            'Ces champs font partie de la formule premium. Tu peux les remplir, mais ils ne sont enregistrés qu’avec une formule active.',
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

    tesouraria: {
        titulo: 'Trésorerie',
        verCrew: 'Voir la crew',
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
        titulo: 'Événements',
        verCrew: 'Voir la crew',
        soParaMembros:
            'Le calendrier d’une crew n’est visible que par ses membres.',
        mostrarPassados: 'Afficher aussi ceux qui sont passés',
        todos: 'Tous les événements',
        oQueVem: 'Ce qui arrive',
        semEventos: 'Rien de prévu. Planifie le premier ci-dessous.',
        semHistorico: 'Cette crew n’a pas encore eu d’événements.',
        marcarTitulo: 'Planifier un événement',
        nome: 'Nom',
        comeca: 'Commence',
        lugares: 'Places',
        lugaresAjuda: 'Laisse vide pour qu’il n’y ait pas de limite.',
        descricao: 'Description',
        marcar: 'Planifier l’événement',
        aMarcar: 'Planification…',
        marcado: 'Événement planifié.',
        soQuemGere: 'Planifier des événements revient à qui dirige la crew.',
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
            'S’inscrire et avoir sa présence confirmée sont deux choses différentes. Seul l’organisateur peut affirmer que quelqu’un était là, et c’est cette affirmation — non l’inscription — qui donne droit à une part dans le partage par participation.',
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
