-- F07.6 / Q10-Q13, Q27, Q40, Q54-Q55, Q59.
-- A fonte acadêmica é isolada de `OcorrenciaParticular` (contrato/cobrança)
-- e de `RECUPERACAO` (nota). Não aplique sem o fragmento Prisma em
-- docs/planejamento/reposicao-modelos.prisma, atualizado com EntregaReposicaoGravacao.

ALTER TYPE "FinalidadeEncontroAgenda" ADD VALUE IF NOT EXISTS 'REPOSICAO';
CREATE TYPE "ModalidadeReposicaoIndividual" AS ENUM ('PARTICULAR', 'GRAVACAO');

CREATE TABLE "ReposicaoIndividual" (
  "id" TEXT NOT NULL,
  "aulaOriginalId" TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "modalidade" "ModalidadeReposicaoIndividual" NOT NULL,
  "solicitanteId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "evidencia" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReposicaoIndividual_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReposicaoIndividual_solicitanteId_chaveIdempotencia_key" ON "ReposicaoIndividual"("solicitanteId", "chaveIdempotencia");
CREATE INDEX "ReposicaoIndividual_matriculaId_aulaOriginalId_idx" ON "ReposicaoIndividual"("matriculaId", "aulaOriginalId");
ALTER TABLE "ReposicaoIndividual" ADD CONSTRAINT "ReposicaoIndividual_aulaOriginalId_fkey" FOREIGN KEY ("aulaOriginalId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ReposicaoIndividual" ADD CONSTRAINT "ReposicaoIndividual_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ReposicaoIndividual" ADD CONSTRAINT "ReposicaoIndividual_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "DecisaoReposicaoIndividual" (
  "id" TEXT NOT NULL, "reposicaoId" TEXT NOT NULL, "decisorId" TEXT NOT NULL,
  "aprovada" BOOLEAN NOT NULL, "motivo" TEXT NOT NULL, "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoReposicaoIndividual_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DecisaoReposicaoIndividual_reposicaoId_key" ON "DecisaoReposicaoIndividual"("reposicaoId");
ALTER TABLE "DecisaoReposicaoIndividual" ADD CONSTRAINT "DecisaoReposicaoIndividual_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoReposicaoIndividual" ADD CONSTRAINT "DecisaoReposicaoIndividual_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "EntregaReposicaoGravacao" (
  "id" TEXT NOT NULL, "reposicaoId" TEXT NOT NULL, "alunoId" TEXT NOT NULL, "versao" INTEGER NOT NULL,
  "resumo" TEXT NOT NULL, "atividade" TEXT NOT NULL, "evidencia" TEXT NOT NULL, "entregueEm" TIMESTAMP(3) NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntregaReposicaoGravacao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EntregaReposicaoGravacao_reposicaoId_versao_key" ON "EntregaReposicaoGravacao"("reposicaoId", "versao");
CREATE INDEX "EntregaReposicaoGravacao_alunoId_entregueEm_idx" ON "EntregaReposicaoGravacao"("alunoId", "entregueEm");
ALTER TABLE "EntregaReposicaoGravacao" ADD CONSTRAINT "EntregaReposicaoGravacao_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "EntregaReposicaoGravacao" ADD CONSTRAINT "EntregaReposicaoGravacao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "ConclusaoReposicaoIndividual" (
  "id" TEXT NOT NULL, "reposicaoId" TEXT NOT NULL, "versao" INTEGER NOT NULL, "concluida" BOOLEAN NOT NULL,
  "encontroReposicaoId" TEXT, "realizadaEm" TIMESTAMP(3), "entregaId" TEXT,
  "validadaEm" TIMESTAMP(3), "validadaPorId" TEXT, "evidencia" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConclusaoReposicaoIndividual_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConclusaoReposicaoIndividual_reposicaoId_versao_key" ON "ConclusaoReposicaoIndividual"("reposicaoId", "versao");
CREATE UNIQUE INDEX "ConclusaoReposicaoIndividual_entregaId_key" ON "ConclusaoReposicaoIndividual"("entregaId");
CREATE INDEX "ConclusaoReposicaoIndividual_encontroReposicaoId_idx" ON "ConclusaoReposicaoIndividual"("encontroReposicaoId");
ALTER TABLE "ConclusaoReposicaoIndividual" ADD CONSTRAINT "ConclusaoReposicaoIndividual_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ConclusaoReposicaoIndividual" ADD CONSTRAINT "ConclusaoReposicaoIndividual_encontroReposicaoId_fkey" FOREIGN KEY ("encontroReposicaoId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ConclusaoReposicaoIndividual" ADD CONSTRAINT "ConclusaoReposicaoIndividual_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "EntregaReposicaoGravacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ConclusaoReposicaoIndividual" ADD CONSTRAINT "ConclusaoReposicaoIndividual_validadaPorId_fkey" FOREIGN KEY ("validadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "CorrecaoConclusaoReposicaoIndividual" (
  "id" TEXT NOT NULL, "conclusaoId" TEXT NOT NULL, "autorId" TEXT NOT NULL, "versao" INTEGER NOT NULL, "concluida" BOOLEAN NOT NULL,
  "encontroReposicaoId" TEXT, "realizadaEm" TIMESTAMP(3), "entregaId" TEXT,
  "validadaEm" TIMESTAMP(3), "validadaPorId" TEXT, "evidencia" TEXT NOT NULL, "motivo" TEXT NOT NULL, "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CorrecaoConclusaoReposicaoIndividual_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CorrecaoConclusaoReposicaoIndividual_conclusaoId_versao_key" ON "CorrecaoConclusaoReposicaoIndividual"("conclusaoId", "versao");
CREATE UNIQUE INDEX "CorrecaoConclusaoReposicaoIndividual_entregaId_key" ON "CorrecaoConclusaoReposicaoIndividual"("entregaId");
ALTER TABLE "CorrecaoConclusaoReposicaoIndividual" ADD CONSTRAINT "CorrecaoConclusaoReposicaoIndividual_conclusaoId_fkey" FOREIGN KEY ("conclusaoId") REFERENCES "ConclusaoReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "CorrecaoConclusaoReposicaoIndividual" ADD CONSTRAINT "CorrecaoConclusaoReposicaoIndividual_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "CorrecaoConclusaoReposicaoIndividual" ADD CONSTRAINT "CorrecaoConclusaoReposicaoIndividual_encontroReposicaoId_fkey" FOREIGN KEY ("encontroReposicaoId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "CorrecaoConclusaoReposicaoIndividual" ADD CONSTRAINT "CorrecaoConclusaoReposicaoIndividual_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "EntregaReposicaoGravacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "CorrecaoConclusaoReposicaoIndividual" ADD CONSTRAINT "CorrecaoConclusaoReposicaoIndividual_validadaPorId_fkey" FOREIGN KEY ("validadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "DecisaoCorrecaoConclusaoReposicao" (
  "id" TEXT NOT NULL, "correcaoId" TEXT NOT NULL, "decisorId" TEXT NOT NULL, "aprovada" BOOLEAN NOT NULL,
  "motivo" TEXT NOT NULL, "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoCorrecaoConclusaoReposicao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DecisaoCorrecaoConclusaoReposicao_correcaoId_key" ON "DecisaoCorrecaoConclusaoReposicao"("correcaoId");
ALTER TABLE "DecisaoCorrecaoConclusaoReposicao" ADD CONSTRAINT "DecisaoCorrecaoConclusaoReposicao_correcaoId_fkey" FOREIGN KEY ("correcaoId") REFERENCES "CorrecaoConclusaoReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoCorrecaoConclusaoReposicao" ADD CONSTRAINT "DecisaoCorrecaoConclusaoReposicao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "DesignacaoAvaliadorReposicaoIndividual" (
  "id" TEXT NOT NULL, "reposicaoId" TEXT NOT NULL, "professorId" TEXT NOT NULL, "designadorId" TEXT NOT NULL,
  "inicio" TIMESTAMP(3) NOT NULL, "fim" TIMESTAMP(3), "motivo" TEXT NOT NULL, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesignacaoAvaliadorReposicaoIndividual_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DesignacaoAvaliadorReposicaoIndividual_intervalo" CHECK ("fim" IS NULL OR "fim" > "inicio")
);
CREATE INDEX "DesignacaoAvaliadorReposicaoIndividual_reposicaoId_professorId_inicio_idx" ON "DesignacaoAvaliadorReposicaoIndividual"("reposicaoId", "professorId", "inicio");
ALTER TABLE "DesignacaoAvaliadorReposicaoIndividual" ADD CONSTRAINT "DesignacaoAvaliadorReposicaoIndividual_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DesignacaoAvaliadorReposicaoIndividual" ADD CONSTRAINT "DesignacaoAvaliadorReposicaoIndividual_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DesignacaoAvaliadorReposicaoIndividual" ADD CONSTRAINT "DesignacaoAvaliadorReposicaoIndividual_designadorId_fkey" FOREIGN KEY ("designadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- As fontes são append-only. Correção é outra tabela e tem decisão própria.
CREATE OR REPLACE FUNCTION proteger_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN RAISE EXCEPTION 'Reposições individuais são históricas e não podem ser alteradas ou removidas'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER proteger_reposicao_individual BEFORE UPDATE OR DELETE ON "ReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION proteger_reposicao_individual();
CREATE TRIGGER proteger_decisao_reposicao_individual BEFORE UPDATE OR DELETE ON "DecisaoReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION proteger_reposicao_individual();
CREATE TRIGGER proteger_conclusao_reposicao_individual BEFORE UPDATE OR DELETE ON "ConclusaoReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION proteger_reposicao_individual();
CREATE TRIGGER proteger_entrega_reposicao_gravacao BEFORE UPDATE OR DELETE ON "EntregaReposicaoGravacao" FOR EACH ROW EXECUTE FUNCTION proteger_reposicao_individual();
CREATE TRIGGER proteger_correcao_conclusao_reposicao BEFORE UPDATE OR DELETE ON "CorrecaoConclusaoReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION proteger_reposicao_individual();
CREATE TRIGGER proteger_decisao_correcao_reposicao BEFORE UPDATE OR DELETE ON "DecisaoCorrecaoConclusaoReposicao" FOR EACH ROW EXECUTE FUNCTION proteger_reposicao_individual();

CREATE OR REPLACE FUNCTION validar_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE origem "EncontroAgenda"%ROWTYPE; aluno_contrato TEXT; participacao "ParticipacaoAula";
BEGIN
  SELECT * INTO origem FROM "EncontroAgenda" WHERE id = NEW."aulaOriginalId";
  SELECT "alunoId" INTO aluno_contrato FROM "Matricula" WHERE id = NEW."matriculaId";
  SELECT r.participacao INTO participacao FROM "AulaDiario" d JOIN "RegistroAulaAluno" r ON r."aulaId" = d.id
    WHERE d."encontroId" = origem.id AND r."matriculaId" = NEW."matriculaId" AND r."alunoId" = aluno_contrato;
  IF origem.id IS NULL OR origem.finalidade <> 'AULA' OR origem."turmaId" IS NULL OR origem.status <> 'MINISTRADO' OR participacao NOT IN ('FALTA', 'IMPEDIDO_POR_RESTRICAO') THEN
    RAISE EXCEPTION 'Reposição exige aula original coletiva ministrada e ausência/impedimento da mesma matrícula';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_reposicao_individual BEFORE INSERT ON "ReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION validar_reposicao_individual();

CREATE OR REPLACE FUNCTION validar_decisao_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ReposicaoIndividual" WHERE id = NEW."reposicaoId" AND "solicitanteId" = NEW."decisorId") THEN RAISE EXCEPTION 'Solicitante não pode decidir a própria reposição'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_decisao_reposicao_individual BEFORE INSERT ON "DecisaoReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION validar_decisao_reposicao_individual();

CREATE OR REPLACE FUNCTION validar_entrega_reposicao_gravacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE matricula_aluno TEXT; modalidade "ModalidadeReposicaoIndividual"; anterior INTEGER;
BEGIN
  SELECT m."alunoId", r.modalidade INTO matricula_aluno, modalidade FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id = r."matriculaId" WHERE r.id = NEW."reposicaoId";
  SELECT COALESCE(MAX(versao), 0) INTO anterior FROM "EntregaReposicaoGravacao" WHERE "reposicaoId" = NEW."reposicaoId";
  IF modalidade IS DISTINCT FROM 'GRAVACAO' OR matricula_aluno IS DISTINCT FROM NEW."alunoId" OR NEW.versao <> anterior + 1
    OR btrim(NEW.resumo) = '' OR btrim(NEW.atividade) = '' OR btrim(NEW.evidencia) = '' OR NEW."entregueEm" > CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Entrega gravada exige aluno da matrícula, conteúdo, evidência, versão sequencial e data não futura';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_entrega_reposicao_gravacao BEFORE INSERT ON "EntregaReposicaoGravacao" FOR EACH ROW EXECUTE FUNCTION validar_entrega_reposicao_gravacao();

CREATE OR REPLACE FUNCTION validar_conclusao_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE modalidade "ModalidadeReposicaoIndividual"; aluno_contrato TEXT; fim_origem TIMESTAMP(3); fim_encontro TIMESTAMP(3); presente "ParticipacaoAula";
BEGIN
  SELECT r.modalidade, m."alunoId", origem.fim INTO modalidade, aluno_contrato, fim_origem
  FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id = r."matriculaId" JOIN "EncontroAgenda" origem ON origem.id = r."aulaOriginalId" WHERE r.id = NEW."reposicaoId";
  IF NOT EXISTS (SELECT 1 FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId" = NEW."reposicaoId" AND aprovada) THEN RAISE EXCEPTION 'Conclusão exige autorização aprovada'; END IF;
  IF NEW.concluida IS NOT TRUE THEN RAISE EXCEPTION 'Conclusão inicial precisa ser concluída; use correção aprovada para invalidar'; END IF;
  IF modalidade = 'PARTICULAR' THEN
    SELECT e.fim, registro.participacao INTO fim_encontro, presente FROM "EncontroAgenda" e
      LEFT JOIN "AulaDiario" diario ON diario."encontroId" = e.id LEFT JOIN "RegistroAulaAluno" registro ON registro."aulaId" = diario.id AND registro."alunoId" = aluno_contrato
      WHERE e.id = NEW."encontroReposicaoId" AND e.finalidade = 'REPOSICAO' AND e."turmaId" IS NULL
        AND e."matriculaId" = (SELECT "matriculaId" FROM "ReposicaoIndividual" WHERE id = NEW."reposicaoId") AND e.status = 'MINISTRADO';
    IF NEW."encontroReposicaoId" IS NULL OR NEW."realizadaEm" IS NULL OR NEW."entregaId" IS NOT NULL OR NEW."validadaEm" IS NOT NULL OR NEW."validadaPorId" IS NOT NULL
      OR fim_encontro IS NULL OR fim_encontro <> NEW."realizadaEm" OR fim_encontro < fim_origem OR presente <> 'PRESENTE' THEN RAISE EXCEPTION 'Particular exige encontro REPOSICAO realizado, diário presente e data posterior à aula original'; END IF;
  ELSE
    IF NEW."encontroReposicaoId" IS NOT NULL OR NEW."realizadaEm" IS NOT NULL OR NEW."entregaId" IS NULL OR NEW."validadaEm" IS NULL OR NEW."validadaPorId" IS NULL
      OR NOT EXISTS (SELECT 1 FROM "EntregaReposicaoGravacao" WHERE id = NEW."entregaId" AND "reposicaoId" = NEW."reposicaoId" AND "entregueEm" <= NEW."validadaEm")
      OR NEW."validadaEm" < fim_origem
      OR NOT EXISTS (SELECT 1 FROM "DesignacaoAvaliadorReposicaoIndividual" d JOIN "Usuario" u ON u.id=d."professorId" AND u.ativo WHERE d."reposicaoId"=NEW."reposicaoId" AND d."professorId"=NEW."validadaPorId" AND d.inicio <= NEW."validadaEm" AND (d.fim IS NULL OR d.fim > NEW."validadaEm")) THEN
      RAISE EXCEPTION 'Gravação exige entrega do aluno, validação posterior do docente designado ativo e sem encontro particular';
    END IF;
  END IF;
  IF btrim(NEW.evidencia) = '' THEN RAISE EXCEPTION 'Conclusão exige evidência'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_conclusao_reposicao_individual BEFORE INSERT ON "ConclusaoReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION validar_conclusao_reposicao_individual();

CREATE OR REPLACE FUNCTION validar_correcao_conclusao_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reposicao TEXT; solicitante TEXT; anterior INTEGER;
BEGIN
  SELECT "reposicaoId" INTO reposicao FROM "ConclusaoReposicaoIndividual" WHERE id = NEW."conclusaoId";
  SELECT "solicitanteId" INTO solicitante FROM "ReposicaoIndividual" WHERE id = reposicao;
  SELECT COALESCE(MAX(versao), 0) INTO anterior FROM "CorrecaoConclusaoReposicaoIndividual" WHERE "conclusaoId" = NEW."conclusaoId";
  IF reposicao IS NULL OR NEW.versao <> anterior + 1 OR btrim(NEW.evidencia) = '' OR btrim(NEW.motivo) = '' THEN RAISE EXCEPTION 'Correção exige conclusão existente, versão sequencial, motivo e evidência'; END IF;
  -- Para correções que mantêm conclusão, usa uma linha transitória da mesma
  -- regra de origem; a decisão independente é validada no trigger abaixo.
  IF NEW.concluida AND NOT EXISTS (SELECT 1 FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId"=reposicao AND aprovada) THEN RAISE EXCEPTION 'Correção exige reposição autorizada'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_correcao_conclusao_reposicao BEFORE INSERT ON "CorrecaoConclusaoReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION validar_correcao_conclusao_reposicao();

CREATE OR REPLACE FUNCTION validar_decisao_correcao_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE autor TEXT;
BEGIN
  SELECT "autorId" INTO autor FROM "CorrecaoConclusaoReposicaoIndividual" WHERE id = NEW."correcaoId";
  IF autor IS NULL OR autor = NEW."decisorId" THEN RAISE EXCEPTION 'Outra pessoa deve decidir a correção da reposição'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_decisao_correcao_reposicao BEFORE INSERT ON "DecisaoCorrecaoConclusaoReposicao" FOR EACH ROW EXECUTE FUNCTION validar_decisao_correcao_reposicao();
