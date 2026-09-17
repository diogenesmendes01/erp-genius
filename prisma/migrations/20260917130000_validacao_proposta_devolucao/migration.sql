BEGIN;

CREATE OR REPLACE FUNCTION conferir_proposta_devolucao_credito_207() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"; saldo numeric; credito "CreditoMatricula";
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta de devolução é imutável'; END IF;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
 SELECT * INTO credito FROM "CreditoMatricula" WHERE id=NEW."creditoId" FOR UPDATE;
 SELECT saldo_credito_disponivel_207(NEW."creditoId") INTO saldo;
 IF u.id IS NULL OR credito.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) OR NEW.versao<>coalesce((SELECT max(versao)+1 FROM "PropostaDevolucaoCredito" WHERE "creditoId"=NEW."creditoId"),1) OR NEW.valor>saldo OR NEW.snapshot->>'creditoId' IS DISTINCT FROM NEW."creditoId" OR NEW.snapshot->>'matriculaId' IS DISTINCT FROM credito."matriculaId" OR NEW.snapshot->>'moeda' IS DISTINCT FROM credito.moeda OR (NEW.snapshot->>'saldoDisponivel')::numeric IS DISTINCT FROM saldo OR (NEW.snapshot->>'valor')::numeric IS DISTINCT FROM NEW.valor OR NEW.snapshot->>'destino' IS DISTINCT FROM NEW.destino THEN RAISE EXCEPTION 'Proposta de devolução incompatível com autor, origem, versão ou saldo'; END IF;
 RETURN NEW;
END $$;

COMMIT;
