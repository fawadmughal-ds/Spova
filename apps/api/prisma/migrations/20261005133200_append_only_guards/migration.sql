-- Append-only enforcement for money + audit trails (ARCHITECTURE §09).
-- Triggers reject UPDATE/DELETE regardless of which DB role connects.

CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (% not allowed)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_entries_append_only ON ledger_entries;
CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

DROP TRIGGER IF EXISTS admin_audit_append_only ON admin_audit;
CREATE TRIGGER admin_audit_append_only
  BEFORE UPDATE OR DELETE ON admin_audit
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Balance can only be negative via explicit superadmin force; keep a sanity floor on credit.
ALTER TABLE trading_accounts
  ADD CONSTRAINT trading_accounts_credit_nonneg CHECK (credit >= 0);
