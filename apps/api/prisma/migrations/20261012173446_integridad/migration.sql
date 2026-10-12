-- Reglas de integridad que Prisma no expresa (Guía Técnica §5.5-§5.8, §6.1).

-- ── Ledger inmutable (§5.7 regla 3): un movimiento confirmado nunca se edita ni se borra.
--    Las correcciones son movimientos compensatorios (REVERSO / AJUSTE).
CREATE OR REPLACE FUNCTION ledger_entries_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries es inmutable: registre un movimiento compensatorio (%).', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_inmutable();
CREATE TRIGGER ledger_entries_no_delete BEFORE DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_inmutable();

-- Signo coherente con el tipo de movimiento; nunca cantidad cero.
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_amount_sign" CHECK (
  amount <> 0 AND (
    ("type" = 'CREDITO' AND amount > 0) OR
    ("type" = 'DEBITO'  AND amount < 0) OR
    ("type" IN ('REVERSO', 'AJUSTE'))
  )
);
-- Reversos y ajustes deben referenciar el movimiento original y explicar el motivo (§12.2 Auditoría).
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_compensation_ref" CHECK (
  "type" NOT IN ('REVERSO', 'AJUSTE') OR ("originalEntryId" IS NOT NULL AND "reason" IS NOT NULL)
);

-- El saldo en caché nunca puede quedar negativo (canje sin saldo = error atómico).
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_balance_non_negative" CHECK (balance >= 0);
-- Una cuenta pertenece exactamente a un usuario o a un Parche.
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_single_owner" CHECK (
  ("ownerType" = 'USUARIO' AND "userId" IS NOT NULL AND "sessionId" IS NULL) OR
  ("ownerType" = 'SESION'  AND "sessionId" IS NOT NULL AND "userId" IS NULL)
);

-- ── Claims (§5.6, §6.1): un código de uso único admite como máximo UN claim confirmado,
--    incluso ante solicitudes concurrentes.
CREATE UNIQUE INDEX "claims_one_confirmed_per_code" ON "claims" ("campaignCodeId") WHERE confirmed;

-- ── Inventario de recompensas (§5.8): nunca stock negativo.
ALTER TABLE "reward_inventory" ADD CONSTRAINT "reward_inventory_available_non_negative" CHECK (available >= 0);
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_cost_non_negative" CHECK (cost >= 0);

-- ── El Parche (§5.5): el PIN solo es único entre sesiones vivas; al expirar se puede reutilizar.
CREATE UNIQUE INDEX "sessions_active_pin" ON "sessions" ("pinLookup")
  WHERE status IN ('CREADA', 'ABIERTA', 'EN_CURSO');
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_capacity_range" CHECK (capacity BETWEEN 1 AND 50);

-- ── Campañas (§5.3): ventana temporal válida y edad mínima legal.
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_window" CHECK ("endsAt" > "startsAt");
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_min_age" CHECK ("minAge" >= 18);

-- ── XP (§5.7): economía de experiencia, solo positiva.
ALTER TABLE "xp_entries" ADD CONSTRAINT "xp_entries_positive" CHECK (amount > 0);

-- ── Consentimientos append-only (§9.3): el historial no se reescribe.
CREATE OR REPLACE FUNCTION consent_records_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consent_records es append-only: registre un nuevo consentimiento.'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER consent_records_no_update BEFORE UPDATE ON "consent_records"
  FOR EACH ROW EXECUTE FUNCTION consent_records_append_only();
