import type { LegalDocument } from './legal-document.js';
import { orPlaceholder, type LegalOperator } from './operator.js';

/**
 * Os termos de utilização.
 *
 * Duas cláusulas aqui não são formalidade nenhuma e são a razão de este
 * documento ter de existir antes de se vender o que quer que seja.
 *
 * A primeira é a da tesouraria. O `TreasuryService` diz, em comentário,
 * que move moeda de jogo e não dinheiro real — e não há levantamento,
 * IBAN nem Stripe Connect em lado nenhum do código que o desminta. Se
 * essa distinção não estiver escrita onde o utilizador a lê, uma
 * tesouraria com saldos, movimentos e aprovações pode ser lida como
 * guarda de fundos alheios, que é uma actividade regulada.
 *
 * A segunda é a da marca. A apresentação nomeia o GTA VI nos quatro
 * idiomas, e nomear um jogo sem dizer que não se tem nada a ver com
 * quem o faz é o que transforma uma plataforma de fãs num problema.
 *
 * A terceira é a da moderação. Uma plataforma onde o público escreve
 * tem de dizer, nos termos que vinculam quem escreve, como é que o que
 * lá está é vigiado: o que se pode denunciar, quem decide, o que pode
 * acontecer ao texto, e o que fazer quem discordar. Está escrito a
 * partir do que o fórum faz, e não do que seria bonito dizer.
 *
 * Em inglês e só em inglês, pela razão que está na política de
 * privacidade.
 */
