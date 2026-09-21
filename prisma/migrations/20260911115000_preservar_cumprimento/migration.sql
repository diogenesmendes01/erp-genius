CREATE FUNCTION preservar_conferencia_cumprimento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
   RAISE EXCEPTION 'Conferência de cumprimento deve permanecer no histórico';
 END IF;
 IF OLD.status <> 'PENDENTE' THEN
   RAISE EXCEPTION 'Decisão de cumprimento deve permanecer preservada';
 END IF;
 IF (to_jsonb(NEW) - ARRAY['status','decisorId','motivoDecisao','decididaEm']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['status','decisorId','motivoDecisao','decididaEm']) THEN
   RAISE EXCEPTION 'Evidência e origem da conferência não podem ser substituídas';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferencia_cumprimento_preservada BEFORE UPDATE OR DELETE ON "ConferenciaCumprimentoRecomposicao"
 FOR EACH ROW EXECUTE FUNCTION preservar_conferencia_cumprimento();
