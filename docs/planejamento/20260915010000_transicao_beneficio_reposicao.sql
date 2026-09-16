-- RASCUNHO PARA MIGRATION 184. Não mover para prisma/migrations sem a rodada
-- central do root. Substitui o rascunho 181, que não deve ser aplicado.
--
-- Q50/Q61: versão anterior continua íntegra; a próxima começa exatamente no
-- fim do período anterior. Se a regra nova tiver fronteira civil/cíclica antes
-- desse instante, o primeiro período é parcial: início=max(fronteira,vigência)
-- e fim preserva a fronteira ancorada da regra. Reservas da matrícula nesse
-- intervalo continuam entrando no contador de AgendaReposicaoIndividual.
CREATE OR REPLACE FUNCTION periodo_beneficio_reposicao(data_agendada DATE, beneficio "BeneficioReposicaoParticularMatricula") RETURNS TABLE(inicio DATE, fim DATE) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE duracao INTEGER; base DATE; blocos INTEGER;
BEGIN
  duracao := beneficio."duracaoPeriodo";
  IF beneficio.unidade='DIAS' THEN
    IF beneficio.referencia='CIVIL' THEN base := date '2000-01-01' + (floor((data_agendada-date '2000-01-01')::numeric/duracao)::integer*duracao);
    ELSE
      IF data_agendada<beneficio."referenciaCiclo" THEN RAISE EXCEPTION 'Data anterior ao ciclo do benefício'; END IF;
      base := beneficio."referenciaCiclo" + (floor((data_agendada-beneficio."referenciaCiclo")::numeric/duracao)::integer*duracao);
    END IF;
    inicio:=GREATEST(base,beneficio."vigenteAPartirDe"); fim:=base+duracao; RETURN NEXT; RETURN;
  END IF;
  IF beneficio.referencia='CIVIL' THEN
    blocos := floor(((extract(year from data_agendada)::integer-2000)*12 + extract(month from data_agendada)::integer-1)::numeric/duracao);
    base := (date '2000-01-01' + make_interval(months => blocos*duracao))::date;
    fim := (date '2000-01-01' + make_interval(months => (blocos+1)*duracao))::date;
  ELSE
    IF data_agendada < beneficio."referenciaCiclo" THEN RAISE EXCEPTION 'Data anterior ao ciclo do benefício'; END IF;
    blocos := floor(((extract(year from data_agendada)::integer-extract(year from beneficio."referenciaCiclo")::integer)*12 + extract(month from data_agendada)::integer-extract(month from beneficio."referenciaCiclo")::integer)::numeric/duracao);
    base := (beneficio."referenciaCiclo" + make_interval(months => blocos*duracao))::date;
    IF base > data_agendada THEN blocos := blocos-1; base := (beneficio."referenciaCiclo" + make_interval(months => blocos*duracao))::date; END IF;
    fim := (beneficio."referenciaCiclo" + make_interval(months => (blocos+1)*duracao))::date;
  END IF;
  inicio:=GREATEST(base,beneficio."vigenteAPartirDe"); RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION validar_vigencia_beneficio_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE anterior "BeneficioReposicaoParticularMatricula"%ROWTYPE;
  calculo "BeneficioReposicaoParticularMatricula"%ROWTYPE;
  fuso TEXT; hoje DATE; base DATE; esperado DATE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('beneficio-reposicao-vigencia:'||NEW."matriculaId",0));
  SELECT "fusoInstitucional" INTO fuso FROM "ConfiguracaoOperacional" WHERE id='escola' FOR SHARE;
  IF fuso IS NULL OR btrim(fuso)='' THEN RAISE EXCEPTION 'Snapshot exige fuso institucional configurado'; END IF;
  hoje := (CURRENT_TIMESTAMP AT TIME ZONE fuso)::date;
  SELECT * INTO anterior FROM "BeneficioReposicaoParticularMatricula" WHERE "matriculaId"=NEW."matriculaId" ORDER BY "vigenteAPartirDe" DESC LIMIT 1 FOR UPDATE;
  IF anterior.id IS NULL THEN
    calculo := NEW;
    -- A primeira entrada deve usar a fronteira da regra, não a data enviada
    -- em NEW. O clamp só existe para snapshots já aprovados em transição.
    calculo."vigenteAPartirDe" := date '0001-01-01';
    SELECT inicio INTO esperado FROM periodo_beneficio_reposicao(hoje,calculo);
  ELSE
    base := GREATEST(hoje,anterior."vigenteAPartirDe");
    SELECT fim INTO esperado FROM periodo_beneficio_reposicao(base,anterior);
  END IF;
  IF NEW."vigenteAPartirDe" IS DISTINCT FROM esperado THEN RAISE EXCEPTION 'Vigência do snapshot deve iniciar no fim do período anterior permitido'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_vigencia_beneficio_reposicao BEFORE INSERT ON "BeneficioReposicaoParticularMatricula" FOR EACH ROW EXECUTE FUNCTION validar_vigencia_beneficio_reposicao();

CREATE OR REPLACE FUNCTION preservar_beneficio_reposicao_particular() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Snapshot de benefício de reposição é histórico e não pode ser alterado ou apagado'; END $$;
CREATE TRIGGER preservar_beneficio_reposicao_particular BEFORE UPDATE OR DELETE ON "BeneficioReposicaoParticularMatricula" FOR EACH ROW EXECUTE FUNCTION preservar_beneficio_reposicao_particular();
