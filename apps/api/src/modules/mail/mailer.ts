import nodemailer from 'nodemailer';
import type { FastifyBaseLogger } from 'fastify';

import { env } from '../../config/env.js';

export interface MailMessage {
    to: string;
    subject: string;
    text: string;
}

/**
 * O que a plataforma precisa para mandar um email, e mais nada.
 *
 * Existe para que os serviços não conheçam o nodemailer: falam desta
 * interface, e os testes trocam-na por um duplo sem servidor de correio
 * nenhum.
 */
export interface Mailer {
    send(message: MailMessage): Promise<void>;
}

/**
 * Escreve o email no log em vez de o enviar.
 *
 * É o que corre sem SMTP configurado — em desenvolvimento, nos testes, e
 * numa instalação que ainda não escolheu fornecedor. O corpo é escrito
 * por inteiro **de propósito**: sem servidor de correio, o log é a única
 * forma de alguém chegar ao link e seguir o fluxo até ao fim.
 *
 * É também a razão por que isto nunca deve correr em produção com
 * utilizadores a sério: um link de recuperação no log é um link de
 * recuperação ao alcance de quem lê logs. O arranque avisa quando é esse
 * o caso.
 */
export class ConsoleMailer implements Mailer {
    constructor(private readonly logger: FastifyBaseLogger) { }

    async send(message: MailMessage): Promise<void> {
        this.logger.info(
            { to: message.to, subject: message.subject, body: message.text },
            '[ViceHub Mail] Sem SMTP configurado: o email não foi enviado, fica aqui.',
        );
    }
}

/**
 * Envia por SMTP.
 *
 * Uma falha no envio **não** é engolida: quem pediu a recuperação tem de
 * saber que o email não vai chegar, em vez de ficar à espera de uma coisa
 * que nunca sai.
 */
export class SmtpMailer implements Mailer {
    private readonly transport: nodemailer.Transporter;

    constructor(
        smtpUrl: string,
        private readonly from: string,
    ) {
        this.transport = nodemailer.createTransport(smtpUrl);
    }

    async send(message: MailMessage): Promise<void> {
        await this.transport.sendMail({
            from: this.from,
            to: message.to,
            subject: message.subject,
            text: message.text,
        });
    }
}

/**
 * Escolhe por onde sai o correio.
 *
 * Sem SMTP a plataforma arranca na mesma e todo o resto funciona; o que
 * muda é que os emails ficam no log em vez de saírem.
 */
export const createMailer = (logger: FastifyBaseLogger): Mailer => {
    if (!env.SMTP_URL) {
        logger.warn(
            '[ViceHub Mail] SMTP_URL não definida. Os emails de recuperação e de confirmação ficam no log e não são enviados.',
        );

        return new ConsoleMailer(logger);
    }

    return new SmtpMailer(env.SMTP_URL, env.MAIL_FROM);
};
