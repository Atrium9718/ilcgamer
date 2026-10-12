-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "activations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "energyMinutes" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "localPlayers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;

-- ── El Parche (§5.5): energía acotada, marcador y activaciones no negativos.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_energy_minutes_range" CHECK ("energyMinutes" BETWEEN 5 AND 240);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_score_non_negative" CHECK (score >= 0 AND activations >= 0);
-- Una persona participa activamente (no "SALIO") en una sola sesión viva a la vez: se aplica en el servicio
-- con candado por persona; este índice acelera esa búsqueda.
CREATE INDEX "session_participants_user_active" ON "session_participants" ("userId") WHERE status <> 'SALIO';
