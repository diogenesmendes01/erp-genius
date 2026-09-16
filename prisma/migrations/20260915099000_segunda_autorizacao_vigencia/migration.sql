-- Q151: a autorização especial de segunda chamada é válida somente para o
-- fato posterior à sua emissão e para a fonte acadêmica atual do vínculo.
CREATE FUNCTION autorizacao_especial_segunda_chamada_valida(
  alocacao_id TEXT, codigo_avaliacao TEXT, instante TIMESTAMP
) RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE AS $$
DECLARE autorizacao "AutorizacaoEspecialSegundaChamada"%ROWTYPE;
BEGIN
 IF alocacao_id IS NULL OR codigo_avaliacao IS NULL OR instante IS NULL OR NOT isfinite(instante) THEN RETURN false; END IF;
 SELECT ae.* INTO autorizacao
   FROM "AutorizacaoEspecialSegundaChamada" ae
   JOIN "AlocacaoTurma" a ON a.id=ae."alocacaoId"
   JOIN "Matricula" m ON m.id=a."matriculaId"
   JOIN "Turma" t ON t.id=a."turmaId"
   JOIN "Usuario" u ON u.id=ae."autorizadorId"
   WHERE ae."alocacaoId"=alocacao_id
     AND ae."codigoAvaliacao"=codigo_avaliacao
     AND ae."matriculaId"=a."matriculaId"
     AND ae."regraId"=t."regraAvaliacaoId"
     AND ae."criadaEm"<=instante AND instante<=ae."prazoAte"
     AND u.ativo AND u.papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]
   ORDER BY ae."criadaEm" DESC,ae.id DESC
   LIMIT 1 FOR SHARE OF ae,u;
 RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION "guard_segunda_chamada_reserva"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta record; limite integer; extras integer; ocupadas integer; prazo timestamp(3); especial boolean;
BEGIN
 SELECT ps.*,ds.aprovada AS decisao_aprovada,disp.id AS disponibilizacao_id INTO proposta
   FROM "PropostaSegundaChamada" ps
   LEFT JOIN "DecisaoSegundaChamada" ds ON ds."propostaId"=ps.id
   LEFT JOIN "DisponibilizacaoSegundaChamada" disp ON disp."propostaId"=ps.id
   WHERE ps.id=NEW."propostaId" FOR KEY SHARE OF ps;
 IF NOT FOUND OR proposta.decisao_aprovada IS DISTINCT FROM true OR proposta.disponibilizacao_id IS NULL
    OR NEW."matriculaId"<>proposta."matriculaId" OR NEW."regraId"<>proposta."regraId"
    OR NEW."codigoAvaliacao"<>proposta."codigoAvaliacao" THEN
   RAISE EXCEPTION 'reserva exige proposta aprovada e disponibilizada no contexto exato';
 END IF;
 SELECT (item->>'limiteSegundasChamadas')::integer INTO limite
   FROM "VersaoRegraAvaliacao" regra CROSS JOIN LATERAL jsonb_array_elements(regra.conteudo->'avaliacoes') item
   WHERE regra.id=proposta."regraId" AND item->>'codigo'=proposta."codigoAvaliacao";
 IF limite IS NULL THEN RAISE EXCEPTION 'limite não configurado'; END IF;
 SELECT COALESCE((SELECT pr."novoPrazo" FROM "PropostaProrrogacaoSegundaChamada" pr
     JOIN "DecisaoProrrogacaoSegundaChamada" dp ON dp."propostaId"=pr.id AND dp.aprovada
     WHERE pr."disponibilizacaoId"=proposta.disponibilizacao_id ORDER BY pr.versao DESC LIMIT 1),disp."prazoAte") INTO prazo
   FROM "DisponibilizacaoSegundaChamada" disp WHERE disp.id=proposta.disponibilizacao_id;
 IF prazo IS NULL OR (clock_timestamp() AT TIME ZONE 'UTC')>=prazo THEN RAISE EXCEPTION 'prazo da segunda chamada vencido não permite reserva'; END IF;
 especial:=autorizacao_especial_segunda_chamada_valida(
   proposta."alocacaoId",proposta."codigoAvaliacao",clock_timestamp() AT TIME ZONE 'UTC'
 );
 IF NOT EXISTS(SELECT 1 FROM "AlocacaoTurma" al JOIN "Matricula" ma ON ma.id=al."matriculaId"
   WHERE al.id=proposta."alocacaoId" AND al.ativa AND ma.status='ATIVA') AND NOT especial THEN
   RAISE EXCEPTION 'reserva exige vínculo/matrícula ativos ou autorização especial vigente';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('segunda:'||NEW."matriculaId"||':'||NEW."regraId"||':'||NEW."codigoAvaliacao",0));
 SELECT COALESCE(sum(pe.quantidade),0) INTO extras FROM "PropostaExtraSegundaChamada" pe
   JOIN "DecisaoExtraSegundaChamada" de ON de."propostaId"=pe.id AND de.aprovada
   WHERE pe."matriculaId"=NEW."matriculaId" AND pe."regraId"=NEW."regraId" AND pe."codigoAvaliacao"=NEW."codigoAvaliacao";
 SELECT count(*) INTO ocupadas FROM "ReservaSegundaChamada"
   WHERE "matriculaId"=NEW."matriculaId" AND "regraId"=NEW."regraId" AND "codigoAvaliacao"=NEW."codigoAvaliacao"
     AND status IN ('RESERVADA','CONSUMIDA_REALIZACAO','CONSUMIDA_FALTA','CONSUMIDA_CANCELAMENTO_TARDIO');
 IF ocupadas>=limite+extras THEN RAISE EXCEPTION 'saldo de segunda chamada esgotado'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION guardar_realizacao_segunda_chamada_situacao_contratual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE origem record; situacao TEXT;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Realização de segunda chamada é imutável'; END IF;
 IF NEW."realizadaEm" IS NULL OR NOT isfinite(NEW."realizadaEm") THEN RAISE EXCEPTION 'Data da realização inválida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT r.id,r.status,p."matriculaId",p."alocacaoId",p."regraId",p."codigoAvaliacao" INTO origem
   FROM "ReservaSegundaChamada" r
   JOIN "PropostaSegundaChamada" p ON p.id=r."propostaId"
   JOIN "Matricula" m ON m.id=p."matriculaId"
   WHERE r.id=NEW."reservaId" FOR UPDATE OF r,m;
 IF NOT FOUND OR origem.status<>'CONSUMIDA_REALIZACAO' THEN RAISE EXCEPTION 'Realização exige reserva de segunda chamada consumida'; END IF;
 SELECT situacao_matricula_no_instante(origem."matriculaId",NEW."realizadaEm") INTO situacao;
 IF situacao='ATIVA' THEN RETURN NEW; END IF;
 IF situacao IN ('PAUSADA','ENCERRADA')
    AND autorizacao_especial_segunda_chamada_valida(origem."alocacaoId",origem."codigoAvaliacao",NEW."realizadaEm") THEN
   RETURN NEW;
 END IF;
 IF situacao='A_CONFERIR' THEN RAISE EXCEPTION 'Histórico contratual da segunda chamada exige conferência'; END IF;
 RAISE EXCEPTION 'Segunda chamada pausada ou encerrada exige autorização especial válida na data';
END $$;

CREATE TRIGGER guardar_realizacao_segunda_chamada_situacao_contratual
BEFORE INSERT ON "RealizacaoSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION guardar_realizacao_segunda_chamada_situacao_contratual();
