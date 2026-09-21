CREATE FUNCTION preservar_compensacao_decidida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status <> 'PENDENTE' THEN
   RAISE EXCEPTION 'Compensação decidida deve permanecer preservada';
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER compensacao_decidida_preservada BEFORE UPDATE OR DELETE ON "CompensacaoCoberturaMatricula"
 FOR EACH ROW EXECUTE FUNCTION preservar_compensacao_decidida();

CREATE FUNCTION preservar_dia_compensacao_destinado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
   RAISE EXCEPTION 'Dia de compensação deve permanecer no histórico';
 END IF;
 IF NEW."compensacaoId" <> OLD."compensacaoId" OR NEW."matriculaId" <> OLD."matriculaId" OR NEW."diaOrigem" <> OLD."diaOrigem" THEN
   RAISE EXCEPTION 'Origem do dia de compensação não pode ser substituída';
 END IF;
 IF OLD.estado <> 'PENDENTE' AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'Dia já destinado não pode ser reutilizado';
 END IF;
 IF NEW.estado <> OLD.estado AND NEW.versao <> OLD.versao + 1 THEN
   RAISE EXCEPTION 'Destinação exige incremento da versão';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dia_compensacao_destinacao_preservada BEFORE UPDATE OR DELETE ON "DiaCompensacaoCobertura"
 FOR EACH ROW EXECUTE FUNCTION preservar_dia_compensacao_destinado();
