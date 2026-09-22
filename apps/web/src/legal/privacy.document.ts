import type { LegalDocument } from './legal-document.js';
import { orPlaceholder, type LegalOperator } from './operator.js';

/**
 * A política de privacidade.
 *
 * Escrita a partir do que o código faz, e não de um modelo. Cada linha
 * daqui tem uma tabela, um cookie ou uma função que a sustenta — o
 * inventário saiu do `account-export.ts` e do `schema.prisma`, os
 * cookies dos dois sítios que os escrevem, e a lista de terceiros do
 * `env.ts`.
 *
 * Isso é o contrário de uma formalidade: uma política genérica descreve
 * um produto que não é este, e a diferença entre os dois é exactamente
 * o que a política existe para dizer.
 *
 * Está em inglês e só em inglês. Um documento legal é um instrumento
 * único; quatro cópias nos dicionários seriam quatro documentos a
 * divergir, e o que divergisse era o que ninguém voltasse a ler. Uma
 * cláusula mal traduzida é pior do que uma cláusula por traduzir,
 * porque vincula na mesma.
 */
export const privacyDocument = (operator: LegalOperator): LegalDocument => {
    const email = orPlaceholder(operator.email, 'contact email');

    return {
        title: 'Privacy Policy',

        /**
         * A actualizar sempre que o texto mudar. Ver `LegalDocument`.
         */
        updatedAt: '2026-09-22',

        intro: [
            `ViceHub is operated by ${orPlaceholder(operator.legalName, 'legal name')}, ${orPlaceholder(operator.address, 'registered address')} (${orPlaceholder(operator.registration, 'company or tax number')}). For anything in this policy, write to ${email}.`,
            'This policy describes what ViceHub stores about you, why it stores it, who else can see it, and what you can do about it. It describes the product as it works today — not what it might do later.',
        ],

        sections: [
            {
                heading: 'What we store',
                body: [
                    'ViceHub stores what it needs to run your account and the communities on it. Most of it is there because you typed it; the rest is recorded by a feature while it does its job.',
                ],
                list: [
                    'Your account: an email address, a username, and a password hash. The password itself is never stored. Argon2 turns it into something that can check a password but cannot produce one.',
                    'Your profile: a short bio, an accent colour, and the web addresses of an avatar and a banner. ViceHub does not host images — it stores the address you give it.',
                    'What you build up in the product: level, experience, reputation, and achievements.',
                    'Your communities: the crews and servers you belong to, the roles you hold in each, and the requests you have sent or received.',
                    'Events: which ones you joined, whether you turned up, and the weight your presence carried when a reward was split.',
                    'In-game money: your wallet balance, what went in and out of it, and the treasury movements you proposed or decided. This is game currency, not real money — the Terms say so in full.',
                    'Subscriptions: which plan, its status, what it costs, and when it began and ends. Card details never reach ViceHub. Stripe handles them and sends back only the outcome.',
                    'Friendships: who you are connected to, and the state of each request.',
                    'What you write in the forum: your questions, your replies, and — if you report a post — which of the four reasons you picked, anything you added in your own words, and that it was you who reported it. A moderator sees the report; nobody else does.',
                    'A linked Discord or Google account, if you choose to link one: the identifier that provider gives us and the email address on it. No token from either provider is kept once the sign-in is done, and ViceHub has no access to anything else on those accounts.',
                    'Sessions: when you signed in, and the IP address and browser the request came from, so that a session can be recognised and revoked. Failed sign-in attempts are counted so that an account locks after repeated failures.',
                    'An audit trail of actions that change a community — money decided, roles granted, members removed — with who did it, when, and from which address. A community that cannot show who approved a payout has no way to settle an argument about it.',
                ],
            },

            {
                heading: 'What we do not store',
                body: [
                    'This section is short, and that is the point of it.',
                ],
                list: [
                    'No analytics. No advertising tag, no session recorder, no heat map. The only third-party script that ever runs is the anti-robot check on the sign-in and sign-up forms, and only if this installation has one configured — nothing else on ViceHub loads anything from anywhere else.',
                    'No advertising, and no profile built to serve any.',
                    'No tracking of you on other sites. ViceHub has nothing on any site but its own.',
                    'Your data is never sold, rented, or passed to a data broker. There is no arrangement under which that could happen.',
                    'No date of birth, no phone number, no postal address, no identity document. ViceHub never asks, so it never has them.',
                ],
            },

            {
                heading: 'Cookies',
                body: [
                    'ViceHub sets two cookies. Both are strictly necessary: without them the thing they belong to cannot work at all.',
                    'That is why there is no cookie banner. A banner asks permission for cookies you could refuse, and ViceHub sets none of those. Asking about a cookie that cannot be refused would be theatre.',
                ],
                list: [
                    'vicehub_refresh_token — keeps you signed in between visits. It is HttpOnly, so no script can read it, and it is cleared when you sign out.',
                    'vicehub_discord_state and vicehub_google_state — set for the few seconds a sign-in with that provider takes, and deleted the moment you come back. They exist so a sign-in that returns can be matched to the one that left. Neither grants access to anything on its own.',
                ],
            },

            {
                heading: 'Who else processes it',
                body: [
                    'Running ViceHub means a few companies handle some of this on our behalf. Each is here because a feature needs it, and each receives only what that feature requires.',
                ],
                list: [
                    'Stripe — payments. It receives what a payment needs. ViceHub never sees your card.',
                    'Cloudflare — the anti-robot check on the sign-in and sign-up forms, where one is configured. It runs on those two pages and nowhere else, and sees what any site sees of a visit: your address and what your browser reports. Turnstile was chosen because it sets no tracking cookie and feeds no advertising profile.',
                    'Discord — only if you link it, and only to exchange the account identifier and email at sign-in.',
                    'Google — the same, if you link it.',
                    'Our email provider — to deliver confirmation and password-recovery messages. It receives your address and the message.',
                    `Our hosting provider — it runs the servers the database sits on, in ${orPlaceholder(operator.hostingRegion, 'hosting region')}.`,
                ],
            },

            {
                heading: 'Why we are allowed to',
                body: [
                    'If you are in the EU or the UK, these are the legal bases we rely on.',
                ],
                list: [
                    'To perform our contract with you: running your account, your communities, and any plan you pay for.',
                    'To meet a legal obligation: keeping accounting records of payments.',
                    'Our legitimate interests: keeping accounts secure against people trying to break into them, and keeping an audit trail that communities can rely on to resolve their own disputes.',
                    'Your consent: linking a Discord or Google account. You give it by linking and withdraw it by unlinking.',
                ],
            },

            {
                heading: 'How long we keep it',
                body: [
                    'While your account exists, what is attached to it exists with it. When you delete your account, the following is what actually happens — and some of it is deliberate rather than incidental.',
                ],
                list: [
                    'Your password and any linked sign-in methods are erased outright, not flagged as deleted.',
                    'Your email address and username are released, so that you or anyone else can use them again. They are replaced on the deleted account rather than left occupied by an account that no longer exists.',
                    "A crew's treasury history stays with the crew. It is the crew's record, the people still in it depend on it, and one member leaving cannot be allowed to erase what a community agreed. Your name is detached from it.",
                    'Records we are required to keep for accounting and tax — that a payment happened, for how much, and when — are kept for as long as the law requires, and then deleted.',
                ],
            },

            {
                heading: 'What you can do about it',
                body: [
                    'Two of these are not requests you send and then wait on. They are buttons, and they work immediately.',
                ],
                list: [
                    'Take it with you. Your profile exports everything ViceHub holds about you as a single file. It leaves out other people’s data, and it leaves out anything that is a key rather than a fact — no password hash, no session tokens — because putting those in a file that lands in your Downloads would turn the right to take your data into a way to lose it.',
                    'Delete it. Your profile deletes the account. It refuses while something would be stranded by your leaving: money still in your wallet, a community where you are the only person who can run it, or a paid plan still billing a card. Each of those is something you could no longer reach once the account is gone.',
                    `Correct it. Profile fields are editable where you see them. For anything else, write to ${email}.`,
                    `Object, restrict, or complain. Write to ${email}. If you are in the EU you may also complain to your national data protection authority; in Portugal that is the CNPD.`,
                ],
            },

            {
                heading: 'Age',
                body: [
                    'ViceHub is not for children. You must be at least 16 years old to hold an account.',
                    'ViceHub does not ask for a date of birth and cannot verify anyone’s age. If we learn that an account belongs to someone below that age, we delete it.',
                ],
            },

            {
                heading: 'Changes to this policy',
                body: [
                    'When this policy changes, the date at the top changes with it. Anything that materially affects what we store or who sees it is announced in the product before it takes effect, not after.',
                ],
            },

            {
                heading: 'Contact',
                body: [
                    `Questions about this policy, or about your data, go to ${email}.`,
                ],
            },
        ],
    };
};
