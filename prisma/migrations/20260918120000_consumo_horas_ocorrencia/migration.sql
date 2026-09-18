-- Q92: uma reserva antecipada pode ser consumida pela conferência financeira
-- imutável de falta cobrável ou cancelamento tardio, sem diário/presença.
ALTER TABLE "ConsumoHorasCompradas" ADD COLUMN "conferenciaOcorrenciaId" TEXT;
ALTER TABLE "ConsumoHorasCompradas" ALTER COLUMN "estadoDiario" DROP NOT NULL;
ALTER TABLE "ConsumoHorasCompradas" ADD CONSTRAINT "ConsumoHorasCompradas_conferenciaOcorrenciaId_key" UNIQUE ("conferenciaOcorrenciaId");
ALTER TABLE "ConsumoHorasCompradas" ADD CONSTRAINT "ConsumoHorasCompradas_conferenciaOcorrenciaId_fkey"
  FOREIGN KEY ("conferenciaOcorrenciaId") REFERENCES "ConferenciaOcorrenciaHoras"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ConsumoHorasCompradas" ADD CONSTRAINT "consumo_horas_exige_uma_fonte_258"
  CHECK (("estadoDiario" IS NULL) <> ("conferenciaOcorrenciaId" IS NULL));

CREATE OR REPLACE FUNCTION conferir_base_consumo_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "ReservaHorasCompradas"; compra "CompraHorasAntecipadas"; e "EncontroAgenda"; a "AulaDiario";
  aluno_id TEXT; total INTEGER; conferencia "ConferenciaOcorrenciaHoras"; ocorrencia "OcorrenciaParticular";
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 PERFORM id FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
 IF NOT EXISTS (SELECT 1 FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND (papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[])) THEN
   RAISE EXCEPTION 'Autor sem permissão para consumir horas';
 END IF;
 IF (NEW."estadoDiario" IS NULL) = (NEW."conferenciaOcorrenciaId" IS NULL) THEN
   RAISE EXCEPTION 'Consumo exige exatamente diário ou conferência de ocorrência';
 END IF;
 SELECT * INTO r FROM "ReservaHorasCompradas" WHERE id = NEW."reservaId" FOR SHARE;
 SELECT * INTO compra FROM "CompraHorasAntecipadas" WHERE id = r."compraId" FOR SHARE;
 SELECT * INTO e FROM "EncontroAgenda" WHERE id = r."encontroId" FOR SHARE;
 IF r.id IS NULL OR compra.id IS NULL OR e.id IS NULL OR e."matriculaId" IS DISTINCT FROM compra."matriculaId"
    OR e.inicio IS DISTINCT FROM r.inicio OR e.fim IS DISTINCT FROM r.fim THEN
   RAISE EXCEPTION 'Consumo exige reserva, compra e agenda compatíveis';
 END IF;
 IF NEW."conferenciaOcorrenciaId" IS NOT NULL THEN
   SELECT * INTO conferencia FROM "ConferenciaOcorrenciaHoras" WHERE id = NEW."conferenciaOcorrenciaId" FOR SHARE;
   SELECT * INTO ocorrencia FROM "OcorrenciaParticular" WHERE id = conferencia."ocorrenciaId" FOR SHARE;
   IF conferencia.id IS NULL OR conferencia."conferenteId" IS DISTINCT FROM NEW."autorId"
      OR conferencia."encontroId" IS DISTINCT FROM e.id OR ocorrencia."encontroId" IS DISTINCT FROM e.id
      OR ocorrencia."matriculaId" IS DISTINCT FROM compra."matriculaId" OR conferencia.minutos IS DISTINCT FROM r.minutos
      OR conferencia.desfecho NOT IN ('FALTA_COBRAVEL', 'CANCELAMENTO_TARDIO')
      OR EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" WHERE "reservaId" = r.id AND aprovada) THEN
     RAISE EXCEPTION 'Consumo por ocorrência exige conferência cobrável da reserva vigente';
   END IF;
   RETURN NEW;
 END IF;
 SELECT * INTO a FROM "AulaDiario" WHERE "encontroId" = e.id FOR SHARE;
 SELECT "alunoId" INTO aluno_id FROM "Matricula" WHERE id = compra."matriculaId";
 IF a.id IS NULL OR e.status NOT IN ('PREVISTO','MINISTRADO') OR a."professorId" IS DISTINCT FROM e."professorId"
    OR a."ocorridaEm" IS DISTINCT FROM e.inicio OR length(trim(a.conteudo)) = 0 OR NEW."estadoDiario" !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'Consumo exige reserva e diário compatíveis';
 END IF;
 SELECT count(*) INTO total FROM "RegistroAulaAluno" WHERE "aulaId" = a.id;
 IF total <> 1 OR NOT EXISTS (SELECT 1 FROM "RegistroAulaAluno" WHERE "aulaId" = a.id AND "alunoId" = aluno_id AND presente IS TRUE) THEN
   RAISE EXCEPTION 'Consumo por realização exige presença do aluno contratado';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_conferencia_ocorrencia_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o "OcorrenciaParticular"%ROWTYPE; c "CondicoesHorasMatricula"%ROWTYPE;
 e "EncontroAgenda"%ROWTYPE; m "Matricula"%ROWTYPE; u "Usuario"%ROWTYPE; resultado text; minutos numeric; valor numeric;
 aditivo_inicio "VersaoCondicoesAditivo"%ROWTYPE; preco_hora text; reserva "ReservaHorasCompradas"%ROWTYPE; compra "CompraHorasAntecipadas"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conferências financeiras são preservadas.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO e FROM "EncontroAgenda" WHERE id=NEW."encontroId" FOR UPDATE;
 SELECT * INTO o FROM "OcorrenciaParticular" WHERE id=NEW."ocorrenciaId";
 SELECT * INTO c FROM "CondicoesHorasMatricula" WHERE id=NEW."condicoesId";
 SELECT * INTO m FROM "Matricula" WHERE id=o."matriculaId" FOR UPDATE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."conferenteId" FOR SHARE;
 SELECT * INTO reserva FROM "ReservaHorasCompradas" WHERE "encontroId"=e.id FOR SHARE;
 SELECT * INTO compra FROM "CompraHorasAntecipadas" WHERE id=reserva."compraId" FOR SHARE;
 IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Conferente financeiro sem permissão.'; END IF;
 IF o."encontroId" IS DISTINCT FROM e.id OR e."matriculaId" IS DISTINCT FROM o."matriculaId" OR c."matriculaId" IS DISTINCT FROM o."matriculaId" OR c.status IS DISTINCT FROM 'APROVADA'
  OR e.inicio IS DISTINCT FROM o.inicio OR e.fim IS DISTINCT FROM o.fim OR e."turmaId" IS NOT NULL
  OR EXISTS (SELECT 1 FROM "OcorrenciaParticular" WHERE "encontroId"=e.id AND versao>o.versao) THEN RAISE EXCEPTION 'Origens da conferência divergentes.'; END IF;
 IF m."contratoOk" IS DISTINCT FROM true OR m."confirmacaoContratoEm" IS NULL OR m."contratoDocumentoId" IS DISTINCT FROM c."documentoId" OR NEW.moeda IS DISTINCT FROM m.moeda OR c.regras->>'moeda' IS DISTINCT FROM NEW.moeda THEN RAISE EXCEPTION 'Contrato e moeda incompatíveis.'; END IF;
 PERFORM id FROM "Documento" WHERE id=c."documentoId" FOR SHARE;
 IF NOT EXISTS (SELECT 1 FROM "Documento" WHERE id=c."documentoId" AND categoria='CONTRATO' AND NOT arquivado AND ("matriculaId"=m.id OR "leadId"=m."leadId")) THEN RAISE EXCEPTION 'Documento indisponível.'; END IF;
 IF (c.regras->>'vigenteDesde')::timestamptz > o.inicio AT TIME ZONE 'UTC' OR EXISTS (
  SELECT 1 FROM "CondicoesHorasMatricula" x WHERE x."matriculaId"=m.id AND x.id<>c.id AND x.status IN ('PENDENTE','APROVADA')
   AND (x.regras->>'vigenteDesde')::timestamptz < o.fim AT TIME ZONE 'UTC'
   AND (x.status='PENDENTE' OR (x.regras->>'vigenteDesde')::timestamptz > (c.regras->>'vigenteDesde')::timestamptz
    OR ((x.regras->>'vigenteDesde')::timestamptz=(c.regras->>'vigenteDesde')::timestamptz AND x.versao>c.versao))
 ) THEN RAISE EXCEPTION 'Confira a vigência contratual.'; END IF;
 SELECT * INTO aditivo_inicio FROM "VersaoCondicoesAditivo" WHERE "matriculaId"=m.id AND "vigenciaInicio" <= o.inicio ORDER BY "vigenciaInicio" DESC, versao DESC LIMIT 1 FOR SHARE;
 IF EXISTS (SELECT 1 FROM "VersaoCondicoesAditivo" v WHERE v."matriculaId"=m.id AND v."vigenciaInicio" > o.inicio AND v."vigenciaInicio" < o.fim
   AND (v.condicoes->'HORA_VALOR' IS DISTINCT FROM aditivo_inicio.condicoes->'HORA_VALOR' OR v.condicoes->'MOEDA' IS DISTINCT FROM aditivo_inicio.condicoes->'MOEDA' OR v.condicoes->'REGIME' IS DISTINCT FROM aditivo_inicio.condicoes->'REGIME')) THEN RAISE EXCEPTION 'Mudança de preço, moeda ou regime durante o encontro exige revisão.'; END IF;
 preco_hora := c.regras->>'valorHora';
 IF aditivo_inicio.id IS NOT NULL THEN
   IF jsonb_typeof(aditivo_inicio.condicoes->'MOEDA') IS NOT NULL AND (aditivo_inicio.condicoes->'MOEDA'->>'tipo' IS DISTINCT FROM 'MOEDA' OR aditivo_inicio.condicoes->'MOEDA'->>'moeda' IS DISTINCT FROM m.moeda) THEN RAISE EXCEPTION 'Moeda da versão de aditivo incompatível com o contrato.'; END IF;
   IF jsonb_typeof(aditivo_inicio.condicoes->'REGIME') IS NOT NULL AND (aditivo_inicio.condicoes->'REGIME'->>'tipo' IS DISTINCT FROM 'REGIME' OR aditivo_inicio.condicoes->'REGIME'->>'regime' IS DISTINCT FROM 'HORA_PARTICULAR') THEN RAISE EXCEPTION 'Regime da versão de aditivo incompatível com a apuração por hora.'; END IF;
   IF aditivo_inicio.condicoes ? 'HORA_VALOR' THEN
     IF jsonb_typeof(aditivo_inicio.condicoes->'HORA_VALOR') IS DISTINCT FROM 'object' OR aditivo_inicio.condicoes->'HORA_VALOR'->>'tipo' IS DISTINCT FROM 'DINHEIRO' OR aditivo_inicio.condicoes->'HORA_VALOR'->>'valor' !~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$' OR aditivo_inicio.condicoes->'HORA_VALOR'->>'moeda' IS DISTINCT FROM m.moeda THEN RAISE EXCEPTION 'Preço por hora da versão de aditivo é inválido.'; END IF;
     preco_hora := aditivo_inicio.condicoes->'HORA_VALOR'->>'valor';
   END IF;
   IF NOT (NEW.snapshot ? 'aditivo') OR NEW.snapshot->'aditivo' IS DISTINCT FROM jsonb_build_object('id', aditivo_inicio.id, 'versao', aditivo_inicio.versao, 'condicoesHash', aditivo_inicio."condicoesHash") OR NEW.snapshot->>'precoHoraAplicado' IS DISTINCT FROM preco_hora THEN RAISE EXCEPTION 'Memória não referencia a versão de aditivo vigente.'; END IF;
 ELSE
   IF (NEW.snapshot ? 'aditivo') AND NEW.snapshot->'aditivo' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Memória de ocorrência sem aditivo não pode referenciar versão.'; END IF;
   IF (NEW.snapshot ? 'precoHoraAplicado') AND NEW.snapshot->>'precoHoraAplicado' IS DISTINCT FROM preco_hora THEN RAISE EXCEPTION 'Memória não corresponde ao preço por hora aplicado.'; END IF;
 END IF;
 IF o.tipo IN ('CANCELAMENTO_ALUNO','CANCELAMENTO_ESCOLA') THEN
  IF e.status <> 'CANCELADO' OR NOT EXISTS (SELECT 1 FROM "DecisaoCancelamentoParticular" d JOIN "PropostaCancelamentoParticular" p ON p.id=d."propostaId" WHERE p."encontroId"=e.id AND d.aprovada AND p.origem=CASE WHEN o.tipo='CANCELAMENTO_ALUNO' THEN 'ALUNO' ELSE 'ESCOLA' END) THEN RAISE EXCEPTION 'Cancelamento incompatível.'; END IF;
 ELSE
  IF e.status NOT IN ('PREVISTO','MINISTRADO') THEN RAISE EXCEPTION 'Estado incompatível com a ocorrência.'; END IF;
 END IF;
 resultado := CASE o.tipo WHEN 'REALIZADA' THEN 'REALIZADA' WHEN 'FALTA_ALUNO' THEN 'FALTA_COBRAVEL' WHEN 'CANCELAMENTO_ESCOLA' THEN 'CANCELAMENTO_ESCOLA' ELSE CASE WHEN o."comunicadoEm" <= o.inicio - make_interval(mins => (c.regras->>'antecedenciaCancelamentoMinutos')::integer) THEN 'CANCELAMENTO_NO_PRAZO' ELSE 'CANCELAMENTO_TARDIO' END END;
 minutos := extract(epoch FROM (o.fim-o.inicio))/60;
 valor := CASE WHEN resultado IN ('REALIZADA','FALTA_COBRAVEL','CANCELAMENTO_TARDIO') THEN round(preco_hora::numeric * minutos/60,2) ELSE 0 END;
 IF reserva.id IS NOT NULL AND compra.id IS NOT NULL AND compra."minutosComprados" > 0 AND resultado IN ('FALTA_COBRAVEL','CANCELAMENTO_TARDIO') THEN
   valor := round(compra."valorPagoAlocado" * reserva.minutos / compra."minutosComprados", 2);
 END IF;
 IF minutos<=0 OR minutos<>trunc(minutos) OR NEW.minutos<>minutos OR NEW.valor<>valor OR NEW.desfecho<>resultado OR length(trim(NEW.motivo))<5 THEN RAISE EXCEPTION 'Cálculo financeiro divergente.'; END IF;
 IF reserva.id IS NOT NULL THEN
   IF resultado NOT IN ('FALTA_COBRAVEL','CANCELAMENTO_TARDIO') OR compra.id IS NULL OR compra."matriculaId" IS DISTINCT FROM m.id OR compra.moeda IS DISTINCT FROM m.moeda OR reserva.inicio IS DISTINCT FROM e.inicio OR reserva.fim IS DISTINCT FROM e.fim OR reserva.minutos <> minutos
      OR EXISTS (SELECT 1 FROM "ConsumoHorasCompradas" WHERE "reservaId"=reserva.id) OR EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" WHERE "reservaId"=reserva.id AND aprovada)
      OR NEW.snapshot->'reservaAntecipada' IS DISTINCT FROM jsonb_build_object('reservaId', reserva.id, 'compraId', compra.id, 'minutos', reserva.minutos, 'moeda', compra.moeda, 'cobrancaId', compra."cobrancaId", 'valorOriginal', compra."valorOriginal"::text, 'valorPagoAlocado', compra."valorPagoAlocado"::text) THEN RAISE EXCEPTION 'Reserva antecipada não permite esta conferência.'; END IF;
 ELSIF NEW.snapshot ? 'reservaAntecipada' THEN RAISE EXCEPTION 'Memória informa reserva inexistente.';
 END IF;
 IF NEW.snapshot->'regras' IS DISTINCT FROM c.regras OR NEW.snapshot->>'ocorrenciaId' IS DISTINCT FROM o.id OR NEW.snapshot->>'condicoesId' IS DISTINCT FROM c.id OR NEW.snapshot->>'matriculaId' IS DISTINCT FROM m.id OR (NEW.snapshot->>'valorApurado')::numeric IS DISTINCT FROM valor THEN RAISE EXCEPTION 'Memória financeira divergente.'; END IF;
 NEW."conferidaEm" := clock_timestamp() AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION exigir_consumo_antecipacao_ocorrencia_258() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.desfecho IN ('FALTA_COBRAVEL','CANCELAMENTO_TARDIO') AND EXISTS (SELECT 1 FROM "ReservaHorasCompradas" WHERE "encontroId"=NEW."encontroId") THEN
   IF NOT EXISTS (SELECT 1 FROM "ConsumoHorasCompradas" c JOIN "ReservaHorasCompradas" r ON r.id=c."reservaId" WHERE c."conferenciaOcorrenciaId"=NEW.id AND r."encontroId"=NEW."encontroId") THEN RAISE EXCEPTION 'Conferência com reserva antecipada exige consumo atômico'; END IF;
 ELSIF EXISTS (SELECT 1 FROM "ConsumoHorasCompradas" WHERE "conferenciaOcorrenciaId"=NEW.id) THEN
   RAISE EXCEPTION 'Consumo por ocorrência não corresponde à reserva cobrável';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER exigir_consumo_antecipacao_ocorrencia_258
 AFTER INSERT ON "ConferenciaOcorrenciaHoras" DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION exigir_consumo_antecipacao_ocorrencia_258();

