-- Subscrição vitalícia, para quem apoiou a plataforma no princípio.
--
-- É concedida um a um por quem administra, nunca automaticamente por
-- ordem de chegada: quem merece o gesto é uma decisão de pessoas.
ALTER TYPE "SubscriptionPlan" ADD VALUE 'lifetime';

-- O fim do período passa a poder ser ausente, e ausente quer dizer que
-- não termina.
--
-- A ausência é a forma honesta de o dizer. Uma data muito distante, como
-- o ano 9999, parece resolver e depois morde: aparece em ecrãs, entra em
-- contas de dias restantes e ordena mal.
ALTER TABLE "Subscription" ALTER COLUMN "current_period_end" DROP NOT NULL;

-- O período continua a ter de estar na ordem certa quando existe.
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_period_order_check";

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_period_order_check"
CHECK (
    "current_period_end" IS NULL
    OR "current_period_end" > "current_period_start"
);

-- A forma do período e o plano têm de concordar.
--
-- Sem isto havia duas maneiras de errar em silêncio, e ambas custam
-- dinheiro: um `premium` sem fim seria acesso gratuito para sempre sem
-- que nada o dissesse, e um `lifetime` com fim expirava um dia a quem
-- lhe foi prometido que não expirava.
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_lifetime_has_no_end_check"
CHECK (
    ("plan" = 'lifetime' AND "current_period_end" IS NULL)
    OR ("plan" <> 'lifetime' AND "current_period_end" IS NOT NULL)
);
