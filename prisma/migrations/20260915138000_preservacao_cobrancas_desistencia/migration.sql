-- Preserva também cobranças que já estavam CANCELADA quando uma desistência
-- financeira foi efetivada. Elas são histórico válido, mas não podem sofrer
-- baixa, alteração ou exclusão depois da aplicação terminal da matrícula.
CREATE FUNCTION preservar_cobranca_cancelada_apos_desistencia() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status = 'CANCELADA' AND EXISTS(
   SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" e WHERE e."matriculaId" = OLD."matriculaId"
 ) THEN
  IF TG_OP = 'DELETE' OR to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
   RAISE EXCEPTION 'Cobrança cancelada preservada após efetivação da desistência';
  END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER "Cobranca_preservar_cancelada_apos_desistencia"
 BEFORE UPDATE OR DELETE ON "Cobranca"
 FOR EACH ROW EXECUTE FUNCTION preservar_cobranca_cancelada_apos_desistencia();

CREATE OR REPLACE FUNCTION impedir_baixa_cobranca_desistencia() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE aplicada TEXT; matricula TEXT;
BEGIN
 -- Mantém o único bloqueio de linha neste caminho na própria cobrança. A
 -- efetivação toma calendário, matrícula e cobranças nessa ordem; não tomar
 -- locks adicionais de matrícula aqui evita inversão quando uma baixa concorre.
 SELECT c."canceladaPorDesistenciaId", c."matriculaId" INTO aplicada, matricula
 FROM "Cobranca" c WHERE c.id = NEW."cobrancaId" FOR UPDATE;
 IF aplicada IS NOT NULL OR EXISTS(
   SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" e WHERE e."matriculaId" = matricula
 ) THEN
  RAISE EXCEPTION 'Matrícula efetivada por desistência não admite nova baixa ou informe';
 END IF;
 RETURN NEW;
END $$;