export const termsDocument = (operator: LegalOperator): LegalDocument => {
    const email = orPlaceholder(operator.email, 'contact email');
    const jurisdiction = orPlaceholder(operator.jurisdiction, 'jurisdiction');

    return {
        title: 'Terms of Service',

        /**
         * A actualizar sempre que o texto mudar. Ver `LegalDocument`.
         */
        updatedAt: '2026-09-23',

        intro: [
            `ViceHub is operated by ${orPlaceholder(operator.legalName, 'legal name')}, ${orPlaceholder(operator.address, 'registered address')} (${orPlaceholder(operator.registration, 'company or tax number')}). These terms are the agreement between you and us when you use it.`,
            'Using ViceHub means you accept them. If you do not, the honest thing is not to create an account — and if you already have one, you can delete it from your profile at any time.',
        ],

        sections: [
            {
                heading: 'What ViceHub is',
                body: [
                    'ViceHub is tooling for gaming communities: a place to run a crew or a server, keep track of who turned up, and divide what a community earns in a game.',
                    'ViceHub is an independent platform. It is not affiliated with, endorsed by, sponsored by, or connected to Rockstar Games, Take-Two Interactive, or any game publisher. Game names and trademarks belong to their owners and are used only to say which game a community plays.',
                ],
            },

            {
                heading: 'Your account',
                body: [
                    'You need an account to take part, and one account is one person.',
                ],
                list: [
                    'You must be at least 16 years old.',
                    'The email address you give must be one you can actually receive mail at, because it is how you recover the account.',
                    'Keep your password to yourself. Anything done through your account is treated as done by you, so tell us at once if you think someone else has got into it.',
                    'Do not share, sell, or hand over an account. If you want to leave a community to someone else, transfer the role rather than the account.',
                ],
            },

            {
                heading: 'Communities run themselves',
                body: [
                    'ViceHub gives a community the tools. It does not run it. Crew leaders and server owners decide who joins, what the roles are, how a reward is split, and what their own rules are.',
                    'That means disputes inside a community are for that community to settle. ViceHub keeps an audit trail so that there is a record of who approved what, and that record is available to the people with the right to see it — but we are not the referee of an argument about it.',
                    'We step in only where these terms are broken, or where the law requires us to.',
                ],
            },

            {
                heading: 'The treasury is not a payment service',
                body: [
                    'This is the most important clause here, so it is written plainly.',
                    'A ViceHub treasury records in-game currency. It is a ledger a community keeps about itself. ViceHub does not hold, transmit, store, exchange, or pay out real money on anyone’s behalf, and a treasury balance is not money, not e-money, not a claim on us, and not redeemable for anything.',
                    'There is no way to withdraw from a treasury to a bank account, a card, or any other real-world destination, because no such route exists in the product.',
                    'The one place real money changes hands is a paid plan, and it goes one way: from you, through Stripe, to us.',
                ],
            },

            {
                heading: 'How you may use it',
                body: [
                    'The short version: do not use ViceHub to harm people or to break it.',
                ],
                list: [
                    'No harassment, threats, hate speech, or targeting of anyone.',
                    'No content that is illegal where you are, or that sexualises minors in any form.',
                    'No impersonating another person, community, or ViceHub itself.',
                    'No scraping, no automated bulk access, and no attempt to break, overload, or get around the limits of the service.',
                    'No using the treasury or any other feature to launder, disguise, or move real money.',
                    'No selling accounts, roles, or treasury balances for real money.',
                ],
            },

            {
                heading: 'Paid plans',
                body: [
                    'Some features need a paid plan. The price and what each plan includes are shown on the pricing page before you pay, and that page is the authoritative version.',
                ],
                list: [
                    'Payments are handled by Stripe. We never see your card.',
                    'A plan renews automatically for the same period until you cancel it. Cancelling stops the next renewal; it does not refund the period you are in.',
                    'When a plan ends, what it unlocked stops being available. Nothing is deleted for it — a crew over the free limit becomes read-only rather than destroyed.',
                    'Prices shown include VAT where it applies. If a price changes, the change applies from your next renewal and never mid-period.',
                    'A plan is bought by a person for a crew or a server. It belongs to the account that bought it.',
                ],
            },

            {
                heading: 'Refunds and your right to cancel',
                body: [
                    'If you are a consumer in the EU you have 14 days to withdraw from a purchase of digital services, without giving a reason and without a penalty.',
                    'A plan takes effect immediately, which means that by the time you change your mind some of it has already been delivered. Where that is the case you pay for the part you used, in proportion to the period, and we refund the rest.',
                    '**We do not ask you to give up that right.** The law lets us make the right disappear by having you consent to immediate performance and acknowledge losing it at checkout. We do not ask for that acknowledgement, so the right stays.',
                    `To withdraw, write to ${email} within 14 days of the purchase and say so. No form and no reason are needed. We refund to the same card, through Stripe, within 14 days of being told.`,
                    'Outside that window, refunds are not automatic, but ask. If a paid feature did not work, we do not keep the money for it.',
                ],
            },

            {
                heading: 'Lifetime plans',
                body: [
                    'A lifetime plan is a gift, not a product. It is granted individually, at our discretion, to people who backed the platform early. It is not for sale, it cannot be bought, transferred, or exchanged, and having one confers no right to any particular feature continuing to exist.',
                ],
            },

            {
                heading: 'What you put on ViceHub',
                body: [
                    'What you write and upload stays yours. You give us only the permission we need to run the service: to store it, show it to the people you meant to show it to, and make the copies that hosting a website requires.',
                    'You are responsible for what you post, including having the right to post it. We can remove content that breaks these terms or the law.',
                ],
            },

            {
                heading: 'Reporting, and how we moderate',
                body: [
                    'The forum is the one place where anyone with an account writes text that everyone can read, so this section says exactly how that is policed.',
                    'Every question and every reply carries a Report button for anyone signed in who did not write it. You pick one of four reasons — spam or advertising, insults or harassment or hate, nothing to do with the question, or something else — and you can add a short note. Reports go into a queue that moderators work through oldest first.',
                    'A person decides, not a program. Nothing is removed automatically, and no ranking or filter hides a post before a moderator has read it.',
                ],
                list: [
                    'A moderator can remove a question or a reply, and can close a question to new replies. Closing is the milder tool: what is already written stays readable, and only the conversation stops.',
                    'Removing hides the text from the forum. It does not erase the record that something was there, because a moderator has to be able to explain a decision afterwards.',
                    'The account that wrote it keeps its account. Suspension is a separate, heavier step, and it is covered in the section on ending an account.',
                    `If your post was removed or your question closed and you think it was wrong, write to ${email}. Say what was removed and why you disagree; a different person will look at it, and if we got it wrong we put it back.`,
                    'We do not tell you who reported you. Telling would turn reporting into a reason for retaliation, and the person who reported is not the person who decided.',
                ],
            },

            {
                heading: 'Ending it',
                body: [
                    'You can delete your account from your profile whenever you want. It refuses only while something would be stranded by your leaving — funds in your wallet, a community you alone can run, or a plan still billing — and each of those is something you can clear first.',
                    'We can suspend or close an account that breaks these terms. Where it is proportionate we will say what the problem is and give you a chance to fix it first; where the breach is serious — anything illegal, or aimed at harming another person — we may act immediately.',
                    'If we close your account without cause, we refund the unused part of any plan you had paid for.',
                ],
            },

            {
                heading: 'What we do not promise',
                body: [
                    'ViceHub is offered as it is. We work to keep it available and correct, but we do not promise it will be uninterrupted, error-free, or that any particular feature will exist forever. Features change, and some are removed.',
                    'We are liable for what the law does not let us exclude, including death or personal injury caused by our negligence, and fraud. Beyond that, and to the extent the law allows, our liability to you for any claim is limited to what you paid us in the twelve months before it arose.',
                    'Nothing here takes away rights you have as a consumer that cannot be taken away by agreement.',
                ],
            },

            {
                heading: 'Changes to these terms',
                body: [
                    'When these terms change, the date at the top changes with them. Material changes are announced in the product before they take effect, and continuing to use ViceHub afterwards is how you accept them. If you do not accept them, delete your account — and if a change materially disadvantages you mid-plan, we refund the unused part.',
                ],
            },

            {
                heading: 'Complaints, and the law',
                body: [
                    `Start with us: write to ${email}. Most things are a misunderstanding that one reply settles, and we answer.`,
                    `If that does not settle it and you are a consumer, you can take the dispute to an alternative dispute resolution body without going to court: ${orPlaceholder(operator.consumerDisputes, 'consumer dispute resolution body')}.`,
                    `These terms are governed by the law of ${jurisdiction}, and its courts have jurisdiction. If you are a consumer, this does not deprive you of the protection of the mandatory law of the country you live in, nor of your right to bring a claim in the courts where you live.`,
                ],
            },
        ],
    };
};