-- A conferência imutável também fecha a fonte: uma versão posterior da
-- ocorrência não pode tornar a memória financeira já concluída divergente.
-- Esta guarda fica na função que já serializa a inclusão da ocorrência com a
-- agenda, em vez de depender do trigger histórico paralelo.
CREATE OR REPLACE FUNCTION conferir_ocorrencia_particular() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "EncontroAgenda"%ROWTYPE; u "Usuario"%ROWTYPE; anterior integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Ocorrências particulares devem ser preservadas.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO e FROM "EncontroAgenda" WHERE id = NEW."encontroId" FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "ConferenciaOcorrenciaHoras" WHERE "encontroId" = e.id) THEN
    RAISE EXCEPTION 'Encontro conferido exige revisão dos efeitos financeiros.';
  END IF;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF e."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR e."turmaId" IS NOT NULL
    OR e."professorId" IS DISTINCT FROM NEW."autorId" OR u.ativo IS DISTINCT FROM true
    OR NOT ('PROFESSOR' = ANY(u.papeis)) THEN RAISE EXCEPTION 'Sem atribuição docente para esta particular.'; END IF;
  IF e.inicio <> NEW.inicio OR e.fim <> NEW.fim THEN RAISE EXCEPTION 'A agenda mudou.'; END IF;
  NEW."criadoEm" := clock_timestamp() AT TIME ZONE 'UTC';
  IF NEW."comunicadoEm" > NEW."criadoEm" THEN RAISE EXCEPTION 'Data de ocorrência inválida.'; END IF;
  IF NEW.tipo IN ('REALIZADA', 'FALTA_ALUNO') THEN
    IF e.status NOT IN ('PREVISTO', 'MINISTRADO') OR NEW.fim > NEW."criadoEm" THEN RAISE EXCEPTION 'Aguarde o término do encontro previsto.'; END IF;
  ELSE
    IF e.status <> 'CANCELADO' OR NOT EXISTS (
      SELECT 1 FROM "DecisaoCancelamentoParticular" d JOIN "PropostaCancelamentoParticular" p ON p.id = d."propostaId"
      WHERE p."encontroId" = e.id AND d.aprovada AND p.origem = CASE WHEN NEW.tipo = 'CANCELAMENTO_ALUNO' THEN 'ALUNO' ELSE 'ESCOLA' END
    ) THEN RAISE EXCEPTION 'Cancelamento precisa de aprovação pedagógica.'; END IF;
  END IF;
  SELECT COALESCE(MAX(versao), 0) INTO anterior FROM "OcorrenciaParticular" WHERE "encontroId" = e.id;
  IF NEW.versao <> anterior + 1 THEN RAISE EXCEPTION 'Versão da ocorrência mudou.'; END IF;
  RETURN NEW;
END $$;
