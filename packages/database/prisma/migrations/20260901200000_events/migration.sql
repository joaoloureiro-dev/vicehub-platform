-- Eventos de crew e de servidor.
--
-- Existem para responder a uma pergunta que a tesouraria não sabia
-- responder sozinha: quem participou nisto? Sem eventos, dividir ganhos
-- só podia ser por igual ou por cargo, e quem apareceu a um assalto
-- recebia o mesmo que quem não apareceu.

CREATE TYPE "EventStatus" AS ENUM ('scheduled', 'ongoing', 'completed', 'canceled');

CREATE TYPE "EventParticipantStatus" AS ENUM (
    'signed_up',
    'confirmed',
    'no_show',
    'withdrawn'
);

CREATE TABLE "Event" (
    "id"           TEXT NOT NULL,
    "crewId"       TEXT,
    "serverId"     TEXT,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "status"       "EventStatus" NOT NULL DEFAULT 'scheduled',
    "starts_at"    TIMESTAMP(3) NOT NULL,
    "ends_at"      TIMESTAMP(3),
    "capacity"     INTEGER,
    "organizer_id" TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    "deleted_at"   TIMESTAMP(3),
    "is_deleted"   BOOLEAN NOT NULL DEFAULT false,
    "version"      INTEGER NOT NULL DEFAULT 1,
    "source"       "SourceType" NOT NULL DEFAULT 'api',
    "created_by"   TEXT,
    "updated_by"   TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- Um evento pertence a uma crew ou a um servidor, nunca aos dois nem a
-- nenhum. É a mesma regra da carteira, e o Prisma não a sabe exprimir.
ALTER TABLE "Event" ADD CONSTRAINT "Event_single_owner_check"
    CHECK (num_nonnulls("crewId", "serverId") = 1);

-- Um evento que acabasse antes de começar não é um evento com datas
-- estranhas: é um erro que tornaria a duração negativa em qualquer
-- cálculo que a use.
ALTER TABLE "Event" ADD CONSTRAINT "Event_ends_after_start_check"
    CHECK ("ends_at" IS NULL OR "ends_at" >= "starts_at");

-- Capacidade zero não é "sem limite" — sem limite é a ausência de valor.
-- Zero seria um evento em que ninguém pode entrar.
ALTER TABLE "Event" ADD CONSTRAINT "Event_capacity_positive_check"
    CHECK ("capacity" IS NULL OR "capacity" > 0);

CREATE INDEX "Event_crewId_status_idx"   ON "Event" ("crewId", "status");
CREATE INDEX "Event_serverId_status_idx" ON "Event" ("serverId", "status");
CREATE INDEX "Event_starts_at_idx"       ON "Event" ("starts_at");
CREATE INDEX "Event_is_deleted_idx"      ON "Event" ("is_deleted");

ALTER TABLE "Event" ADD CONSTRAINT "Event_crewId_fkey"
    FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Event" ADD CONSTRAINT "Event_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventParticipant" (
    "id"           TEXT NOT NULL,
    "eventId"      TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "status"       "EventParticipantStatus" NOT NULL DEFAULT 'signed_up',
    "weight"       INTEGER NOT NULL DEFAULT 1,
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    "deleted_at"   TIMESTAMP(3),
    "is_deleted"   BOOLEAN NOT NULL DEFAULT false,
    "version"      INTEGER NOT NULL DEFAULT 1,
    "source"       "SourceType" NOT NULL DEFAULT 'api',
    "created_by"   TEXT,
    "updated_by"   TEXT,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- Um peso negativo tiraria dinheiro a quem participou, e um peso zero
-- deixaria alguém confirmado fora da divisão sem que isso se veja em
-- lado nenhum: quem não deve receber marca-se como no_show.
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_weight_positive_check"
    CHECK ("weight" > 0);

-- Uma presença confirmada tem sempre quem a confirmou e quando: sem
-- isso, não haveria como auditar quem deu a alguém direito a receber.
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_confirmation_complete_check"
    CHECK (
        "status" <> 'confirmed'
        OR ("confirmed_by" IS NOT NULL AND "confirmed_at" IS NOT NULL)
    );

CREATE UNIQUE INDEX "EventParticipant_eventId_userId_key"
    ON "EventParticipant" ("eventId", "userId");

CREATE INDEX "EventParticipant_eventId_status_idx"
    ON "EventParticipant" ("eventId", "status");

CREATE INDEX "EventParticipant_userId_idx" ON "EventParticipant" ("userId");

ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
