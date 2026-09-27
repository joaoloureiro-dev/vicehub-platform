import type { Idioma } from './idiomas.js';

/**
 * O que a plataforma escreve, nos quatro idiomas.
 *
 * Um email é a única coisa que sai do ViceHub sem passar por um ecrã, e
 * por isso é o único sítio onde a API tem de saber falar mais do que uma
 * língua. São dois emails, e os dois chegam no pior momento possível —
 * um a quem está trancado fora da conta, outro a quem acabou de criar
 * uma. Um deles em português a quem escolheu francês é a plataforma a
 * dizer "não é contigo que eu estava a contar".
 *
 * Texto simples e nada de HTML: estes emails são um link e a razão de
 * ele existir. Uma versão em HTML seria uma segunda cópia de cada
 * frase — e é a cópia que fica por traduzir quando alguém mexe numa
 * delas.
 */
export interface Email {
    subject: string;
    text: string;
}

interface Recuperacao {
    username: string;
    link: string;
    horas: number;
}

interface Confirmacao {
    username: string;
    link: string;
}

/**
 * Recuperar a password.
 *
 * As quatro versões dizem exatamente o mesmo, incluindo a última frase:
 * quem não pediu nada tem de ficar a saber que não precisa de fazer
 * nada. É a frase que evita o pânico de quem recebe isto sem ter
 * mexido em nada, e traduzi-la por alto seria traduzir mal a única
 * parte que é para quem não é o destinatário.
 */
const RECUPERACAO: Record<Idioma, (dados: Recuperacao) => Email> = {
    en: ({ username, link, horas }) => ({
        subject: 'Reset your ViceHub password',
        text: [
            `Hello ${username},`,
            '',
            'Someone asked to set a new password on this account.',
            'If that was you, follow this link:',
            '',
            link,
            '',
            `The link works once and expires in ${horas} hour(s).`,
            '',
            'If it was not you, there is nothing to do: your current',
            'password still works and this link expires on its own.',
        ].join('\n'),
    }),

    pt: ({ username, link, horas }) => ({
        subject: 'Recuperar a tua password do ViceHub',
        text: [
            `Olá ${username},`,
            '',
            'Alguém pediu para definir uma password nova nesta conta.',
            'Se foste tu, segue este link:',
            '',
            link,
            '',
            `O link serve uma vez e expira dentro de ${horas} hora(s).`,
            '',
            'Se não foste tu, não precisas de fazer nada: a password',
            'atual continua a valer e este link expira sozinho.',
        ].join('\n'),
    }),

    es: ({ username, link, horas }) => ({
        subject: 'Restablecer tu contraseña de ViceHub',
        text: [
            `Hola ${username}:`,
            '',
            'Alguien pidió establecer una contraseña nueva en esta cuenta.',
            'Si fuiste tú, sigue este enlace:',
            '',
            link,
            '',
            `El enlace sirve una vez y caduca dentro de ${horas} hora(s).`,
            '',
            'Si no fuiste tú, no tienes que hacer nada: tu contraseña',
            'actual sigue siendo válida y este enlace caduca solo.',
        ].join('\n'),
    }),

    fr: ({ username, link, horas }) => ({
        subject: 'Réinitialiser ton mot de passe ViceHub',
        text: [
            `Bonjour ${username},`,
            '',
            'Quelqu’un a demandé un nouveau mot de passe pour ce compte.',
            'Si c’était toi, suis ce lien :',
            '',
            link,
            '',
            `Le lien ne sert qu’une fois et expire dans ${horas} heure(s).`,
            '',
            'Si ce n’était pas toi, tu n’as rien à faire : ton mot de passe',
            'actuel reste valable et ce lien expire tout seul.',
        ].join('\n'),
    }),
};

/** Confirmar o endereço de email. */
const CONFIRMACAO: Record<Idioma, (dados: Confirmacao) => Email> = {
    en: ({ username, link }) => ({
        subject: 'Confirm your email on ViceHub',
        text: [
            `Hello ${username},`,
            '',
            'Confirm that this address is really yours:',
            '',
            link,
            '',
            'If you did not create a ViceHub account, ignore this email.',
        ].join('\n'),
    }),

    pt: ({ username, link }) => ({
        subject: 'Confirma o teu email no ViceHub',
        text: [
            `Olá ${username},`,
            '',
            'Confirma que este endereço é mesmo teu:',
            '',
            link,
            '',
            'Se não criaste conta no ViceHub, ignora este email.',
        ].join('\n'),
    }),

    es: ({ username, link }) => ({
        subject: 'Confirma tu correo en ViceHub',
        text: [
            `Hola ${username}:`,
            '',
            'Confirma que esta dirección es tuya:',
            '',
            link,
            '',
            'Si no creaste una cuenta en ViceHub, ignora este correo.',
        ].join('\n'),
    }),

    fr: ({ username, link }) => ({
        subject: 'Confirme ton adresse e-mail sur ViceHub',
        text: [
            `Bonjour ${username},`,
            '',
            'Confirme que cette adresse est bien la tienne :',
            '',
            link,
            '',
            'Si tu n’as pas créé de compte ViceHub, ignore cet e-mail.',
        ].join('\n'),
    }),
};

export const emailDeRecuperacao = (idioma: Idioma, dados: Recuperacao): Email =>
    RECUPERACAO[idioma](dados);

export const emailDeConfirmacao = (idioma: Idioma, dados: Confirmacao): Email =>
    CONFIRMACAO[idioma](dados);
