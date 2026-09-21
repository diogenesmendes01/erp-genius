-- M01 / MIGRACAO 187 — corretiva de consumidores SQL da vigência histórica.
-- NÃO ALTERA 185/186; mantém identidade, locks, autoria e exceções vigentes.

CREATE OR REPLACE FUNCTION "validar_caso_revisao_progressao"()
RETURNS TRIGGER AS $$
DECLARE
  solicitacao "SolicitacaoMudancaAcademica"%ROWTYPE;
  matricula_origem_pedido TEXT;
  aluno_origem_pedido TEXT;
  nivel_origem_pedido TEXT;
  matricula_fonte TEXT;
  aluno_fonte TEXT;
  nivel_fonte TEXT;
  alocacao_fonte TEXT;
  aprovada BOOLEAN;
  impactos JSONB;
  contexto JSONB;
  turma_fonte TEXT;
  inicio_aula TIMESTAMP(3);
  alocacoes INTEGER;
  alocacao_unica TEXT;
  aprovacao_aula TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Casos de revisão de progressão são imutáveis';
  END IF;

  SELECT * INTO solicitacao FROM "SolicitacaoMudancaAcademica"
    WHERE id = NEW."solicitacaoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação da revisão não encontrada'; END IF;

  SELECT origem."matriculaId", origem."alunoId", turma."nivelId"
    INTO matricula_origem_pedido, aluno_origem_pedido, nivel_origem_pedido
    FROM "AlocacaoTurma" origem
    JOIN "Turma" turma ON turma.id = origem."turmaId"
    WHERE origem.id = solicitacao."alocacaoOrigemId" FOR SHARE OF origem, turma;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alocação de origem da solicitação não encontrada'; END IF;

  -- Mantém literalmente a regra histórica de 196 para as duas fontes já
  -- existentes. Reposição tem escopo próprio logo abaixo e não pode herdar a
  -- inferência por cadeia de equivalências.
  IF NEW."decisaoCorrecaoConclusaoReposicaoId" IS NULL AND NEW."aprovacaoCorrecaoAulaId" IS NULL THEN
    IF solicitacao."matriculaId" IS NULL THEN
      IF NEW."alocacaoFonteId" IS DISTINCT FROM solicitacao."alocacaoOrigemId" THEN
        RAISE EXCEPTION 'Solicitação legada só aceita correção da alocação de origem';
      END IF;
    ELSIF solicitacao."matriculaId" IS DISTINCT FROM NEW."matriculaId"
      OR matricula_origem_pedido IS DISTINCT FROM NEW."matriculaId" THEN
      RAISE EXCEPTION 'Solicitação e alocação de origem precisam pertencer à matrícula da revisão';
    END IF;
  END IF;

  IF NEW."decisaoCorrecaoNotaId" IS NOT NULL THEN
    SELECT d.aprovada, d.impactos, r."matriculaId", r."alocacaoId"
      INTO aprovada, impactos, matricula_fonte, alocacao_fonte
      FROM "DecisaoCorrecaoNota" d
      JOIN "PropostaCorrecaoNota" p ON p.id = d."propostaId"
      JOIN "VersaoLancamentoAvaliacao" v ON v.id = p."lancamentoId"
      JOIN "RegistroAvaliacaoMatricula" r ON r.id = v."registroId"
      WHERE d.id = NEW."decisaoCorrecaoNotaId" FOR SHARE OF d, p, v, r;
    IF NOT FOUND THEN RAISE EXCEPTION 'Decisão de correção regular não encontrada'; END IF;
    IF jsonb_typeof(impactos) IS DISTINCT FROM 'array' OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(impactos) impacto
      WHERE impacto = NEW."snapshotImpacto" AND impacto ->> 'id' = NEW."solicitacaoId"
    ) THEN RAISE EXCEPTION 'O impacto regular conferido não corresponde à solicitação'; END IF;
  ELSIF NEW."decisaoCorrecaoRecuperacaoId" IS NOT NULL THEN
    SELECT d.aprovada, d.impactos, plano."matriculaId", plano."alocacaoId"
      INTO aprovada, impactos, matricula_fonte, alocacao_fonte
      FROM "DecisaoCorrecaoRecuperacao" d
      JOIN "PropostaCorrecaoRecuperacao" p ON p.id = d."propostaId"
      JOIN "NotaRecuperacao" n ON n.id = p."notaId"
      JOIN "RealizacaoRecuperacao" realizacao ON realizacao.id = n."realizacaoId"
      JOIN "ItemReservaTentativaRecuperacao" item ON item.id = realizacao."itemReservaId"
      JOIN "ReservaTentativaRecuperacao" reserva ON reserva.id = item."reservaId"
      JOIN "PropostaPlanoRecuperacao" plano ON plano.id = reserva."propostaId"
      WHERE d.id = NEW."decisaoCorrecaoRecuperacaoId"
      FOR SHARE OF d, p, n, realizacao, item, reserva, plano;
    IF NOT FOUND THEN RAISE EXCEPTION 'Decisão de correção de recuperação não encontrada'; END IF;
    IF jsonb_typeof(impactos) IS DISTINCT FROM 'object'
      OR jsonb_typeof(impactos -> 'mudancas') IS DISTINCT FROM 'array'
      OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(impactos -> 'mudancas') impacto
        WHERE impacto = NEW."snapshotImpacto" AND impacto ->> 'id' = NEW."solicitacaoId"
      ) THEN RAISE EXCEPTION 'O impacto de recuperação conferido não corresponde à solicitação'; END IF;
  ELSIF NEW."aprovacaoCorrecaoAulaId" IS NOT NULL THEN
    SELECT aprovacao.impactos, encontro.inicio, encontro."turmaId", turma."nivelId", matricula."alunoId"
      INTO impactos, inicio_aula, turma_fonte, nivel_fonte, aluno_fonte
      FROM "AprovacaoCorrecaoAula" aprovacao
      JOIN "PropostaCorrecaoAula" proposta ON proposta.id=aprovacao."propostaId"
      JOIN "EncontroAgenda" encontro ON encontro.id=proposta."encontroId"
      JOIN "Turma" turma ON turma.id=encontro."turmaId"
      JOIN "Matricula" matricula ON matricula.id=NEW."matriculaId"
      WHERE aprovacao.id=NEW."aprovacaoCorrecaoAulaId"
      FOR SHARE OF aprovacao, proposta, encontro, turma, matricula;
    IF NOT FOUND THEN RAISE EXCEPTION 'Aprovação de correção de aula não encontrada'; END IF;
    IF jsonb_typeof(impactos) IS DISTINCT FROM 'object'
      OR jsonb_typeof(impactos->'progressao') IS DISTINCT FROM 'array'
      OR jsonb_typeof(impactos->'comparacao'->'registros') IS DISTINCT FROM 'array'
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(impactos->'progressao') fonte
        WHERE fonte->>'matriculaId'=NEW."matriculaId" AND fonte->>'nivelId'=nivel_fonte
          AND fonte->>'alocacaoFonteId'=NEW."alocacaoFonteId" AND jsonb_typeof(fonte->'impactos')='array'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(fonte->'impactos') impacto WHERE impacto=NEW."snapshotImpacto" AND impacto->>'id'=NEW."solicitacaoId"))
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(impactos->'comparacao'->'registros') registro
        WHERE registro->>'matriculaId'=NEW."matriculaId" AND (registro->>'participacaoAlterada')='true')
      OR NOT EXISTS (
        SELECT 1 FROM "SolicitacaoMudancaAcademica" atual
        WHERE atual.id=NEW."solicitacaoId"
          AND atual.status::text=NEW."snapshotImpacto"->>'status'
          AND atual.status IN ('APROVADA'::"StatusMudancaAcademica", 'EXECUTADA'::"StatusMudancaAcademica")
          AND atual."turmaDestinoId"=NEW."snapshotImpacto"->>'turmaDestinoId'
          AND (
            (atual."decididoEm" IS NULL AND jsonb_typeof(NEW."snapshotImpacto"->'decididoEm')='null')
            OR NEW."snapshotImpacto"->>'decididoEm'=to_char(atual."decididoEm",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          )
          AND (
            (atual."executadoEm" IS NULL AND jsonb_typeof(NEW."snapshotImpacto"->'executadoEm')='null')
            OR NEW."snapshotImpacto"->>'executadoEm'=to_char(atual."executadoEm",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          )
      ) THEN
      RAISE EXCEPTION 'Caso Q23 exige impacto de frequência e participação efetivamente alterada'; END IF;
    SELECT count(*), min(alocacao.id) INTO alocacoes, alocacao_unica FROM "AlocacaoTurma" alocacao
      WHERE alocacao."matriculaId"=NEW."matriculaId" AND alocacao."alunoId"=aluno_fonte
        AND alocacao."turmaId"=turma_fonte AND alocacao_cobre_instante(alocacao, inicio_aula AT TIME ZONE 'UTC');
    IF alocacoes IS DISTINCT FROM 1 OR alocacao_unica IS DISTINCT FROM NEW."alocacaoFonteId"
      OR solicitacao."matriculaId" IS NULL OR solicitacao."matriculaId" IS DISTINCT FROM NEW."matriculaId"
      OR matricula_origem_pedido IS DISTINCT FROM NEW."matriculaId"
      OR aluno_origem_pedido IS DISTINCT FROM aluno_fonte OR nivel_origem_pedido IS DISTINCT FROM nivel_fonte THEN
      RAISE EXCEPTION 'Caso Q23 não corresponde à matrícula, vínculo, aluno ou nível afetado'; END IF;
    aprovada:=TRUE; matricula_fonte:=NEW."matriculaId"; alocacao_fonte:=NEW."alocacaoFonteId";
  ELSE
    SELECT decisao.aprovada, decisao."contextoAcademico", reposicao."matriculaId",
      matricula."alunoId", turma."nivelId", aula."turmaId", aula.inicio
      INTO aprovada, contexto, matricula_fonte, aluno_fonte, nivel_fonte, turma_fonte, inicio_aula
      FROM "DecisaoCorrecaoConclusaoReposicao" decisao
      JOIN "CorrecaoConclusaoReposicaoIndividual" correcao ON correcao.id = decisao."correcaoId"
      JOIN "ConclusaoReposicaoIndividual" conclusao ON conclusao.id = correcao."conclusaoId"
      JOIN "ReposicaoIndividual" reposicao ON reposicao.id = conclusao."reposicaoId"
      JOIN "Matricula" matricula ON matricula.id = reposicao."matriculaId"
      JOIN "EncontroAgenda" aula ON aula.id = reposicao."aulaOriginalId"
      JOIN "Turma" turma ON turma.id = aula."turmaId"
      WHERE decisao.id = NEW."decisaoCorrecaoConclusaoReposicaoId"
      FOR SHARE OF decisao, correcao, conclusao, reposicao, matricula, aula, turma;
    IF NOT FOUND THEN RAISE EXCEPTION 'Decisão de correção de reposição não encontrada'; END IF;
    IF jsonb_typeof(contexto) IS DISTINCT FROM 'object'
      OR jsonb_typeof(contexto -> 'impactos') IS DISTINCT FROM 'array'
      OR contexto ->> 'matriculaId' IS DISTINCT FROM matricula_fonte
      OR contexto ->> 'nivelId' IS DISTINCT FROM nivel_fonte
      OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(contexto -> 'impactos') impacto
        WHERE impacto = NEW."snapshotImpacto" AND impacto ->> 'id' = NEW."solicitacaoId"
      ) THEN RAISE EXCEPTION 'O impacto de reposição conferido não corresponde à solicitação'; END IF;
    SELECT count(*), min(alocacao.id) INTO alocacoes, alocacao_unica
      FROM "AlocacaoTurma" alocacao
      WHERE alocacao."matriculaId" = matricula_fonte
        AND alocacao."alunoId" = aluno_fonte
        AND alocacao."turmaId" = turma_fonte
        AND alocacao_cobre_instante(alocacao, inicio_aula AT TIME ZONE 'UTC');
    IF alocacoes IS DISTINCT FROM 1
      OR contexto ->> 'alocacaoFonteId' IS DISTINCT FROM alocacao_unica
      OR NOT EXISTS (
        SELECT 1 FROM "AlocacaoTurma" alocacao
        WHERE alocacao.id = alocacao_unica
          AND alocacao_cobre_instante(alocacao, inicio_aula AT TIME ZONE 'UTC')
      ) THEN
      RAISE EXCEPTION 'Contexto da reposição não possui alocação fonte única';
    END IF;
    alocacao_fonte := alocacao_unica;
    IF solicitacao."matriculaId" IS NULL
      OR solicitacao."matriculaId" IS DISTINCT FROM matricula_fonte
      OR matricula_origem_pedido IS DISTINCT FROM matricula_fonte
      OR aluno_origem_pedido IS DISTINCT FROM aluno_fonte
      OR nivel_origem_pedido IS DISTINCT FROM nivel_fonte THEN
      RAISE EXCEPTION 'A solicitação deve pertencer à mesma matrícula, aluno e nível da reposição';
    END IF;
  END IF;

  IF NOT aprovada THEN RAISE EXCEPTION 'Caso de revisão exige decisão de correção aprovada'; END IF;
  IF matricula_fonte IS DISTINCT FROM NEW."matriculaId"
    OR alocacao_fonte IS DISTINCT FROM NEW."alocacaoFonteId" THEN
    RAISE EXCEPTION 'A fonte da correção não corresponde à matrícula ou alocação informada';
  END IF;
  PERFORM 1 FROM "AlocacaoTurma"
    WHERE id = NEW."alocacaoFonteId" AND "matriculaId" = NEW."matriculaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alocação fonte não pertence à matrícula da revisão'; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION preservar_lancamento_avaliacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "RegistroAvaliacaoMatricula"%ROWTYPE; v "VersaoLancamentoAvaliacao"%ROWTYPE; a "AlocacaoTurma"%ROWTYPE; segunda_autorizada BOOLEAN; autoria_segunda BOOLEAN;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Registro, lançamento e decisão de avaliação são imutáveis'; END IF;
 IF TG_TABLE_NAME = 'RegistroAvaliacaoMatricula' THEN
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id=NEW."alocacaoId";
  IF a."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR a."turmaId"<>NEW."turmaId" THEN RAISE EXCEPTION 'Avaliação exige alocação da matrícula e turma corretas'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Turma" WHERE id=NEW."turmaId" AND "regraAvaliacaoId"=NEW."regraId") THEN RAISE EXCEPTION 'Avaliação exige regra vinculada à turma'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "VersaoRegraAvaliacao" regra,jsonb_array_elements(regra.conteudo->'avaliacoes') av WHERE regra.id=NEW."regraId" AND av->>'codigo'=NEW."codigoAvaliacao") THEN RAISE EXCEPTION 'Código de avaliação fora da regra'; END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='VersaoLancamentoAvaliacao' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT * INTO r FROM "RegistroAvaliacaoMatricula" WHERE id=NEW."registroId"; PERFORM id FROM "RegistroAvaliacaoMatricula" WHERE id=r.id FOR UPDATE;
  IF NEW.versao<>(SELECT COALESCE(MAX(versao),0)+1 FROM "VersaoLancamentoAvaliacao" WHERE "registroId"=r.id) THEN RAISE EXCEPTION 'Versão do lançamento desatualizada'; END IF;
  IF EXISTS(SELECT 1 FROM "VersaoLancamentoAvaliacao" l JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId"=l.id AND d.aprovada WHERE l."registroId"=r.id) THEN RAISE EXCEPTION 'Nota oficial exige correção independente'; END IF;
  PERFORM id FROM "Usuario" WHERE id=NEW."autorId" AND ativo AND 'PROFESSOR'::"Papel"=ANY(papeis) FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento exige professor ativo'; END IF;
  autoria_segunda:=NEW."segundaChamadaRealizacaoId" IS NOT NULL AND autoria_segunda_chamada_valida(r.id,NEW."segundaChamadaRealizacaoId",NEW."autorId",NEW."realizadaPorId",NEW."realizadaEm",NEW."motivoRegularizacao",NEW."evidenciasRegularizacao");
  IF autoria_segunda IS DISTINCT FROM true THEN PERFORM conferir_autoria_lancamento(r.id,NEW."autorId",COALESCE(NEW."realizadaPorId",NEW."autorId"),NEW."realizadaEm",NEW."motivoRegularizacao",NEW."evidenciasRegularizacao"); END IF;
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id=r."alocacaoId"; segunda_autorizada:=nota_segunda_chamada_autorizada(r.id,NEW."segundaChamadaRealizacaoId",NEW."realizadaEm",NEW."realizadaPorId");
  IF NEW."realizadaEm">(clock_timestamp() AT TIME ZONE 'UTC')
     OR NOT (CASE WHEN a."provenienciaVinculo"='MIGRACAO'::"ProvenienciaVinculoMatricula" THEN a."inicioVigencia" IS NOT NULL AND a."inicioVigencia"<=NEW."realizadaEm" AT TIME ZONE 'UTC' ELSE a."provenienciaVinculo" IS NULL AND a."criadoEm"<=NEW."realizadaEm" END)
     OR (NOT alocacao_cobre_instante(a, NEW."realizadaEm" AT TIME ZONE 'UTC') AND NOT segunda_autorizada) THEN RAISE EXCEPTION 'Data fora do vínculo histórico da avaliação'; END IF;
  IF NEW.submetida AND EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.notas) n WHERE n->'nota'='null'::jsonb) THEN RAISE EXCEPTION 'Submissão exige notas preenchidas'; END IF;
 ELSE
  SELECT * INTO v FROM "VersaoLancamentoAvaliacao" WHERE id=NEW."lancamentoId"; PERFORM id FROM "RegistroAvaliacaoMatricula" WHERE id=v."registroId" FOR UPDATE;
  IF v."autorId"=NEW."decisorId" OR v."realizadaPorId"=NEW."decisorId" THEN RAISE EXCEPTION 'Oficialização exige outra pessoa'; END IF;
  PERFORM id FROM "Usuario" WHERE id=NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Oficialização exige gestão ativa'; END IF;
  IF NOT v.submetida THEN RAISE EXCEPTION 'Rascunho não pode receber decisão'; END IF;
  IF NEW.aprovada THEN IF v.versao<>(SELECT MAX(versao) FROM "VersaoLancamentoAvaliacao" WHERE "registroId"=v."registroId") THEN RAISE EXCEPTION 'Existe lançamento mais recente'; END IF; IF EXISTS(SELECT 1 FROM "VersaoLancamentoAvaliacao" l JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId"=l.id AND d.aprovada WHERE l."registroId"=v."registroId") THEN RAISE EXCEPTION 'Já existe resultado oficial'; END IF; END IF;
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION preservar_realizacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  p "PropostaPlanoRecuperacao"%ROWTYPE;
  reserva "ReservaTentativaRecuperacao"%ROWTYPE;
  disp "DisponibilizacaoPlanoRecuperacao"%ROWTYPE;
  a "AlocacaoTurma"%ROWTYPE;
  autorizacao "AutorizacaoEspecialRecuperacao"%ROWTYPE;
  registrador TEXT;
  historico TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Realização de recuperação é imutável'; END IF;
  SELECT r.* INTO reserva FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId" WHERE i.id = NEW."itemReservaId";
  SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id = reserva."propostaId";
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" WHERE "reservaId" = reserva.id) THEN RAISE EXCEPTION 'Tentativa cancelada'; END IF;
  SELECT * INTO disp FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId" = p.id;
  IF disp.id IS NULL OR NEW."realizadaEm" < reserva."criadaEm" OR NEW."realizadaEm" < disp."disponibilizadaEm" OR NEW."realizadaEm" >= prazo_recuperacao_na_data(disp.id, NEW."realizadaEm") OR NEW."realizadaEm" > (clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Realização fora do período autorizado'; END IF;

  IF NEW."autorizacaoEspecialId" IS NOT NULL THEN
    SELECT * INTO autorizacao FROM "AutorizacaoEspecialRecuperacao" WHERE id = NEW."autorizacaoEspecialId" FOR SHARE;
    IF NOT FOUND
       OR autorizacao."itemReservaId" IS DISTINCT FROM NEW."itemReservaId"
       OR autorizacao."criadaEm" > NEW."realizadaEm"
       OR NEW."realizadaEm" > autorizacao."prazoAte" THEN
      RAISE EXCEPTION 'Autorização especial não é válida para esta realização';
    END IF;
    PERFORM id FROM "Usuario"
      WHERE id = autorizacao."autorizadorId" AND ativo
        AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]
      FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Autorizador especial precisa permanecer gestor ativo'; END IF;
    IF jsonb_typeof(autorizacao.snapshot) IS DISTINCT FROM 'object'
       OR autorizacao.snapshot->>'matriculaId' IS DISTINCT FROM p."matriculaId"
       OR autorizacao.snapshot->>'alocacaoId' IS DISTINCT FROM p."alocacaoId"
       OR autorizacao.snapshot->>'regraId' IS DISTINCT FROM p."regraId"
       OR autorizacao.snapshot->>'propostaId' IS DISTINCT FROM p.id
       OR autorizacao.snapshot->>'propostaHash' IS DISTINCT FROM p."entradaHash"
       OR autorizacao.snapshot->>'decisaoId' IS DISTINCT FROM (
         SELECT id FROM "DecisaoPlanoRecuperacao" WHERE "propostaId" = p.id AND aprovada
       )
       OR autorizacao.snapshot->>'disponibilizacaoId' IS DISTINCT FROM disp.id
       OR autorizacao.snapshot->>'reservaId' IS DISTINCT FROM reserva.id
       OR autorizacao.snapshot->>'itemReservaId' IS DISTINCT FROM NEW."itemReservaId"
       OR autorizacao.snapshot->>'habilidade' IS DISTINCT FROM (
         SELECT habilidade FROM "ItemReservaTentativaRecuperacao" WHERE id = NEW."itemReservaId"
       ) THEN
      RAISE EXCEPTION 'Snapshot da autorização especial não corresponde à fonte atual';
    END IF;
  END IF;

  registrador := COALESCE(NEW."registradaPorId", NEW."professorId");
  PERFORM id FROM "Usuario" WHERE id = registrador AND ativo AND 'PROFESSOR'::"Papel" = ANY(papeis) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Realização exige professor ativo'; END IF;
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id = p."alocacaoId";
  IF NOT (CASE WHEN a."provenienciaVinculo"='MIGRACAO'::"ProvenienciaVinculoMatricula" THEN a."inicioVigencia" IS NOT NULL AND a."inicioVigencia"<=NEW."realizadaEm" AT TIME ZONE 'UTC' ELSE a."provenienciaVinculo" IS NULL AND a."criadoEm"<=NEW."realizadaEm" END)
     OR a."matriculaId" IS DISTINCT FROM p."matriculaId" THEN RAISE EXCEPTION 'Vínculo de origem inválido'; END IF;
  IF NOT alocacao_cobre_instante(a, NEW."realizadaEm" AT TIME ZONE 'UTC') THEN
    IF NEW."autorizacaoEspecialId" IS NULL THEN RAISE EXCEPTION 'Realização fora do vínculo do aluno'; END IF;
  END IF;
  IF registrador <> NEW."professorId" THEN
    IF NOT recuperacao_designada(NEW."itemReservaId", registrador) OR COALESCE(length(btrim(NEW."motivoRegularizacao")),0) < 5 OR length(NEW."motivoRegularizacao") > 2000 THEN RAISE EXCEPTION 'Regularização exige designação específica e motivo'; END IF;
  ELSE
    IF NEW."motivoRegularizacao" IS NOT NULL THEN RAISE EXCEPTION 'Motivo de regularização exige outro realizador'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "Turma" t JOIN "VinculoDocente" v ON v."turmaId" = t.id WHERE t.id = a."turmaId" AND t."professorId" = registrador AND t.status <> 'CONCLUIDA' AND v."professorId" = registrador AND v.fim IS NULL AND v.inicio <= (clock_timestamp() AT TIME ZONE 'UTC')) AND NOT recuperacao_designada(NEW."itemReservaId", registrador) THEN RAISE EXCEPTION 'Registrador sem atribuição vigente'; END IF;
  END IF;
  SELECT "professorId" INTO historico FROM "DesignacaoRecuperacao" WHERE "itemReservaId" = NEW."itemReservaId" AND "criadaEm" <= NEW."realizadaEm" ORDER BY versao DESC LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM "VinculoDocente" WHERE "turmaId" = a."turmaId" AND "professorId" = NEW."professorId" AND inicio <= NEW."realizadaEm" AND (fim IS NULL OR NEW."realizadaEm" < fim)) AND historico IS DISTINCT FROM NEW."professorId" THEN RAISE EXCEPTION 'Realizador sem vínculo histórico'; END IF;
  IF COALESCE(length(btrim(NEW.evidencia)),0) < 5 OR length(NEW.evidencia) > 4000 THEN RAISE EXCEPTION 'Registre evidência da realização'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION aplicar_agenda_inicial_segunda() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAgendaSegundaChamada"%ROWTYPE; f "PropostaSegundaChamada"%ROWTYPE; disp "DisponibilizacaoSegundaChamada"%ROWTYPE; prazo TIMESTAMP; encontro TEXT; reserva TEXT; agenda TEXT; agora TIMESTAMP; antecedencia INTEGER;
