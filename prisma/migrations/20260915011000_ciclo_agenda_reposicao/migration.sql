-- CreateEnum
CREATE TYPE "ResultadoCancelamentoAgendaReposicao" AS ENUM ('DEVOLVE_BENEFICIO', 'CONSOME_BENEFICIO', 'ISENTA_SEM_SALDO');

-- DropIndex
DROP INDEX "EncontroAgenda_reposicaoIndividualId_key";

-- CreateTable
CREATE TABLE "PropostaCancelamentoAgendaReposicaoIndividual" (
    "id" TEXT NOT NULL,
    "agendaId" TEXT NOT NULL,
    "encontroId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidencia" TEXT NOT NULL,
    "solicitadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" JSONB NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,

    CONSTRAINT "PropostaCancelamentoAgendaReposicaoIndividual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoCancelamentoAgendaReposicaoIndividual" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "resultado" "ResultadoCancelamentoAgendaReposicao",
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoCancelamentoAgendaReposicaoIndividual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaRemarcacaoAgendaReposicaoIndividual" (
    "id" TEXT NOT NULL,
    "agendaId" TEXT NOT NULL,
    "encontroOriginalId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "fusoOrigem" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidencia" TEXT NOT NULL,
    "estado" JSONB NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,

    CONSTRAINT "PropostaRemarcacaoAgendaReposicaoIndividual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoRemarcacaoAgendaReposicaoIndividual" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "encontroNovoId" TEXT,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoRemarcacaoAgendaReposicaoIndividual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaCancelamentoAgendaReposicaoIndividual_agendaId_vers_key" ON "PropostaCancelamentoAgendaReposicaoIndividual"("agendaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaCancelamentoAgendaReposicaoIndividual_autorId_chave_key" ON "PropostaCancelamentoAgendaReposicaoIndividual"("autorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoCancelamentoAgendaReposicaoIndividual_propostaId_key" ON "DecisaoCancelamentoAgendaReposicaoIndividual"("propostaId");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaRemarcacaoAgendaReposicaoIndividual_agendaId_versao_key" ON "PropostaRemarcacaoAgendaReposicaoIndividual"("agendaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaRemarcacaoAgendaReposicaoIndividual_autorId_chaveId_key" ON "PropostaRemarcacaoAgendaReposicaoIndividual"("autorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoRemarcacaoAgendaReposicaoIndividual_propostaId_key" ON "DecisaoRemarcacaoAgendaReposicaoIndividual"("propostaId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoRemarcacaoAgendaReposicaoIndividual_encontroNovoId_key" ON "DecisaoRemarcacaoAgendaReposicaoIndividual"("encontroNovoId");

-- AddForeignKey
ALTER TABLE "PropostaCancelamentoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaCancelamentoAgendaReposicaoIndividual_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "AgendaReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaCancelamentoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaCancelamentoAgendaReposicaoIndividual_encontroId_fkey" FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaCancelamentoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaCancelamentoAgendaReposicaoIndividual_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoCancelamentoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoCancelamentoAgendaReposicaoIndividual_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaCancelamentoAgendaReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoCancelamentoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoCancelamentoAgendaReposicaoIndividual_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaRemarcacaoAgendaReposicaoIndividual_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "AgendaReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaRemarcacaoAgendaReposicaoIndividual_encontroOrigin_fkey" FOREIGN KEY ("encontroOriginalId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaRemarcacaoAgendaReposicaoIndividual_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaRemarcacaoAgendaReposicaoIndividual_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoRemarcacaoAgendaReposicaoIndividual_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaRemarcacaoAgendaReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoRemarcacaoAgendaReposicaoIndividual_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoRemarcacaoAgendaReposicaoIndividual_encontroNovoId_fkey" FOREIGN KEY ("encontroNovoId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;



ALTER TABLE "DecisaoCancelamentoAgendaReposicaoIndividual" ADD CONSTRAINT "cancelamento_reposicao_resultado" CHECK ((aprovada AND resultado IS NOT NULL) OR (NOT aprovada AND resultado IS NULL));
ALTER TABLE "DecisaoRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "remarcacao_reposicao_resultado" CHECK ((aprovada AND "encontroNovoId" IS NOT NULL) OR (NOT aprovada AND "encontroNovoId" IS NULL));
ALTER TABLE "PropostaRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "remarcacao_reposicao_intervalo" CHECK (fim>inicio);

CREATE OR REPLACE FUNCTION preservar_ciclo_agenda_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Proposta e decisão do ciclo de reposição são históricas'; END $$;
CREATE TRIGGER preservar_proposta_cancelamento_reposicao BEFORE UPDATE OR DELETE ON "PropostaCancelamentoAgendaReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION preservar_ciclo_agenda_reposicao();
CREATE TRIGGER preservar_decisao_cancelamento_reposicao BEFORE UPDATE OR DELETE ON "DecisaoCancelamentoAgendaReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION preservar_ciclo_agenda_reposicao();
CREATE TRIGGER preservar_proposta_remarcacao_reposicao BEFORE UPDATE OR DELETE ON "PropostaRemarcacaoAgendaReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION preservar_ciclo_agenda_reposicao();
CREATE TRIGGER preservar_decisao_remarcacao_reposicao BEFORE UPDATE OR DELETE ON "DecisaoRemarcacaoAgendaReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION preservar_ciclo_agenda_reposicao();

CREATE OR REPLACE FUNCTION validar_decisao_ciclo_agenda_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE autor TEXT; agenda TEXT; decisor "Usuario"%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='DecisaoCancelamentoAgendaReposicaoIndividual' THEN SELECT p."autorId",p."agendaId" INTO autor,agenda FROM "PropostaCancelamentoAgendaReposicaoIndividual" p WHERE p.id=NEW."propostaId" FOR SHARE;
  ELSE SELECT p."autorId",p."agendaId" INTO autor,agenda FROM "PropostaRemarcacaoAgendaReposicaoIndividual" p WHERE p.id=NEW."propostaId" FOR SHARE; END IF;
  SELECT * INTO decisor FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF autor IS NULL OR decisor.id IS NULL OR autor=NEW."decisorId" OR NOT decisor.ativo OR NOT ('GERENTE_PEDAGOGICO'=ANY(decisor.papeis) OR 'ADMINISTRADOR'=ANY(decisor.papeis)) THEN RAISE EXCEPTION 'Ciclo de agenda exige decisão independente de gestão ativa'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_decisao_cancelamento_reposicao BEFORE INSERT ON "DecisaoCancelamentoAgendaReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION validar_decisao_ciclo_agenda_reposicao();
CREATE TRIGGER validar_decisao_remarcacao_reposicao BEFORE INSERT ON "DecisaoRemarcacaoAgendaReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION validar_decisao_ciclo_agenda_reposicao();

-- Replaces the 177 guards without weakening them.  The only new paths are a
-- decided cancellation and a decided remarcacao whose old meeting is CANCELADO.
CREATE OR REPLACE FUNCTION validar_agenda_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r "ReposicaoIndividual"%ROWTYPE;
  e "EncontroAgenda"%ROWTYPE;
  b "BeneficioReposicaoParticularMatricula"%ROWTYPE;
  u "Usuario"%ROWTYPE;
  data_agendada DATE;
  inicio_esperado DATE;
  fim_esperado DATE;
  ocupadas INTEGER;
  periodo_nao_letivo BOOLEAN;
  autorizacao_excepcional BOOLEAN;
  resultado_cancelamento "ResultadoCancelamentoAgendaReposicao";
  aluno TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT * INTO r FROM "ReposicaoIndividual" WHERE id=NEW."reposicaoId" FOR SHARE;
  SELECT * INTO e FROM "EncontroAgenda" WHERE id=NEW."encontroId" FOR SHARE;
  SELECT * INTO b FROM "BeneficioReposicaoParticularMatricula" WHERE id=NEW."beneficioId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."reservadoPorId" FOR SHARE;

  IF r.id IS NULL OR e.id IS NULL OR u.id IS NULL
     OR r.modalidade <> 'PARTICULAR'
     OR e."reposicaoIndividualId" IS DISTINCT FROM r.id
     OR e.finalidade <> 'REPOSICAO'
     OR e."turmaId" IS NOT NULL
     OR e."matriculaId" IS DISTINCT FROM r."matriculaId"
     OR e.fim <= e.inicio
     OR NOT u.ativo
     OR NOT ('SECRETARIA_ACADEMICA'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN
    RAISE EXCEPTION 'Agenda exige encontro particular, pedido exato e Secretaria ativa';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId"=r.id AND aprovada) THEN
    RAISE EXCEPTION 'Agenda exige autorização aprovada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Matricula" WHERE id=r."matriculaId" AND status='ATIVA') THEN
    RAISE EXCEPTION 'Agenda exige matrícula ativa';
  END IF;

  IF e.status='CANCELADO' THEN
    SELECT d.resultado INTO resultado_cancelamento
    FROM "DecisaoCancelamentoAgendaReposicaoIndividual" d
    JOIN "PropostaCancelamentoAgendaReposicaoIndividual" p ON p.id=d."propostaId"
    WHERE d.aprovada AND p."agendaId"=NEW.id AND p."encontroId"=e.id;
    IF resultado_cancelamento IS NULL
       OR (resultado_cancelamento='DEVOLVE_BENEFICIO' AND NEW."statusBeneficio"<>'DEVOLVIDA')
       OR (resultado_cancelamento='CONSOME_BENEFICIO' AND NEW."statusBeneficio"<>'CONSUMIDA')
       OR (resultado_cancelamento='ISENTA_SEM_SALDO' AND NEW."statusBeneficio"<>'ISENTA_EXCECAO') THEN
      RAISE EXCEPTION 'Agenda cancelada exige decisão de cancelamento com resultado correspondente';
    END IF;
  ELSIF e.status='MINISTRADO' THEN
    SELECT m."alunoId" INTO aluno FROM "Matricula" m WHERE m.id=r."matriculaId";
    IF aluno IS NULL OR NOT EXISTS (
      SELECT 1 FROM "AulaDiario" diario
      JOIN "RegistroAulaAluno" registro ON registro."aulaId"=diario.id
      WHERE diario."encontroId"=e.id AND registro."alunoId"=aluno
        AND registro.participacao IN ('PRESENTE','FALTA')
    ) THEN
      RAISE EXCEPTION 'Agenda ministrada exige diário e participação do aluno';
    END IF;
  ELSIF e.status <> 'PREVISTO' THEN
    RAISE EXCEPTION 'Agenda só pode apontar encontro previsto, ministrado com diário ou cancelamento decidido';
  END IF;

  SELECT ((e.inicio AT TIME ZONE 'UTC') AT TIME ZONE c."fusoInstitucional")::date
    INTO data_agendada FROM "ConfiguracaoOperacional" c WHERE c.id='escola';
  SELECT EXISTS (
    SELECT 1
    FROM "AutorizacaoExcecaoReposicaoParticular" x
    JOIN "DecisaoAutorizacaoExcecaoReposicaoParticular" d ON d."autorizacaoId"=x.id AND d.aprovada
    WHERE x.id=NEW."autorizacaoExcecaoId" AND x."reposicaoId"=r.id
  ) INTO autorizacao_excepcional;

  IF b.id IS NULL THEN
    IF NOT autorizacao_excepcional
       OR NEW."statusBeneficio" <> 'ISENTA_EXCECAO'
       OR NEW."periodoInicio" IS NOT NULL
       OR NEW."periodoFimExclusivo" IS NOT NULL THEN
      RAISE EXCEPTION 'Particular sem benefício exige autorização excepcional específica';
    END IF;
    IF e.status='CANCELADO' AND resultado_cancelamento<>'ISENTA_SEM_SALDO' THEN
      RAISE EXCEPTION 'Cancelamento de agenda isenta exige resultado isento';
    END IF;
  ELSE
    IF NEW."autorizacaoExcecaoId" IS NOT NULL
       OR b."matriculaId" IS DISTINCT FROM r."matriculaId"
       OR b."vigenteAPartirDe" > data_agendada
       OR b.id IS DISTINCT FROM (
         SELECT id FROM "BeneficioReposicaoParticularMatricula"
         WHERE "matriculaId"=r."matriculaId" AND "vigenteAPartirDe" <= data_agendada
         ORDER BY "vigenteAPartirDe" DESC LIMIT 1
       ) THEN
      RAISE EXCEPTION 'Benefício explícito vigente não confere';
    END IF;
    SELECT inicio, fim INTO inicio_esperado, fim_esperado FROM periodo_beneficio_reposicao(data_agendada,b);
    IF NEW."periodoInicio" IS DISTINCT FROM inicio_esperado
       OR NEW."periodoFimExclusivo" IS DISTINCT FROM fim_esperado
       OR (e.status='PREVISTO' AND NEW."statusBeneficio" <> 'RESERVADA')
       OR (e.status='MINISTRADO' AND NEW."statusBeneficio" <> 'CONSUMIDA')
       OR (e.status='CANCELADO' AND resultado_cancelamento='DEVOLVE_BENEFICIO' AND NEW."statusBeneficio" <> 'DEVOLVIDA')
       OR (e.status='CANCELADO' AND resultado_cancelamento='CONSOME_BENEFICIO' AND NEW."statusBeneficio" <> 'CONSUMIDA')
       OR (e.status='CANCELADO' AND resultado_cancelamento='ISENTA_SEM_SALDO') THEN
      RAISE EXCEPTION 'Benefício ou período da particular não confere';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('beneficio-reposicao:'||r."matriculaId"||':'||inicio_esperado::text,0));
    SELECT count(*) INTO ocupadas
    FROM "AgendaReposicaoIndividual" a
    JOIN "ReposicaoIndividual" ar ON ar.id=a."reposicaoId"
    JOIN "EncontroAgenda" agendado ON agendado.id=a."encontroId"
    JOIN "ConfiguracaoOperacional" conf ON conf.id='escola'
    WHERE a.id <> NEW.id
      AND ar."matriculaId"=r."matriculaId"
      AND a."statusBeneficio" IN ('RESERVADA','CONSUMIDA')
      AND ((agendado.inicio AT TIME ZONE 'UTC') AT TIME ZONE conf."fusoInstitucional")::date >= inicio_esperado
      AND ((agendado.inicio AT TIME ZONE 'UTC') AT TIME ZONE conf."fusoInstitucional")::date < fim_esperado;
    IF e.status='PREVISTO' AND ocupadas >= b."quantidadePorPeriodo" THEN
      RAISE EXCEPTION 'Benefício de reposição sem saldo no período';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT v.* FROM "VersaoCalendarioEscolar" v
      JOIN "DecisaoCalendarioEscolar" d ON d."calendarioId"=v.id AND d.aprovada
      ORDER BY v.versao DESC LIMIT 1
    ) v
    CROSS JOIN LATERAL jsonb_to_recordset(v.periodos) AS p(id TEXT, inicio DATE, fim DATE)
    WHERE p.inicio <= (((e.fim - interval '1 millisecond') AT TIME ZONE 'UTC') AT TIME ZONE v."fusoInstitucional")::date
      AND p.fim >= ((e.inicio AT TIME ZONE 'UTC') AT TIME ZONE v."fusoInstitucional")::date
  ) INTO periodo_nao_letivo;
  IF periodo_nao_letivo AND NOT EXISTS (
    SELECT 1 FROM "ExcecaoAgendaReposicaoIndividual" x
    JOIN "DecisaoExcecaoAgendaReposicaoIndividual" d ON d."excecaoId"=x.id AND d.aprovada
    WHERE x.id=NEW."excecaoId" AND x."reposicaoId"=r.id AND x."professorId"=e."professorId"
      AND x.inicio=e.inicio AND x.fim=e.fim AND x."fusoOrigem"=e."fusoOrigem"
  ) THEN
    RAISE EXCEPTION 'Dia não letivo exige exceção aprovada para este encontro';
  END IF;
  IF NOT periodo_nao_letivo AND NEW."excecaoId" IS NOT NULL THEN
    RAISE EXCEPTION 'Exceção só é válida para o intervalo não letivo correspondente';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_encontro_reposicao_individual_agendado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.finalidade='REPOSICAO' THEN
    IF NEW."reposicaoIndividualId" IS NULL THEN
      RAISE EXCEPTION 'Encontro REPOSICAO exige agenda vinculada ao pedido específico';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "AgendaReposicaoIndividual" a
      WHERE a."reposicaoId"=NEW."reposicaoIndividualId" AND a."encontroId"=NEW.id
    ) THEN
      RETURN NEW;
    END IF;
    IF NEW.status='CANCELADO' AND EXISTS (
      SELECT 1
      FROM "DecisaoRemarcacaoAgendaReposicaoIndividual" d
      JOIN "PropostaRemarcacaoAgendaReposicaoIndividual" p ON p.id=d."propostaId"
      JOIN "AgendaReposicaoIndividual" a ON a.id=p."agendaId"
      JOIN "EncontroAgenda" novo ON novo.id=d."encontroNovoId"
      WHERE d.aprovada AND p."encontroOriginalId"=NEW.id
        AND a."reposicaoId"=NEW."reposicaoIndividualId"
        AND a."encontroId"=d."encontroNovoId"
        AND novo.finalidade='REPOSICAO'
        AND novo."reposicaoIndividualId"=NEW."reposicaoIndividualId"
        AND novo.status='PREVISTO'
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Encontro REPOSICAO exige agenda vigente ou remarcação aprovada para o mesmo pedido';
  ELSIF NEW."reposicaoIndividualId" IS NOT NULL THEN
    RAISE EXCEPTION 'Somente encontro REPOSICAO pode vincular pedido individual';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION consumir_beneficio_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE aluno TEXT;
BEGIN
  IF OLD.finalidade='REPOSICAO' AND OLD.status='PREVISTO' AND NEW.status='MINISTRADO' THEN
    SELECT m."alunoId" INTO aluno
    FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id=r."matriculaId"
    WHERE r.id=NEW."reposicaoIndividualId";
    IF aluno IS NULL OR NOT EXISTS (
      SELECT 1 FROM "AulaDiario" d JOIN "RegistroAulaAluno" registro ON registro."aulaId"=d.id
      WHERE d."encontroId"=NEW.id AND registro."alunoId"=aluno AND registro.participacao IN ('PRESENTE','FALTA')
    ) THEN
      RAISE EXCEPTION 'Reposição ministrada exige diário e participação do aluno';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "AgendaReposicaoIndividual" a
      WHERE a."reposicaoId"=NEW."reposicaoIndividualId" AND a."encontroId"=NEW.id
        AND a."statusBeneficio"='ISENTA_EXCECAO'
    ) THEN
      RETURN NEW;
    END IF;
    UPDATE "AgendaReposicaoIndividual"
      SET "statusBeneficio"='CONSUMIDA', "consumidaEm"=(clock_timestamp() AT TIME ZONE 'UTC')
      WHERE "reposicaoId"=NEW."reposicaoIndividualId" AND "encontroId"=NEW.id
        AND "statusBeneficio"='RESERVADA';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Benefício reservado não encontrado para encontro de reposição';
    END IF;
  ELSIF OLD.finalidade='REPOSICAO' AND OLD.status='PREVISTO' AND NEW.status='CANCELADO' THEN
    IF EXISTS (
      SELECT 1
      FROM "DecisaoCancelamentoAgendaReposicaoIndividual" d
      JOIN "PropostaCancelamentoAgendaReposicaoIndividual" p ON p.id=d."propostaId"
      JOIN "AgendaReposicaoIndividual" a ON a.id=p."agendaId"
      WHERE d.aprovada AND p."encontroId"=OLD.id
        AND a."reposicaoId"=OLD."reposicaoIndividualId" AND a."encontroId"=OLD.id
        AND ((d.resultado='DEVOLVE_BENEFICIO' AND a."statusBeneficio"='DEVOLVIDA')
          OR (d.resultado='CONSOME_BENEFICIO' AND a."statusBeneficio"='CONSUMIDA')
          OR (d.resultado='ISENTA_SEM_SALDO' AND a."statusBeneficio"='ISENTA_EXCECAO'))
    ) THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM "DecisaoRemarcacaoAgendaReposicaoIndividual" d
      JOIN "PropostaRemarcacaoAgendaReposicaoIndividual" p ON p.id=d."propostaId"
      JOIN "AgendaReposicaoIndividual" a ON a.id=p."agendaId"
      JOIN "EncontroAgenda" novo ON novo.id=d."encontroNovoId"
      WHERE d.aprovada AND p."encontroOriginalId"=OLD.id
        AND a."reposicaoId"=OLD."reposicaoIndividualId" AND a."encontroId"=d."encontroNovoId"
        AND novo.finalidade='REPOSICAO' AND novo."reposicaoIndividualId"=OLD."reposicaoIndividualId"
        AND novo.status='PREVISTO' AND a."statusBeneficio" IN ('RESERVADA','ISENTA_EXCECAO')
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cancelamento exige cancelamento ou remarcação aprovada para a agenda exata';
  END IF;
  RETURN NEW;
END $$;
