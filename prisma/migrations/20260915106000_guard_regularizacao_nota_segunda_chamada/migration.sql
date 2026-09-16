-- Q152: fecha a exceção de autoria da regularização sem alterar a migration já aplicada.
CREATE OR REPLACE FUNCTION autoria_segunda_chamada_valida(
  registro_id TEXT, realizacao_id TEXT, autor_id TEXT, realizada_por_id TEXT, realizada_em TIMESTAMP, motivo TEXT, evidencias TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE AS $$
DECLARE proposta_id TEXT; designado_atual TEXT; designado_historico TEXT;
BEGIN
 IF autor_id IS NULL OR realizada_por_id IS NULL
    OR NOT nota_segunda_chamada_autorizada(registro_id,realizacao_id,realizada_em,realizada_por_id) THEN RETURN false; END IF;
 SELECT p.id INTO proposta_id FROM "RealizacaoSegundaChamada" sc JOIN "ReservaSegundaChamada" rs ON rs.id=sc."reservaId" JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId" WHERE sc.id=realizacao_id FOR KEY SHARE OF sc,rs,p;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT d."professorId" INTO designado_historico FROM "DesignacaoSegundaChamada" d WHERE d."propostaId"=proposta_id AND d."criadaEm"<=realizada_em AND d.inicio<=realizada_em AND (d.fim IS NULL OR d.fim>realizada_em) ORDER BY d.versao DESC LIMIT 1 FOR SHARE;
 IF autor_id=realizada_por_id THEN
  IF motivo IS NOT NULL OR evidencias IS NOT NULL THEN RETURN false; END IF;
  SELECT d."professorId" INTO designado_atual FROM "DesignacaoSegundaChamada" d WHERE d."propostaId"=proposta_id AND d."criadaEm"<=(clock_timestamp() AT TIME ZONE 'UTC') AND d.inicio<=(clock_timestamp() AT TIME ZONE 'UTC') AND (d.fim IS NULL OR d.fim>(clock_timestamp() AT TIME ZONE 'UTC')) ORDER BY d.versao DESC LIMIT 1 FOR SHARE;
  RETURN COALESCE(designado_atual=autor_id AND designado_historico=autor_id,false);
 END IF;
 IF COALESCE(length(btrim(motivo)),0)<5 OR COALESCE(length(btrim(evidencias)),0)<5 OR length(motivo)>2000 OR length(evidencias)>4000 OR designado_historico IS DISTINCT FROM realizada_por_id THEN RETURN false; END IF;
 SELECT d."professorId" INTO designado_atual FROM "DesignacaoAvaliacao" d WHERE d."registroId"=registro_id ORDER BY d.versao DESC LIMIT 1 FOR SHARE;
 RETURN COALESCE(designado_atual=autor_id,false);
END $$;