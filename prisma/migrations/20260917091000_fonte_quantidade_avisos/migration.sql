-- Q38/196. Fonte material dos avisos de quantidade; nenhum transporte é acionado.
CREATE OR REPLACE FUNCTION quantidade_aviso_instantes(evento_id text, encontro_id text)
RETURNS TABLE(instante timestamptz) LANGUAGE plpgsql STABLE AS $$
DECLARE contexto record; anterior jsonb; posterior jsonb; item jsonb; indice integer := 0;
BEGIN
 SELECT i.snapshot, p.id AS proposta_id, n.* INTO contexto
 FROM "Evento" e
 JOIN "PropostaQuantidadeAulasModalidade" p ON p.id=e.payload->>'propostaId'
 JOIN "DecisaoQuantidadeAulasModalidade" d ON d."propostaId"=p.id AND d.id=e.payload->>'decisaoId'
 JOIN "AplicacaoQuantidadeAulasModalidade" a ON a."propostaId"=p.id AND a.id=e.payload->>'aplicacaoId'
 JOIN "EncontroAgenda" n ON n.id=encontro_id AND n."matriculaId" IS NULL
 JOIN "ImpactoQuantidadeAulasModalidade" i ON i."propostaId"=p.id AND i."turmaId"=n."turmaId" AND i.publicada
 WHERE e.id=evento_id AND e.tipo='QuantidadeAulasModalidadeAplicada' AND e."agregadoTipo"='Modalidade'
   AND e."agregadoId"=p."modalidadeId" AND p.situacao='APLICADA' AND d.aprovada
   AND d."decisorId"<>p."preparadorId" AND a."aplicadorId"=d."decisorId" AND e."autorId"=a."aplicadorId"
   AND jsonb_typeof(e.payload->'encontros')='array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(e.payload->'encontros') h WHERE h->>'encontroId'=n.id AND h->>'turmaId'=n."turmaId");
 IF NOT FOUND OR jsonb_typeof(contexto.snapshot->'agendaAntes') IS DISTINCT FROM 'array'
   OR jsonb_typeof(contexto.snapshot->'agendaDepois') IS DISTINCT FROM 'array' THEN RETURN; END IF;
 SELECT h INTO anterior FROM jsonb_array_elements(contexto.snapshot->'agendaAntes') h WHERE h->>'id'=encontro_id;
 SELECT h INTO posterior FROM jsonb_array_elements(contexto.snapshot->'agendaDepois') h WHERE h->>'id'=encontro_id;
 IF posterior IS NULL THEN
   FOR item IN SELECT h FROM jsonb_array_elements(contexto.snapshot->'agendaDepois') h WHERE h->>'id' IS NULL LOOP
     IF contexto."chaveIdempotencia"=('quantidade:'||contexto.proposta_id||':'||contexto."turmaId"||':'||indice::text) THEN posterior:=item; EXIT; END IF;
     indice:=indice+1;
   END LOOP;
 END IF;
 IF posterior IS NULL OR posterior->>'inicio' IS NULL OR posterior->>'fim' IS NULL OR posterior->>'status' IS NULL THEN RETURN; END IF;
 IF contexto.inicio IS DISTINCT FROM ((posterior->>'inicio')::timestamptz AT TIME ZONE 'UTC')
   OR contexto.fim IS DISTINCT FROM ((posterior->>'fim')::timestamptz AT TIME ZONE 'UTC')
   OR contexto.status::text IS DISTINCT FROM posterior->>'status'
   OR contexto."professorId" IS DISTINCT FROM posterior->>'professorId'
   OR contexto."propostaGradeId" IS DISTINCT FROM posterior->>'propostaGradeId' THEN RETURN; END IF;
 IF anterior IS NOT NULL AND anterior->>'inicio'=posterior->>'inicio' AND anterior->>'fim'=posterior->>'fim'
   AND anterior->>'status'=posterior->>'status' THEN RETURN; END IF;
 IF anterior IS NOT NULL THEN instante:=(anterior->>'inicio')::timestamptz; RETURN NEXT; END IF;
 instante:=(posterior->>'inicio')::timestamptz; RETURN NEXT;
 EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN;
END $$;


