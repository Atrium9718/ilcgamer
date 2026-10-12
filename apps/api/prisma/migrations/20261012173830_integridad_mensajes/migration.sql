-- Usa SQLSTATE raise_exception (P0001) en los triggers de integridad para que el mensaje original
-- llegue a la aplicación y a los logs. Con restrict_violation, el ORM lo reportaba como violación
-- de llave foránea, lo que confundía el diagnóstico.
CREATE OR REPLACE FUNCTION ledger_entries_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries es inmutable: registre un movimiento compensatorio (%).', TG_OP
    USING ERRCODE = 'raise_exception', HINT = 'Integridad ILC';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION consent_records_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consent_records es append-only: registre un nuevo consentimiento.'
    USING ERRCODE = 'raise_exception', HINT = 'Integridad ILC';
END;
$$ LANGUAGE plpgsql;