BEGIN
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO p FROM "PropostaAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 SELECT * INTO f FROM "PropostaSegundaChamada" WHERE id=p."propostaSegundaChamadaId" FOR UPDATE;
 SELECT * INTO disp FROM "DisponibilizacaoSegundaChamada" WHERE "propostaId"=f.id FOR KEY SHARE;
 SELECT COALESCE((SELECT pr."novoPrazo" FROM "PropostaProrrogacaoSegundaChamada" pr JOIN "DecisaoProrrogacaoSegundaChamada" d ON d."propostaId"=pr.id AND d.aprovada WHERE pr."disponibilizacaoId"=disp.id ORDER BY pr.versao DESC LIMIT 1),disp."prazoAte") INTO prazo;
 agora:=clock_timestamp() AT TIME ZONE 'UTC';
 IF NOT EXISTS(SELECT 1 FROM "DecisaoSegundaChamada" WHERE "propostaId"=f.id AND aprovada) OR disp.id IS NULL OR p.inicio<=agora OR p.fim>prazo OR NOT professor_segunda_chamada_cobre_intervalo(f.id,p."professorId",p.inicio,p.fim) THEN RAISE EXCEPTION 'Fontes, prazo ou docente mudaram antes da aplicação'; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId"
   WHERE a.id=f."alocacaoId" AND a."matriculaId"=f."matriculaId" AND a."turmaId"=f."turmaId" AND t."regraAvaliacaoId"=f."regraId"
 ) THEN RAISE EXCEPTION 'Vínculo, turma ou regra da segunda chamada mudou'; END IF;
 IF EXISTS(
   SELECT 1 FROM "RegistroAvaliacaoMatricula" r
   JOIN "VersaoLancamentoAvaliacao" l ON l."registroId"=r.id
   JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId"=l.id AND d.aprovada
   WHERE r."matriculaId"=f."matriculaId" AND r."alocacaoId"=f."alocacaoId" AND r."turmaId"=f."turmaId" AND r."regraId"=f."regraId" AND r."codigoAvaliacao"=f."codigoAvaliacao"
 ) THEN RAISE EXCEPTION 'Avaliação já possui nota oficial'; END IF;
 IF NOT situacao_autorizacao_segunda_chamada_cobre_intervalo(f."matriculaId",f."alocacaoId",f."codigoAvaliacao",p.inicio,p.fim) THEN
   RAISE EXCEPTION 'Situação contratual não permite todo o intervalo da agenda inicial';
 END IF;
 IF (situacao_matricula_no_instante(f."matriculaId",p.inicio) IN ('PAUSADA','ENCERRADA')
       AND NOT autorizacao_especial_segunda_chamada_valida(f."alocacaoId",f."codigoAvaliacao",p.inicio))
    OR (situacao_matricula_no_instante(f."matriculaId",p.fim-interval '1 millisecond') IN ('PAUSADA','ENCERRADA')
       AND NOT autorizacao_especial_segunda_chamada_valida(f."alocacaoId",f."codigoAvaliacao",p.fim-interval '1 millisecond')) THEN
   RAISE EXCEPTION 'Intervalo em matrícula pausada ou encerrada exige autorização especial vigente';
 END IF; IF jsonb_typeof(p.snapshot) <> 'object'
   OR p.snapshot->>'propostaSegundaChamadaId' IS DISTINCT FROM f.id
   OR p.snapshot->>'matriculaId' IS DISTINCT FROM f."matriculaId"
   OR p.snapshot->>'alocacaoId' IS DISTINCT FROM f."alocacaoId"
   OR p.snapshot->>'turmaId' IS DISTINCT FROM f."turmaId"
   OR p.snapshot->>'regraId' IS DISTINCT FROM f."regraId"
   OR p.snapshot->>'codigoAvaliacao' IS DISTINCT FROM f."codigoAvaliacao"
   OR p.snapshot->>'professorId' IS DISTINCT FROM p."professorId"
   OR p.snapshot->>'prazoAte' IS DISTINCT FROM to_char(prazo,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   OR p.snapshot->>'inicio' IS DISTINCT FROM to_char(p.inicio,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   OR p.snapshot->>'fim' IS DISTINCT FROM to_char(p.fim,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   OR p.snapshot->>'fusoOrigem' IS DISTINCT FROM p."fusoOrigem"
   OR p.snapshot->'calendario' IS DISTINCT FROM jsonb_build_object('calendarioId',p."calendarioId",'calendarioVersao',p."calendarioVersao",'fusoInstitucional',p."fusoInstitucional",'periodosNaoLetivos',p."periodosNaoLetivos")
   OR p.snapshot->'conflitos' IS DISTINCT FROM jsonb_build_object('encontros','[]'::jsonb,'indisponibilidades',0,'reservas',0) THEN
  RAISE EXCEPTION 'Snapshot da agenda inicial não confere com a fonte atual';
END IF;
IF EXISTS(SELECT 1 FROM "ReservaSegundaChamada" WHERE "propostaId"=f.id AND status='RESERVADA') THEN RAISE EXCEPTION 'A proposta já possui reserva vigente'; END IF;
 IF EXISTS (
   SELECT 1 FROM "EncontroAgenda" e
   LEFT JOIN "Matricula" m ON m.id=e."matriculaId"
   WHERE e.status IN ('PREVISTO','MINISTRADO') AND e.inicio<p.fim AND e.fim>p.inicio
     AND (
       e."professorId"=p."professorId"
       OR m."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=f."matriculaId")
       OR (e."matriculaId" IS NULL AND EXISTS (
         SELECT 1 FROM "AlocacaoTurma" a
         WHERE a."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=f."matriculaId")
           AND a."turmaId"=e."turmaId" AND alocacao_cobre_instante(a, GREATEST(p.inicio,e.inicio) AT TIME ZONE 'UTC')
       ))
     )
 ) THEN RAISE EXCEPTION 'Conflito de agenda antes da aplicação'; END IF;
 IF EXISTS(SELECT 1 FROM "IndisponibilidadeDocente" i JOIN "DecisaoIndisponibilidadeDocente" d ON d."indisponibilidadeId"=i.id AND d.aprovada WHERE i."professorId"=p."professorId" AND i.inicio<p.fim AND i.fim>p.inicio) OR EXISTS(SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" rh ON rh.id=h."reservaId" JOIN "Matricula" rm ON rm.id=rh."matriculaId" WHERE rh.status IN ('ATIVA','MANTIDA_PENDENCIA') AND h.inicio<p.fim AND h.fim>p.inicio AND (h."professorId"=p."professorId" OR rm."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=f."matriculaId"))) THEN RAISE EXCEPTION 'Indisponibilidade ou reserva comercial conflitante'; END IF;
 encontro:='agenda-inicial-segunda:'||NEW.id; reserva:='reserva-agenda-inicial-segunda:'||NEW.id; agenda:='agenda-inicial-segunda:'||NEW.id;
 SELECT (r.conteudo->'segundaChamada'->>'antecedenciaCancelamentoMinutos')::integer INTO antecedencia FROM "VersaoRegraAvaliacao" r WHERE r.id=f."regraId";
 INSERT INTO "EncontroAgenda"(id,"turmaId","matriculaId","professorId","preparadorId",inicio,fim,"fusoOrigem",finalidade,status,motivo,"chaveIdempotencia","entradaHash","propostaAgendaSegundaChamadaId") VALUES(encontro,f."turmaId",f."matriculaId",p."professorId",p."autorId",p.inicio,p.fim,p."fusoOrigem",'SEGUNDA_CHAMADA','PREVISTO',p.motivo,'agenda-inicial:'||NEW.id,p."entradaHash",p.id);
 INSERT INTO "ReservaSegundaChamada"(id,"propostaId","matriculaId","regraId","codigoAvaliacao","reservadaPorId","reservadaEm",status,"regraCancelamentoMinutos") VALUES(reserva,f.id,f."matriculaId",f."regraId",f."codigoAvaliacao",NEW."decisorId",agora,'RESERVADA',antecedencia);
 INSERT INTO "AgendaSegundaChamada"(id,"reservaId","encontroId","agendadaPorId") VALUES(agenda,reserva,encontro,NEW."decisorId");
 UPDATE "DecisaoAgendaSegundaChamada" SET "encontroId"=encontro WHERE id=NEW.id;
 INSERT INTO "AplicacaoAgendaSegundaChamada"(id,"decisaoId","encontroId","reservaId","agendaId","aplicadaEm") VALUES('aplicacao-agenda-inicial-segunda:'||NEW.id,NEW.id,encontro,reserva,agenda,agora);
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION aplicar_substituicao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaSubstituicaoAgendaSegundaChamada"%ROWTYPE; r "ReservaSegundaChamada"%ROWTYPE; e "EncontroAgenda"%ROWTYPE; fonte "PropostaSegundaChamada"%ROWTYPE; estado JSONB; agora TIMESTAMP; prazo TIMESTAMP; designacao TEXT; situacao_inicio TEXT; situacao_fim TEXT;
BEGIN
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 SELECT p0."reservaId" INTO r.id FROM "PropostaSubstituicaoAgendaSegundaChamada" p0 WHERE p0.id=NEW."propostaId";
 SELECT * INTO r FROM "ReservaSegundaChamada" WHERE id=r.id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Substituição exige reserva existente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO p FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 SELECT * INTO e FROM "EncontroAgenda" WHERE id=p."encontroId" FOR UPDATE;
 SELECT * INTO fonte FROM "PropostaSegundaChamada" WHERE id=r."propostaId" FOR UPDATE;
 agora:=clock_timestamp() AT TIME ZONE 'UTC';
 PERFORM id FROM "Usuario" WHERE id=p."substitutoId" AND ativo AND 'PROFESSOR'=ANY(papeis) FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Substituto precisa permanecer professor ativo'; END IF;
 estado:=estado_substituicao_agenda_segunda_chamada(r.id,p."substitutoId");
 IF p.snapshot IS DISTINCT FROM estado OR r.status<>'RESERVADA' OR e.finalidade<>'SEGUNDA_CHAMADA' OR e.status<>'PREVISTO' OR e.inicio<=agora OR e."professorId" IS NULL THEN RAISE EXCEPTION 'Agenda mudou antes da substituição aprovada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId" WHERE a.id=fonte."alocacaoId" AND a."matriculaId"=fonte."matriculaId" AND a."turmaId"=fonte."turmaId" AND t."regraAvaliacaoId"=fonte."regraId") THEN RAISE EXCEPTION 'Vínculo, turma ou regra da substituição mudou'; END IF;
 IF NOT situacao_autorizacao_segunda_chamada_cobre_intervalo(fonte."matriculaId",fonte."alocacaoId",fonte."codigoAvaliacao",e.inicio,e.fim) THEN
   RAISE EXCEPTION 'Situação contratual da substituição não permite todo o encontro';
 END IF;
 SELECT situacao_matricula_no_instante(fonte."matriculaId",e.inicio),situacao_matricula_no_instante(fonte."matriculaId",e.fim-interval '1 millisecond') INTO situacao_inicio,situacao_fim;
 IF NOT COALESCE(
   ((situacao_inicio='ATIVA' AND (SELECT ativa FROM "AlocacaoTurma" WHERE id=fonte."alocacaoId") IS TRUE) OR (situacao_inicio IN ('PAUSADA','ENCERRADA') AND autorizacao_especial_segunda_chamada_valida(fonte."alocacaoId",fonte."codigoAvaliacao",e.inicio)))
   AND ((situacao_fim='ATIVA' AND (SELECT ativa FROM "AlocacaoTurma" WHERE id=fonte."alocacaoId") IS TRUE) OR (situacao_fim IN ('PAUSADA','ENCERRADA') AND autorizacao_especial_segunda_chamada_valida(fonte."alocacaoId",fonte."codigoAvaliacao",e.fim-interval '1 millisecond'))),false) THEN
   RAISE EXCEPTION 'Situação contratual da substituição não permite o encontro';
 END IF;
 SELECT COALESCE((SELECT pr."novoPrazo" FROM "PropostaProrrogacaoSegundaChamada" pr JOIN "DecisaoProrrogacaoSegundaChamada" d ON d."propostaId"=pr.id AND d.aprovada WHERE pr."disponibilizacaoId"=disp.id ORDER BY pr.versao DESC LIMIT 1),disp."prazoAte") INTO prazo FROM "DisponibilizacaoSegundaChamada" disp WHERE disp."propostaId"=fonte.id;
 IF prazo IS NULL OR e.fim>prazo OR EXISTS(SELECT 1 FROM "RegistroAvaliacaoMatricula" rr JOIN "VersaoLancamentoAvaliacao" l ON l."registroId"=rr.id JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId"=l.id AND d.aprovada WHERE rr."matriculaId"=fonte."matriculaId" AND rr."alocacaoId"=fonte."alocacaoId" AND rr."turmaId"=fonte."turmaId" AND rr."regraId"=fonte."regraId" AND rr."codigoAvaliacao"=fonte."codigoAvaliacao") THEN RAISE EXCEPTION 'Prazo ou avaliação da substituição mudou'; END IF;
 IF (situacao_matricula_no_instante(fonte."matriculaId",e.inicio) IN ('PAUSADA','ENCERRADA') AND NOT autorizacao_especial_segunda_chamada_valida(fonte."alocacaoId",fonte."codigoAvaliacao",e.inicio)) OR (situacao_matricula_no_instante(fonte."matriculaId",e.fim-interval '1 millisecond') IN ('PAUSADA','ENCERRADA') AND NOT autorizacao_especial_segunda_chamada_valida(fonte."alocacaoId",fonte."codigoAvaliacao",e.fim-interval '1 millisecond')) THEN RAISE EXCEPTION 'Substituição exige autorização especial vigente durante o encontro'; END IF;
 IF EXISTS(SELECT 1 FROM "EncontroAgenda" x LEFT JOIN "Matricula" m ON m.id=x."matriculaId" WHERE x.id<>e.id AND x.status IN ('PREVISTO','MINISTRADO') AND x.inicio<e.fim AND x.fim>e.inicio AND (x."professorId"=p."substitutoId" OR m."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=fonte."matriculaId") OR (x."matriculaId" IS NULL AND EXISTS(SELECT 1 FROM "AlocacaoTurma" a WHERE a."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=fonte."matriculaId") AND a."turmaId"=x."turmaId" AND alocacao_cobre_instante(a, GREATEST(e.inicio,x.inicio) AT TIME ZONE 'UTC'))))) THEN RAISE EXCEPTION 'Conflito de agenda antes da substituição'; END IF;
 IF EXISTS(SELECT 1 FROM "IndisponibilidadeDocente" i JOIN "DecisaoIndisponibilidadeDocente" d ON d."indisponibilidadeId"=i.id AND d.aprovada WHERE i."professorId"=p."substitutoId" AND i.inicio<e.fim AND i.fim>e.inicio) OR EXISTS(SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" rh ON rh.id=h."reservaId" JOIN "Matricula" rm ON rm.id=rh."matriculaId" WHERE rh.status IN ('ATIVA','MANTIDA_PENDENCIA') AND h.inicio<e.fim AND h.fim>e.inicio AND (h."professorId"=p."substitutoId" OR rm."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=fonte."matriculaId"))) THEN RAISE EXCEPTION 'Indisponibilidade ou reserva comercial conflitante'; END IF;
 designacao:='substituicao-segunda:'||NEW.id;
 INSERT INTO "DesignacaoSegundaChamada"(id,"propostaId","professorId","gestorId",versao,inicio,fim,motivo,"chaveIdempotencia","entradaHash","criadaEm") VALUES(designacao,fonte.id,p."substitutoId",NEW."decisorId",COALESCE((SELECT max(versao) FROM "DesignacaoSegundaChamada" WHERE "propostaId"=fonte.id),0)+1,agora,NULL,p.motivo,'substituicao-segunda:'||NEW.id,p."entradaHash",agora);
 INSERT INTO "AplicacaoSubstituicaoAgendaSegundaChamada"(id,"decisaoId","encontroId","professorAnteriorId","professorNovoId","designacaoId","aplicadaEm") VALUES('aplicacao-substituicao-segunda:'||NEW.id,NEW.id,e.id,e."professorId",p."substitutoId",designacao,agora);
 UPDATE "EncontroAgenda" SET "professorId"=p."substitutoId" WHERE id=e.id AND "professorId"=e."professorId"; IF NOT FOUND THEN RAISE EXCEPTION 'Professor do encontro mudou antes da substituição'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_item_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_aviso RECORD; v_h JSONB; v_ok BOOLEAN := false;
BEGIN
 SELECT aviso."matriculaId",evento.tipo,evento."agregadoTipo",evento."agregadoId",evento.payload,encontro."matriculaId" AS encontro_matricula,encontro."turmaId",encontro.inicio,encontro.fim INTO v_aviso FROM "AvisoAlteracaoAgenda" aviso JOIN "EncontroAgenda" encontro ON encontro.id=NEW."encontroId" JOIN "Evento" evento ON evento.id=aviso."eventoId" WHERE aviso.id=NEW."avisoId" AND aviso.situacao='PREPARADO';
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