CREATE OR REPLACE FUNCTION "guard_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW."eventoId" IS NULL OR NEW."matriculaId" IS NULL OR NEW.situacao<>'PREPARADO'::"SituacaoAvisoAlteracaoAgenda" THEN RAISE EXCEPTION 'Aviso exige origem aplicada e estado PREPARADO'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Evento" e WHERE e.id=NEW."eventoId" AND e.payload->>'aprovada'='true' AND ((e."agregadoTipo"='Matricula' AND e."agregadoId"=NEW."matriculaId" AND e.tipo IN ('RemarcacaoParticularDecidida','RemarcacaoAgendaReposicaoDecidida')) OR (e."agregadoTipo"='ConfiguracaoOperacional' AND e."agregadoId"='escola' AND e.tipo='SubstituicaoDocenteDecidida' AND e.payload ? 'encontrosIds') OR (e."agregadoTipo"='ConfiguracaoOperacional' AND e."agregadoId"='escola' AND e.tipo='ReplanejamentoConjuntoAplicado' AND e.payload ? 'revisaoId' AND e.payload ? 'decisaoId' AND e.payload ? 'horarios' AND EXISTS (SELECT 1 FROM "RascunhoReplanejamento" r JOIN "DecisaoReplanejamentoConjunto" d ON d."rascunhoId"=r.id JOIN "AplicacaoReplanejamentoConjunto" a ON a."decisaoId"=d.id WHERE r.id=e.payload->>'revisaoId' AND d.id=e.payload->>'decisaoId' AND d.aprovada)))) AND NOT EXISTS (SELECT 1 FROM "Evento" e CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e.payload->'encontros')='array' THEN e.payload->'encontros' ELSE '[]'::jsonb END) h CROSS JOIN LATERAL quantidade_aviso_instantes(e.id,h->>'encontroId') f WHERE e.id=NEW."eventoId") THEN RAISE EXCEPTION 'Origem do aviso inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Matricula" m WHERE m.id=NEW."matriculaId" AND m."alunoId"=NEW."alunoId") THEN RAISE EXCEPTION 'Matrícula do aviso incompatível'; END IF;
 ELSE
  IF NEW."eventoId" IS DISTINCT FROM OLD."eventoId" OR NEW."matriculaId" IS DISTINCT FROM OLD."matriculaId" OR NEW."alunoId"<>OLD."alunoId" OR NEW.canal<>OLD.canal OR NEW."contatoHash"<>OLD."contatoHash" OR NEW.chave<>OLD.chave OR NEW."mudancaId"<>OLD."mudancaId" OR NEW."criadoEm"<>OLD."criadoEm" THEN RAISE EXCEPTION 'Origem do aviso é imutável'; END IF;
 END IF; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_item_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_aviso RECORD; v_h JSONB; v_ok BOOLEAN := false;
BEGIN
 SELECT aviso."matriculaId",evento.tipo,evento."agregadoTipo",evento."agregadoId",evento.payload,encontro."matriculaId" AS encontro_matricula,encontro."turmaId",encontro.inicio,encontro.fim INTO v_aviso FROM "AvisoAlteracaoAgenda" aviso JOIN "EncontroAgenda" encontro ON encontro.id=NEW."encontroId" JOIN "Evento" evento ON evento.id=aviso."eventoId" WHERE aviso.id=NEW."avisoId" AND aviso.situacao='PREPARADO';
 IF FOUND AND v_aviso.tipo='QuantidadeAulasModalidadeAplicada' THEN
   IF v_aviso.encontro_matricula IS NOT NULL OR v_aviso."turmaId" IS NULL OR NOT EXISTS (
     SELECT 1 FROM "AvisoAlteracaoAgenda" av
     CROSS JOIN LATERAL quantidade_aviso_instantes(av."eventoId",NEW."encontroId") f
     JOIN "AlocacaoTurma" a ON a."matriculaId"=av."matriculaId" AND a."turmaId"=v_aviso."turmaId"
     WHERE av.id=NEW."avisoId" AND alocacao_cobre_instante(a,f.instante)
   ) THEN RAISE EXCEPTION 'Item de quantidade sem fonte material ou vínculo histórico válido'; END IF;
   RETURN NEW;
 END IF;
 IF NOT FOUND OR NOT (v_aviso.payload->'encontrosIds' ? NEW."encontroId" OR NEW."encontroId" IN (v_aviso.payload->>'encontroOriginalId',v_aviso.payload->>'encontroNovoId')) THEN RAISE EXCEPTION 'Item não pertence à alteração aplicada'; END IF;
 IF v_aviso.encontro_matricula=v_aviso."matriculaId" THEN RETURN NEW; END IF;
 IF v_aviso."agregadoTipo"<>'ConfiguracaoOperacional' OR v_aviso."agregadoId"<>'escola' OR v_aviso."turmaId" IS NULL THEN RAISE EXCEPTION 'Item não pertence à alteração aplicada'; END IF;
 IF v_aviso.tipo='SubstituicaoDocenteDecidida' THEN SELECT EXISTS(SELECT 1 FROM "AlocacaoTurma" a WHERE a."turmaId"=v_aviso."turmaId" AND a."matriculaId"=v_aviso."matriculaId" AND alocacao_cobre_instante(a, v_aviso.inicio AT TIME ZONE 'UTC')) INTO v_ok;
 ELSIF v_aviso.tipo='ReplanejamentoConjuntoAplicado' AND v_aviso.encontro_matricula IS NULL THEN
  SELECT h INTO v_h FROM jsonb_array_elements(v_aviso.payload->'horarios') h WHERE h->>'encontroId'=NEW."encontroId";
  IF v_h IS NOT NULL AND v_aviso.inicio=((v_h->>'inicioProposto')::timestamptz AT TIME ZONE 'UTC') AND v_aviso.fim=((v_h->>'fimProposto')::timestamptz AT TIME ZONE 'UTC') THEN SELECT EXISTS(SELECT 1 FROM "AlocacaoTurma" a WHERE a."turmaId"=v_aviso."turmaId" AND a."matriculaId"=v_aviso."matriculaId" AND (alocacao_cobre_instante(a, (v_h->>'inicioAnterior')::timestamptz) OR alocacao_cobre_instante(a, (v_h->>'inicioProposto')::timestamptz))) INTO v_ok; END IF;
 END IF;
 IF NOT v_ok THEN RAISE EXCEPTION 'Item não pertence à alteração aplicada'; END IF;
 RETURN NEW;
END $$;
