CREATE OR REPLACE FUNCTION "guard_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW."eventoId" IS NULL OR NEW."matriculaId" IS NULL OR NEW.situacao<>'PREPARADO'::"SituacaoAvisoAlteracaoAgenda" THEN RAISE EXCEPTION 'Aviso exige origem aplicada e estado PREPARADO'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Evento" e WHERE e.id=NEW."eventoId" AND e.payload->>'aprovada'='true' AND ((e."agregadoTipo"='Matricula' AND e."agregadoId"=NEW."matriculaId" AND e.tipo IN ('RemarcacaoParticularDecidida','RemarcacaoAgendaReposicaoDecidida')) OR (e."agregadoTipo"='ConfiguracaoOperacional' AND e."agregadoId"='escola' AND e.tipo='SubstituicaoDocenteDecidida' AND e.payload ? 'encontrosIds') OR (e."agregadoTipo"='ConfiguracaoOperacional' AND e."agregadoId"='escola' AND e.tipo='ReplanejamentoConjuntoAplicado' AND e.payload ? 'revisaoId' AND e.payload ? 'decisaoId' AND e.payload ? 'horarios' AND EXISTS (SELECT 1 FROM "RascunhoReplanejamento" r JOIN "DecisaoReplanejamentoConjunto" d ON d."rascunhoId"=r.id JOIN "AplicacaoReplanejamentoConjunto" a ON a."decisaoId"=d.id WHERE r.id=e.payload->>'revisaoId' AND d.id=e.payload->>'decisaoId' AND d.aprovada)))) THEN RAISE EXCEPTION 'Origem do aviso inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Matricula" m WHERE m.id=NEW."matriculaId" AND m."alunoId"=NEW."alunoId") THEN RAISE EXCEPTION 'Matrícula do aviso incompatível'; END IF;
 ELSE
  IF NEW."eventoId" IS DISTINCT FROM OLD."eventoId" OR NEW."matriculaId" IS DISTINCT FROM OLD."matriculaId" OR NEW."alunoId"<>OLD."alunoId" OR NEW.canal<>OLD.canal OR NEW."contatoHash"<>OLD."contatoHash" OR NEW.chave<>OLD.chave OR NEW."mudancaId"<>OLD."mudancaId" OR NEW."criadoEm"<>OLD."criadoEm" THEN RAISE EXCEPTION 'Origem do aviso é imutável'; END IF;
 END IF; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_item_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_aviso RECORD; v_h JSONB; v_ok BOOLEAN := false;
BEGIN
 SELECT aviso."matriculaId",evento.tipo,evento."agregadoTipo",evento."agregadoId",evento.payload,encontro."matriculaId" AS encontro_matricula,encontro."turmaId",encontro.inicio,encontro.fim INTO v_aviso FROM "AvisoAlteracaoAgenda" aviso JOIN "EncontroAgenda" encontro ON encontro.id=NEW."encontroId" JOIN "Evento" evento ON evento.id=aviso."eventoId" WHERE aviso.id=NEW."avisoId" AND aviso.situacao='PREPARADO';
 IF NOT FOUND OR NOT (v_aviso.payload->'encontrosIds' ? NEW."encontroId" OR NEW."encontroId" IN (v_aviso.payload->>'encontroOriginalId',v_aviso.payload->>'encontroNovoId')) THEN RAISE EXCEPTION 'Item não pertence à alteração aplicada'; END IF;
 IF v_aviso.encontro_matricula=v_aviso."matriculaId" THEN RETURN NEW; END IF;
 IF v_aviso."agregadoTipo"<>'ConfiguracaoOperacional' OR v_aviso."agregadoId"<>'escola' OR v_aviso."turmaId" IS NULL THEN RAISE EXCEPTION 'Item não pertence à alteração aplicada'; END IF;
 IF v_aviso.tipo='SubstituicaoDocenteDecidida' THEN SELECT EXISTS(SELECT 1 FROM "AlocacaoTurma" a WHERE a."turmaId"=v_aviso."turmaId" AND a."matriculaId"=v_aviso."matriculaId" AND a."criadoEm"<=v_aviso.inicio AND (a."encerradaEm" IS NULL OR a."encerradaEm">v_aviso.inicio)) INTO v_ok;
 ELSIF v_aviso.tipo='ReplanejamentoConjuntoAplicado' AND v_aviso.encontro_matricula IS NULL THEN
  SELECT h INTO v_h FROM jsonb_array_elements(v_aviso.payload->'horarios') h WHERE h->>'encontroId'=NEW."encontroId";
  IF v_h IS NOT NULL AND v_aviso.inicio=((v_h->>'inicioProposto')::timestamptz AT TIME ZONE 'UTC') AND v_aviso.fim=((v_h->>'fimProposto')::timestamptz AT TIME ZONE 'UTC') THEN SELECT EXISTS(SELECT 1 FROM "AlocacaoTurma" a WHERE a."turmaId"=v_aviso."turmaId" AND a."matriculaId"=v_aviso."matriculaId" AND ((a."criadoEm"<=((v_h->>'inicioAnterior')::timestamptz AT TIME ZONE 'UTC') AND (a."encerradaEm" IS NULL OR a."encerradaEm">((v_h->>'inicioAnterior')::timestamptz AT TIME ZONE 'UTC'))) OR (a."criadoEm"<=((v_h->>'inicioProposto')::timestamptz AT TIME ZONE 'UTC') AND (a."encerradaEm" IS NULL OR a."encerradaEm">((v_h->>'inicioProposto')::timestamptz AT TIME ZONE 'UTC'))))) INTO v_ok; END IF;
 END IF;
 IF NOT v_ok THEN RAISE EXCEPTION 'Item não pertence à alteração aplicada'; END IF;
 RETURN NEW;
END $$;
