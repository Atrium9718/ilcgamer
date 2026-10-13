-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('BORRADOR', 'PUBLICADO', 'CERRADO');

-- CreateEnum
CREATE TYPE "ContestKind" AS ENUM ('DISFRACES');

-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('BORRADOR', 'ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "status" "EventStatus" NOT NULL DEFAULT 'BORRADOR',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contests" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "kind" "ContestKind" NOT NULL DEFAULT 'DISFRACES',
    "title" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "prize" VARCHAR(160) NOT NULL,
    "prizeConditions" TEXT NOT NULL DEFAULT '',
    "status" "ContestStatus" NOT NULL DEFAULT 'BORRADOR',
    "uploadsCloseAt" TIMESTAMP(3) NOT NULL,
    "votingOpensAt" TIMESTAMP(3) NOT NULL,
    "votingClosesAt" TIMESTAMP(3) NOT NULL,
    "screenToken" VARCHAR(40) NOT NULL,
    "createdById" UUID,
    "openedById" UUID,
    "closedAt" TIMESTAMP(3),
    "winnerEntryId" UUID,
    "winnerCode" VARCHAR(12),
    "prizeDeliveredAt" TIMESTAMP(3),
    "prizeDeliveredById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_entries" (
    "id" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "caption" VARCHAR(200) NOT NULL DEFAULT '',
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDIENTE',
    "rejectionReason" TEXT,
    "consentDisplayAt" TIMESTAMP(3) NOT NULL,
    "moderatedById" UUID,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contest_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_photos" (
    "entryId" UUID NOT NULL,
    "data" BYTEA NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entry_photos_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "contest_votes" (
    "id" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contest_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "contests_screenToken_key" ON "contests"("screenToken");

-- CreateIndex
CREATE UNIQUE INDEX "contests_winnerEntryId_key" ON "contests"("winnerEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "contests_eventId_slug_key" ON "contests"("eventId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "contest_entries_contestId_userId_key" ON "contest_entries"("contestId", "userId");

-- CreateIndex
CREATE INDEX "contest_votes_entryId_idx" ON "contest_votes"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "contest_votes_contestId_userId_key" ON "contest_votes"("contestId", "userId");

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_winnerEntryId_fkey" FOREIGN KEY ("winnerEntryId") REFERENCES "contest_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_photos" ADD CONSTRAINT "entry_photos_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "contest_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_votes" ADD CONSTRAINT "contest_votes_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_votes" ADD CONSTRAINT "contest_votes_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "contest_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_votes" ADD CONSTRAINT "contest_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integridad que Prisma no expresa (la misma defensa en profundidad que el ledger y las recompensas).
ALTER TABLE "contests" ADD CONSTRAINT "contests_dates_check"
  CHECK ("uploadsCloseAt" <= "votingOpensAt" AND "votingOpensAt" < "votingClosesAt");
ALTER TABLE "events" ADD CONSTRAINT "events_dates_check" CHECK ("startsAt" < "endsAt");

-- Un voto solo es válido si la inscripción es del mismo concurso, está aprobada y no es de quien vota. Los votos no se editan.
CREATE FUNCTION contest_votes_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Los votos no se editan';
  END IF;
  SELECT "contestId", "userId", "status" INTO e FROM "contest_entries" WHERE "id" = NEW."entryId";
  IF e."contestId" IS DISTINCT FROM NEW."contestId" THEN
    RAISE EXCEPTION 'La inscripción no pertenece a este concurso';
  END IF;
  IF e."status" <> 'APROBADA' THEN
    RAISE EXCEPTION 'Solo se vota por inscripciones aprobadas';
  END IF;
  IF e."userId" = NEW."userId" THEN
    RAISE EXCEPTION 'No se puede votar por la propia inscripción';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER contest_votes_integrity_trg BEFORE INSERT OR UPDATE ON "contest_votes"
  FOR EACH ROW EXECUTE FUNCTION contest_votes_integrity();
