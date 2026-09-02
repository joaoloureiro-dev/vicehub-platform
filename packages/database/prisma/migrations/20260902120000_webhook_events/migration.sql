-- Eventos de webhook já processados.
--
-- O Stripe reenvia eventos quando não recebe resposta a tempo, e o mesmo
-- evento pode chegar várias vezes. Sem esta tabela, um reenvio de
-- `checkout.session.completed` criaria um segundo período de plano: o
-- cliente pagou uma vez e ficava com dois meses.
--
-- O identificador é o do próprio evento no Stripe e é a chave primária.
-- A segunda tentativa de o gravar falha por chave duplicada, e é essa
-- falha que diz que já foi tratado — em vez de uma leitura antes da
-- escrita, que duas entregas em paralelo passariam ambas.
CREATE TABLE "WebhookEvent" (
    "id"           TEXT NOT NULL,
    "provider"     "SubscriptionProvider" NOT NULL DEFAULT 'stripe',
    "type"         TEXT NOT NULL,
    "received_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "payload"      JSONB,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookEvent_provider_type_idx" ON "WebhookEvent" ("provider", "type");
CREATE INDEX "WebhookEvent_received_at_idx" ON "WebhookEvent" ("received_at" DESC);
