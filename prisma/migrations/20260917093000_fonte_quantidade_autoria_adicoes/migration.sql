-- Q38/198: completa 197 sem modificar 196/197. Para adicoes, a chave
-- idempotente e vinculada tambem ao preparador que originou a proposta.
CREATE OR REPLACE FUNCTION quantidade_aviso_conjunto_completo(evento_id text)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE evento record; proposta_id text; proposta_preparador_id text; invalido boolean;
BEGIN
 SELECT e.*, p.id AS proposta_id, p."preparadorId" AS proposta_preparador_id INTO evento FROM "Evento" e
 JOIN "PropostaQuantidadeAulasModalidade" p ON p.id=e.payload->>'propostaId'
 JOIN "DecisaoQuantidadeAulasModalidade" d ON d."propostaId"=p.id AND d.id=e.payload->>'decisaoId'
 JOIN "AplicacaoQuantidadeAulasModalidade" a ON a."propostaId"=p.id AND a.id=e.payload->>'aplicacaoId'
 WHERE e.id=evento_id AND e.tipo='QuantidadeAulasModalidadeAplicada' AND e."agregadoTipo"='Modalidade'
  AND e."agregadoId"=p."modalidadeId" AND p.situacao='APLICADA' AND d.aprovada
  AND d."decisorId"<>p."preparadorId" AND a."aplicadorId"=d."decisorId" AND e."autorId"=a."aplicadorId"
  AND jsonb_typeof(e.payload->'encontros')='array';
 IF NOT FOUND THEN RETURN false; END IF; proposta_id:=evento.proposta_id; proposta_preparador_id:=evento.proposta_preparador_id;
 SELECT EXISTS (SELECT 1 FROM "ImpactoQuantidadeAulasModalidade" i WHERE i."propostaId"=proposta_id AND (
  jsonb_typeof(i.snapshot->'agendaAntes') IS DISTINCT FROM 'array' OR jsonb_typeof(i.snapshot->'agendaDepois') IS DISTINCT FROM 'array'
  OR EXISTS (SELECT 1 FROM jsonb_array_elements(i.snapshot->'agendaAntes') b WHERE b->>'id' IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(i.snapshot->'agendaDepois') d WHERE d->>'id'=b->>'id'))
  OR EXISTS (SELECT 1 FROM jsonb_array_elements(i.snapshot->'agendaDepois') d WHERE d->>'id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(i.snapshot->'agendaAntes') b WHERE b->>'id'=d->>'id'))
 )) INTO invalido;
 IF invalido THEN RETURN false; END IF;
 RETURN NOT EXISTS (
  WITH payload AS (SELECT h->>'turmaId' turma_id,h->>'encontroId' encontro_id FROM jsonb_array_elements(evento.payload->'encontros') h WHERE jsonb_typeof(h)='object' AND h ? 'turmaId' AND h ? 'encontroId'),
  fotos_existentes AS (SELECT i."turmaId" turma_id,b->>'id' encontro_id,depois.d item FROM "ImpactoQuantidadeAulasModalidade" i CROSS JOIN LATERAL jsonb_array_elements(i.snapshot->'agendaAntes') b JOIN LATERAL (SELECT d FROM jsonb_array_elements(i.snapshot->'agendaDepois') d WHERE d->>'id'=b->>'id') depois ON true WHERE i."propostaId"=proposta_id AND i.publicada AND (b->>'inicio',b->>'fim',b->>'status') IS DISTINCT FROM (depois.d->>'inicio',depois.d->>'fim',depois.d->>'status')),
  existentes AS (SELECT f.turma_id,n.id encontro_id FROM fotos_existentes f JOIN "EncontroAgenda" n ON n.id=f.encontro_id AND n."matriculaId" IS NULL AND n."turmaId"=f.turma_id WHERE n.inicio=((f.item->>'inicio')::timestamptz AT TIME ZONE 'UTC') AND n.fim=((f.item->>'fim')::timestamptz AT TIME ZONE 'UTC') AND n.status::text=f.item->>'status' AND n."professorId" IS NOT DISTINCT FROM f.item->>'professorId' AND n."propostaGradeId" IS NOT DISTINCT FROM f.item->>'propostaGradeId'),
  fotos_adicionadas AS (SELECT i."turmaId" turma_id,d.item,row_number() OVER(PARTITION BY i.id ORDER BY d.ord)-1 indice FROM "ImpactoQuantidadeAulasModalidade" i CROSS JOIN LATERAL jsonb_array_elements(i.snapshot->'agendaDepois') WITH ORDINALITY d(item,ord) WHERE i."propostaId"=proposta_id AND i.publicada AND d.item->>'id' IS NULL),
  adicionados AS (SELECT f.turma_id,n.id encontro_id FROM fotos_adicionadas f JOIN "EncontroAgenda" n ON n."matriculaId" IS NULL AND n."turmaId"=f.turma_id AND n."preparadorId"=proposta_preparador_id AND n."chaveIdempotencia"=('quantidade:'||proposta_id||':'||f.turma_id||':'||f.indice::text) WHERE n.inicio=((f.item->>'inicio')::timestamptz AT TIME ZONE 'UTC') AND n.fim=((f.item->>'fim')::timestamptz AT TIME ZONE 'UTC') AND n.status::text=f.item->>'status' AND n."professorId" IS NOT DISTINCT FROM f.item->>'professorId' AND n."propostaGradeId" IS NOT DISTINCT FROM f.item->>'propostaGradeId'),
  esperados AS (SELECT * FROM existentes UNION ALL SELECT * FROM adicionados),
  invalido_payload AS (SELECT (SELECT count(*) FROM jsonb_array_elements(evento.payload->'encontros'))<>(SELECT count(*) FROM payload) OR EXISTS(SELECT 1 FROM payload WHERE turma_id IS NULL OR turma_id='' OR encontro_id IS NULL OR encontro_id='') OR EXISTS(SELECT 1 FROM payload GROUP BY turma_id,encontro_id HAVING count(*)>1) erro),
  invalido_esperado AS (SELECT (SELECT count(*) FROM esperados)=0 OR (SELECT count(*) FROM esperados)<>(SELECT count(DISTINCT (turma_id,encontro_id)) FROM esperados) OR (SELECT count(*) FROM esperados)<>(SELECT count(*) FROM fotos_existentes)+(SELECT count(*) FROM fotos_adicionadas) erro)
  SELECT 1 FROM invalido_payload WHERE erro UNION ALL SELECT 1 FROM invalido_esperado WHERE erro UNION ALL SELECT 1 FROM payload p LEFT JOIN esperados e ON e.turma_id=p.turma_id AND e.encontro_id=p.encontro_id WHERE e.encontro_id IS NULL UNION ALL SELECT 1 FROM esperados e LEFT JOIN payload p ON p.turma_id=e.turma_id AND p.encontro_id=e.encontro_id WHERE p.encontro_id IS NULL
 );
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $$;
