-- Reconcilia a função instalada historicamente com o corpo canônico versionado
-- sem modificar a migração 20260915138000 nem seus checksums já aplicados.
CREATE OR REPLACE FUNCTION preservar_cobranca_cancelada_apos_desistencia() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
