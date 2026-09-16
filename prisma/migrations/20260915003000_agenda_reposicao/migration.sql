-- F07 / Q11, Q14, Q16, Q19, Q25, Q26, Q49 e Q51.
-- RASCUNHO: root deve copiar este conteúdo para a migration 177 somente
-- depois de incorporar reposicao-agenda-modelos.prisma e gerar o Prisma.
-- Não toca OcorrenciaParticular, ReservaAgendaParticular, horas compradas,
-- cobranças ou RECUPERACAO.

CREATE TYPE "ReferenciaPeriodoBeneficioReposicao" AS ENUM ('CIVIL', 'CICLO_MATRICULA');
CREATE TYPE "UnidadePeriodoBeneficioReposicao" AS ENUM ('DIAS', 'MESES');
CREATE TYPE "StatusReservaBeneficioReposicao" AS ENUM ('RESERVADA', 'CONSUMIDA', 'DEVOLVIDA', 'ISENTA_EXCECAO');

CREATE TABLE "PropostaRegraBeneficioReposicaoOferta" (
  id TEXT NOT NULL, "produtoPaisId" TEXT NOT NULL, versao INTEGER NOT NULL,
  "permiteParticular" BOOLEAN NOT NULL, referencia "ReferenciaPeriodoBeneficioReposicao" NOT NULL,
  unidade "UnidadePeriodoBeneficioReposicao" NOT NULL, "duracaoPeriodo" INTEGER NOT NULL,
  "quantidadePorPeriodo" INTEGER NOT NULL, "antecedenciaCancelamentoMinutos" INTEGER NOT NULL,
  "autorId" TEXT NOT NULL, motivo TEXT NOT NULL, "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropostaRegraBeneficioReposicaoOferta_pkey" PRIMARY KEY (id),
  CONSTRAINT "PropostaRegraBeneficioReposicaoOferta_completa" CHECK ("duracaoPeriodo">0 AND "duracaoPeriodo"<=120000 AND "quantidadePorPeriodo">=0 AND "quantidadePorPeriodo"<=1000 AND "antecedenciaCancelamentoMinutos">=0 AND "antecedenciaCancelamentoMinutos"<=5256000 AND length(btrim(motivo))>=5)
);
CREATE UNIQUE INDEX "PropostaRegraBeneficioReposicaoOferta_produtoPaisId_versao_key" ON "PropostaRegraBeneficioReposicaoOferta"("produtoPaisId",versao);
CREATE UNIQUE INDEX "PropostaRegraBeneficioReposicaoOferta_autorId_chaveIdempote_key" ON "PropostaRegraBeneficioReposicaoOferta"("autorId","chaveIdempotencia");
ALTER TABLE "PropostaRegraBeneficioReposicaoOferta" ADD CONSTRAINT "PropostaRegraBeneficioReposicaoOferta_produtoPaisId_fkey" FOREIGN KEY ("produtoPaisId") REFERENCES "ProdutoPais"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaRegraBeneficioReposicaoOferta" ADD CONSTRAINT "PropostaRegraBeneficioReposicaoOferta_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "DecisaoRegraBeneficioReposicaoOferta" (
  id TEXT NOT NULL, "propostaId" TEXT NOT NULL, "decisorId" TEXT NOT NULL, aprovada BOOLEAN NOT NULL, motivo TEXT NOT NULL,
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoRegraBeneficioReposicaoOferta_pkey" PRIMARY KEY (id),
  CONSTRAINT "DecisaoRegraBeneficioReposicaoOferta_motivo" CHECK (length(btrim(motivo))>=5)
);
CREATE UNIQUE INDEX "DecisaoRegraBeneficioReposicaoOferta_propostaId_key" ON "DecisaoRegraBeneficioReposicaoOferta"("propostaId");
ALTER TABLE "DecisaoRegraBeneficioReposicaoOferta" ADD CONSTRAINT "DecisaoRegraBeneficioReposicaoOferta_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaRegraBeneficioReposicaoOferta"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoRegraBeneficioReposicaoOferta" ADD CONSTRAINT "DecisaoRegraBeneficioReposicaoOferta_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "BeneficioReposicaoParticularMatricula" (
  id TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "regraOfertaId" TEXT NOT NULL,
  referencia "ReferenciaPeriodoBeneficioReposicao" NOT NULL,
  unidade "UnidadePeriodoBeneficioReposicao" NOT NULL,
  "duracaoPeriodo" INTEGER NOT NULL,
  "referenciaCiclo" DATE,
  "quantidadePorPeriodo" INTEGER NOT NULL,
  "antecedenciaCancelamentoMinutos" INTEGER NOT NULL,
  "vigenteAPartirDe" DATE NOT NULL,
  "aplicadoPorId" TEXT NOT NULL,
  motivo TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BeneficioReposicaoParticularMatricula_pkey" PRIMARY KEY (id),
  CONSTRAINT "BeneficioReposicaoParticularMatricula_completa" CHECK (
    "duracaoPeriodo" > 0 AND "duracaoPeriodo" <= 120000
    AND "quantidadePorPeriodo" >= 0 AND "quantidadePorPeriodo" <= 1000
    AND "antecedenciaCancelamentoMinutos" >= 0 AND "antecedenciaCancelamentoMinutos" <= 5256000
    AND length(btrim(motivo)) >= 5
    AND ((referencia = 'CIVIL' AND "referenciaCiclo" IS NULL) OR (referencia = 'CICLO_MATRICULA' AND "referenciaCiclo" IS NOT NULL))
  )
);
CREATE UNIQUE INDEX "BeneficioReposicaoParticularMatricula_aplicadoPorId_chaveId_key" ON "BeneficioReposicaoParticularMatricula"("aplicadoPorId", "chaveIdempotencia");
CREATE UNIQUE INDEX "BeneficioReposicaoParticularMatricula_matriculaId_vigenteAP_key" ON "BeneficioReposicaoParticularMatricula"("matriculaId", "vigenteAPartirDe");
CREATE INDEX "BeneficioReposicaoParticularMatricula_matriculaId_vigenteAP_idx" ON "BeneficioReposicaoParticularMatricula"("matriculaId", "vigenteAPartirDe");
ALTER TABLE "BeneficioReposicaoParticularMatricula" ADD CONSTRAINT "BeneficioReposicaoParticularMatricula_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "BeneficioReposicaoParticularMatricula" ADD CONSTRAINT "BeneficioReposicaoParticularMatricula_regraOfertaId_fkey" FOREIGN KEY ("regraOfertaId") REFERENCES "PropostaRegraBeneficioReposicaoOferta"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "BeneficioReposicaoParticularMatricula" ADD CONSTRAINT "BeneficioReposicaoParticularMatricula_aplicadoPorId_fkey" FOREIGN KEY ("aplicadoPorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "EncontroAgenda" ADD COLUMN "reposicaoIndividualId" TEXT;
ALTER TABLE "EncontroAgenda" ADD CONSTRAINT "EncontroAgenda_reposicaoIndividualId_fkey" FOREIGN KEY ("reposicaoIndividualId") REFERENCES "ReposicaoIndividual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE UNIQUE INDEX "EncontroAgenda_reposicaoIndividualId_key" ON "EncontroAgenda"("reposicaoIndividualId");

CREATE TABLE "ExcecaoAgendaReposicaoIndividual" (
  id TEXT NOT NULL,
  "reposicaoId" TEXT NOT NULL, versao INTEGER NOT NULL,
  "professorId" TEXT NOT NULL,
  inicio TIMESTAMP(3) NOT NULL,
  fim TIMESTAMP(3) NOT NULL,
  "fusoOrigem" TEXT NOT NULL,
  "solicitanteId" TEXT NOT NULL,
  motivo TEXT NOT NULL,
  evidencia TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExcecaoAgendaReposicaoIndividual_pkey" PRIMARY KEY (id),
  CONSTRAINT "ExcecaoAgendaReposicaoIndividual_intervalo" CHECK (fim > inicio AND length(btrim(motivo)) >= 5 AND length(btrim(evidencia)) >= 5)
);
CREATE UNIQUE INDEX "ExcecaoAgendaReposicaoIndividual_reposicaoId_versao_key" ON "ExcecaoAgendaReposicaoIndividual"("reposicaoId",versao);
CREATE UNIQUE INDEX "ExcecaoAgendaReposicaoIndividual_solicitanteId_chaveIdempot_key" ON "ExcecaoAgendaReposicaoIndividual"("solicitanteId", "chaveIdempotencia");
CREATE INDEX "ExcecaoAgendaReposicaoIndividual_reposicaoId_inicio_fim_idx" ON "ExcecaoAgendaReposicaoIndividual"("reposicaoId", inicio, fim);
ALTER TABLE "ExcecaoAgendaReposicaoIndividual" ADD CONSTRAINT "ExcecaoAgendaReposicaoIndividual_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ExcecaoAgendaReposicaoIndividual" ADD CONSTRAINT "ExcecaoAgendaReposicaoIndividual_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ExcecaoAgendaReposicaoIndividual" ADD CONSTRAINT "ExcecaoAgendaReposicaoIndividual_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "DecisaoExcecaoAgendaReposicaoIndividual" (
  id TEXT NOT NULL,
  "excecaoId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL,
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoExcecaoAgendaReposicaoIndividual_pkey" PRIMARY KEY (id),
  CONSTRAINT "DecisaoExcecaoAgendaReposicaoIndividual_motivo" CHECK (length(btrim(motivo)) >= 5)
);
CREATE UNIQUE INDEX "DecisaoExcecaoAgendaReposicaoIndividual_excecaoId_key" ON "DecisaoExcecaoAgendaReposicaoIndividual"("excecaoId");
ALTER TABLE "DecisaoExcecaoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoExcecaoAgendaReposicaoIndividual_excecaoId_fkey" FOREIGN KEY ("excecaoId") REFERENCES "ExcecaoAgendaReposicaoIndividual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoExcecaoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoExcecaoAgendaReposicaoIndividual_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "AutorizacaoExcecaoReposicaoParticular" (
  id TEXT NOT NULL, "reposicaoId" TEXT NOT NULL, "solicitanteId" TEXT NOT NULL, versao INTEGER NOT NULL,
  motivo TEXT NOT NULL, evidencia TEXT NOT NULL, "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutorizacaoExcecaoReposicaoParticular_pkey" PRIMARY KEY (id),
  CONSTRAINT "AutorizacaoExcecaoReposicaoParticular_texto" CHECK (length(btrim(motivo))>=5 AND length(btrim(evidencia))>=5)
);
CREATE UNIQUE INDEX "AutorizacaoExcecaoReposicaoParticular_reposicaoId_versao_key" ON "AutorizacaoExcecaoReposicaoParticular"("reposicaoId",versao);
CREATE UNIQUE INDEX "AutorizacaoExcecaoReposicaoParticular_solicitanteId_chaveId_key" ON "AutorizacaoExcecaoReposicaoParticular"("solicitanteId","chaveIdempotencia");
ALTER TABLE "AutorizacaoExcecaoReposicaoParticular" ADD CONSTRAINT "AutorizacaoExcecaoReposicaoParticular_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AutorizacaoExcecaoReposicaoParticular" ADD CONSTRAINT "AutorizacaoExcecaoReposicaoParticular_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "DecisaoAutorizacaoExcecaoReposicaoParticular" (
  id TEXT NOT NULL, "autorizacaoId" TEXT NOT NULL, "decisorId" TEXT NOT NULL, aprovada BOOLEAN NOT NULL, motivo TEXT NOT NULL,
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoAutorizacaoExcecaoReposicaoParticular_pkey" PRIMARY KEY (id),
  CONSTRAINT "DecisaoAutorizacaoExcecaoReposicaoParticular_motivo" CHECK (length(btrim(motivo))>=5)
);
CREATE UNIQUE INDEX "DecisaoAutorizacaoExcecaoReposicaoParticular_autorizacaoId_key" ON "DecisaoAutorizacaoExcecaoReposicaoParticular"("autorizacaoId");
ALTER TABLE "DecisaoAutorizacaoExcecaoReposicaoParticular" ADD CONSTRAINT "DecisaoAutorizacaoExcecaoReposicaoParticular_autorizacaoId_fkey" FOREIGN KEY ("autorizacaoId") REFERENCES "AutorizacaoExcecaoReposicaoParticular"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoAutorizacaoExcecaoReposicaoParticular" ADD CONSTRAINT "DecisaoAutorizacaoExcecaoReposicaoParticular_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION validar_autorizacao_excecao_beneficio_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "ReposicaoIndividual"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
  SELECT * INTO r FROM "ReposicaoIndividual" WHERE id=NEW."reposicaoId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."solicitanteId" FOR SHARE;
  IF r.id IS NULL OR u.id IS NULL OR r.modalidade<>'PARTICULAR' OR NOT u.ativo OR NOT ('SECRETARIA_ACADEMICA'=ANY(u.papeis) OR 'GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Exceção de benefício exige pedido particular e autor acadêmico ativo'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_autorizacao_excecao_beneficio_reposicao BEFORE INSERT ON "AutorizacaoExcecaoReposicaoParticular" FOR EACH ROW EXECUTE FUNCTION validar_autorizacao_excecao_beneficio_reposicao();

CREATE OR REPLACE FUNCTION validar_decisao_autorizacao_excecao_beneficio_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "AutorizacaoExcecaoReposicaoParticular"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
  SELECT * INTO p FROM "AutorizacaoExcecaoReposicaoParticular" WHERE id=NEW."autorizacaoId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF p.id IS NULL OR u.id IS NULL OR p."solicitanteId"=NEW."decisorId" OR NOT u.ativo OR NOT ('GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Exceção de benefício exige decisão independente de gestão ativa'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_decisao_autorizacao_excecao_beneficio_reposicao BEFORE INSERT ON "DecisaoAutorizacaoExcecaoReposicaoParticular" FOR EACH ROW EXECUTE FUNCTION validar_decisao_autorizacao_excecao_beneficio_reposicao();

CREATE TABLE "AgendaReposicaoIndividual" (
  id TEXT NOT NULL,
  "reposicaoId" TEXT NOT NULL,
  "encontroId" TEXT NOT NULL,
  "beneficioId" TEXT,
  "periodoInicio" DATE,
  "periodoFimExclusivo" DATE,
  "statusBeneficio" "StatusReservaBeneficioReposicao" NOT NULL DEFAULT 'RESERVADA',
  "excecaoId" TEXT,
  "autorizacaoExcecaoId" TEXT,
  "reservadoPorId" TEXT NOT NULL,
  motivo TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumidaEm" TIMESTAMP(3),
  "devolvidaEm" TIMESTAMP(3),
  "motivoDevolucao" TEXT,
  CONSTRAINT "AgendaReposicaoIndividual_pkey" PRIMARY KEY (id),
  CONSTRAINT "AgendaReposicaoIndividual_periodo" CHECK ((("periodoInicio" IS NOT NULL AND "periodoFimExclusivo" > "periodoInicio") OR ("periodoInicio" IS NULL AND "periodoFimExclusivo" IS NULL)) AND length(btrim(motivo)) >= 5),
  CONSTRAINT "AgendaReposicaoIndividual_estado" CHECK (
    ("statusBeneficio" = 'RESERVADA' AND "consumidaEm" IS NULL AND "devolvidaEm" IS NULL AND "motivoDevolucao" IS NULL)
    OR ("statusBeneficio" = 'CONSUMIDA' AND "consumidaEm" IS NOT NULL AND "devolvidaEm" IS NULL AND "motivoDevolucao" IS NULL)
    OR ("statusBeneficio" = 'DEVOLVIDA' AND "consumidaEm" IS NULL AND "devolvidaEm" IS NOT NULL AND length(btrim("motivoDevolucao")) >= 5)
    OR ("statusBeneficio" = 'ISENTA_EXCECAO' AND "consumidaEm" IS NULL AND "devolvidaEm" IS NULL AND "motivoDevolucao" IS NULL)
  )
);
CREATE UNIQUE INDEX "AgendaReposicaoIndividual_reposicaoId_key" ON "AgendaReposicaoIndividual"("reposicaoId");
CREATE UNIQUE INDEX "AgendaReposicaoIndividual_encontroId_key" ON "AgendaReposicaoIndividual"("encontroId");
CREATE UNIQUE INDEX "AgendaReposicaoIndividual_excecaoId_key" ON "AgendaReposicaoIndividual"("excecaoId");
CREATE UNIQUE INDEX "AgendaReposicaoIndividual_autorizacaoExcecaoId_key" ON "AgendaReposicaoIndividual"("autorizacaoExcecaoId");
CREATE INDEX "AgendaReposicaoIndividual_beneficioId_periodoInicio_periodo_idx" ON "AgendaReposicaoIndividual"("beneficioId", "periodoInicio", "periodoFimExclusivo", "statusBeneficio");
ALTER TABLE "AgendaReposicaoIndividual" ADD CONSTRAINT "AgendaReposicaoIndividual_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AgendaReposicaoIndividual" ADD CONSTRAINT "AgendaReposicaoIndividual_encontroId_fkey" FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AgendaReposicaoIndividual" ADD CONSTRAINT "AgendaReposicaoIndividual_beneficioId_fkey" FOREIGN KEY ("beneficioId") REFERENCES "BeneficioReposicaoParticularMatricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AgendaReposicaoIndividual" ADD CONSTRAINT "AgendaReposicaoIndividual_excecaoId_fkey" FOREIGN KEY ("excecaoId") REFERENCES "ExcecaoAgendaReposicaoIndividual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AgendaReposicaoIndividual" ADD CONSTRAINT "AgendaReposicaoIndividual_autorizacaoExcecaoId_fkey" FOREIGN KEY ("autorizacaoExcecaoId") REFERENCES "AutorizacaoExcecaoReposicaoParticular"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AgendaReposicaoIndividual" ADD CONSTRAINT "AgendaReposicaoIndividual_reservadoPorId_fkey" FOREIGN KEY ("reservadoPorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Regras persistidas também resistem a SQL direto. O app toma o mesmo lock
-- antes de criar para serializar duas reservas do mesmo vínculo/período.
CREATE OR REPLACE FUNCTION validar_regra_beneficio_reposicao_oferta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; anterior INTEGER;
BEGIN
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT u.ativo OR NOT ('GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Benefício acadêmico exige gestão ativa'; END IF;
  SELECT COALESCE(MAX(versao),0) INTO anterior FROM "PropostaRegraBeneficioReposicaoOferta" WHERE "produtoPaisId"=NEW."produtoPaisId";
  IF NEW.versao <> anterior+1 THEN RAISE EXCEPTION 'Regra de benefício exige versão sequencial da oferta'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_regra_beneficio_reposicao_oferta BEFORE INSERT ON "PropostaRegraBeneficioReposicaoOferta" FOR EACH ROW EXECUTE FUNCTION validar_regra_beneficio_reposicao_oferta();

CREATE OR REPLACE FUNCTION validar_decisao_regra_beneficio_reposicao_oferta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaRegraBeneficioReposicaoOferta"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
  SELECT * INTO p FROM "PropostaRegraBeneficioReposicaoOferta" WHERE id=NEW."propostaId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF p.id IS NULL OR u.id IS NULL OR p."autorId"=NEW."decisorId" OR NOT u.ativo OR NOT ('GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Regra de benefício exige decisão independente de gestão ativa'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_decisao_regra_beneficio_reposicao_oferta BEFORE INSERT ON "DecisaoRegraBeneficioReposicaoOferta" FOR EACH ROW EXECUTE FUNCTION validar_decisao_regra_beneficio_reposicao_oferta();

CREATE OR REPLACE FUNCTION validar_beneficio_reposicao_particular() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m "Matricula"%ROWTYPE; u "Usuario"%ROWTYPE; regra "PropostaRegraBeneficioReposicaoOferta"%ROWTYPE;
BEGIN
  SELECT * INTO m FROM "Matricula" WHERE id=NEW."matriculaId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."aplicadoPorId" FOR SHARE;
  SELECT * INTO regra FROM "PropostaRegraBeneficioReposicaoOferta" WHERE id=NEW."regraOfertaId" FOR SHARE;
  IF m.id IS NULL OR u.id IS NULL OR regra.id IS NULL OR NOT u.ativo OR NOT ('GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Snapshot exige matrícula e gestão ativa'; END IF;
  IF m.status <> 'ATIVA' THEN RAISE EXCEPTION 'Benefício exige matrícula ativa'; END IF;
  IF regra."permiteParticular" IS NOT TRUE OR NOT EXISTS (SELECT 1 FROM "ProdutoPais" o JOIN "DecisaoRegraBeneficioReposicaoOferta" d ON d."propostaId"=regra.id AND d.aprovada WHERE o.id=regra."produtoPaisId" AND o."produtoId"=m."produtoId" AND o."paisId"=m."paisId") THEN RAISE EXCEPTION 'Snapshot exige regra particular aprovada da oferta da matrícula'; END IF;
  IF NEW.referencia IS DISTINCT FROM regra.referencia OR NEW.unidade IS DISTINCT FROM regra.unidade OR NEW."duracaoPeriodo" IS DISTINCT FROM regra."duracaoPeriodo" OR NEW."quantidadePorPeriodo" IS DISTINCT FROM regra."quantidadePorPeriodo" OR NEW."antecedenciaCancelamentoMinutos" IS DISTINCT FROM regra."antecedenciaCancelamentoMinutos" THEN RAISE EXCEPTION 'Snapshot precisa copiar integralmente a regra aprovada'; END IF;
  IF (NEW.referencia='CICLO_MATRICULA' AND NEW."referenciaCiclo" IS NULL) OR (NEW.referencia='CIVIL' AND NEW."referenciaCiclo" IS NOT NULL) THEN RAISE EXCEPTION 'Snapshot exige data de referência explicitamente registrada somente para ciclo da matrícula'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_beneficio_reposicao_particular BEFORE INSERT OR UPDATE ON "BeneficioReposicaoParticularMatricula" FOR EACH ROW EXECUTE FUNCTION validar_beneficio_reposicao_particular();

CREATE OR REPLACE FUNCTION validar_excecao_agenda_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "ReposicaoIndividual"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Exceção de agenda é histórica e não pode ser apagada'; END IF;
  SELECT * INTO r FROM "ReposicaoIndividual" WHERE id=NEW."reposicaoId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."solicitanteId" FOR SHARE;
  IF r.id IS NULL OR u.id IS NULL OR r.modalidade <> 'PARTICULAR' OR NOT u.ativo OR NOT ('SECRETARIA_ACADEMICA'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Exceção exige reposição particular e Secretaria ativa'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_excecao_agenda_reposicao BEFORE INSERT OR UPDATE OR DELETE ON "ExcecaoAgendaReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION validar_excecao_agenda_reposicao();

CREATE OR REPLACE FUNCTION validar_decisao_excecao_agenda_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "ExcecaoAgendaReposicaoIndividual"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Decisão de exceção é histórica e não pode ser apagada'; END IF;
  SELECT * INTO p FROM "ExcecaoAgendaReposicaoIndividual" WHERE id=NEW."excecaoId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF p.id IS NULL OR u.id IS NULL OR p."solicitanteId"=NEW."decisorId" OR NOT u.ativo OR NOT ('GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Exceção exige decisão independente de gestão ativa'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_decisao_excecao_agenda_reposicao BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoExcecaoAgendaReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION validar_decisao_excecao_agenda_reposicao();

CREATE OR REPLACE FUNCTION periodo_beneficio_reposicao(data_agendada DATE, beneficio "BeneficioReposicaoParticularMatricula") RETURNS TABLE(inicio DATE, fim DATE) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE duracao INTEGER; base DATE; blocos INTEGER;
BEGIN
  duracao := beneficio."duracaoPeriodo";
  IF beneficio.unidade='DIAS' THEN
    IF beneficio.referencia='CIVIL' THEN base := date '2000-01-01' + (floor((data_agendada-date '2000-01-01')::numeric/duracao)::integer*duracao); ELSE IF data_agendada<beneficio."referenciaCiclo" THEN RAISE EXCEPTION 'Data anterior ao ciclo do benefício'; END IF; base := beneficio."referenciaCiclo" + (floor((data_agendada-beneficio."referenciaCiclo")::numeric/duracao)::integer*duracao); END IF;
    inicio:=base; fim:=base+duracao; RETURN NEXT; RETURN;
  END IF;
  IF beneficio.referencia='CIVIL' THEN
    blocos := floor(((extract(year from data_agendada)::integer-2000)*12 + extract(month from data_agendada)::integer-1)::numeric/duracao);
    base := (date '2000-01-01' + make_interval(months => blocos*duracao))::date;
  ELSE
    IF data_agendada < beneficio."referenciaCiclo" THEN RAISE EXCEPTION 'Data anterior ao ciclo do benefício'; END IF;
    blocos := floor(((extract(year from data_agendada)::integer-extract(year from beneficio."referenciaCiclo")::integer)*12 + extract(month from data_agendada)::integer-extract(month from beneficio."referenciaCiclo")::integer)::numeric/duracao);
    base := (beneficio."referenciaCiclo" + make_interval(months => blocos*duracao))::date;
    IF base > data_agendada THEN base := (beneficio."referenciaCiclo" + make_interval(months => (blocos-1)*duracao))::date; END IF;
  END IF;
  inicio:=base; fim:=(base + make_interval(months => duracao))::date; RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION validar_agenda_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "ReposicaoIndividual"%ROWTYPE; e "EncontroAgenda"%ROWTYPE; b "BeneficioReposicaoParticularMatricula"%ROWTYPE;
  u "Usuario"%ROWTYPE; data_agendada DATE; inicio_esperado DATE; fim_esperado DATE; ocupadas INTEGER; periodo_nao_letivo BOOLEAN; autorizacao_excepcional BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT * INTO r FROM "ReposicaoIndividual" WHERE id=NEW."reposicaoId" FOR SHARE;
  SELECT * INTO e FROM "EncontroAgenda" WHERE id=NEW."encontroId" FOR SHARE;
  SELECT * INTO b FROM "BeneficioReposicaoParticularMatricula" WHERE id=NEW."beneficioId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."reservadoPorId" FOR SHARE;
  IF r.id IS NULL OR e.id IS NULL OR u.id IS NULL OR r.modalidade <> 'PARTICULAR' OR e."reposicaoIndividualId" IS DISTINCT FROM r.id OR e.finalidade <> 'REPOSICAO' OR e."turmaId" IS NOT NULL OR e."matriculaId" IS DISTINCT FROM r."matriculaId" OR e.status <> 'PREVISTO' OR e.fim <= e.inicio OR NOT u.ativo OR NOT ('SECRETARIA_ACADEMICA'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Agenda exige encontro particular, pedido exato e Secretaria ativa'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId"=r.id AND aprovada) THEN RAISE EXCEPTION 'Agenda exige autorização aprovada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Matricula" WHERE id=r."matriculaId" AND status='ATIVA') THEN RAISE EXCEPTION 'Agenda exige matrícula ativa'; END IF;
  SELECT ((e.inicio AT TIME ZONE 'UTC') AT TIME ZONE c."fusoInstitucional")::date INTO data_agendada FROM "ConfiguracaoOperacional" c WHERE c.id='escola';
  SELECT EXISTS (SELECT 1 FROM "AutorizacaoExcecaoReposicaoParticular" x JOIN "DecisaoAutorizacaoExcecaoReposicaoParticular" d ON d."autorizacaoId"=x.id AND d.aprovada WHERE x.id=NEW."autorizacaoExcecaoId" AND x."reposicaoId"=r.id) INTO autorizacao_excepcional;
  IF b.id IS NULL THEN
    IF NOT autorizacao_excepcional OR NEW."statusBeneficio" <> 'ISENTA_EXCECAO' OR NEW."periodoInicio" IS NOT NULL OR NEW."periodoFimExclusivo" IS NOT NULL THEN RAISE EXCEPTION 'Particular sem benefício exige autorização excepcional específica'; END IF;
  ELSE
    IF NEW."autorizacaoExcecaoId" IS NOT NULL OR NEW."statusBeneficio" <> 'RESERVADA' OR data_agendada IS NULL OR b."matriculaId" IS DISTINCT FROM r."matriculaId" OR b."vigenteAPartirDe" > data_agendada OR b.id IS DISTINCT FROM (SELECT id FROM "BeneficioReposicaoParticularMatricula" WHERE "matriculaId"=r."matriculaId" AND "vigenteAPartirDe" <= data_agendada ORDER BY "vigenteAPartirDe" DESC LIMIT 1) THEN RAISE EXCEPTION 'Benefício explícito vigente não confere'; END IF;
    SELECT inicio, fim INTO inicio_esperado, fim_esperado FROM periodo_beneficio_reposicao(data_agendada,b);
    IF NEW."periodoInicio" IS DISTINCT FROM inicio_esperado OR NEW."periodoFimExclusivo" IS DISTINCT FROM fim_esperado THEN RAISE EXCEPTION 'Período do benefício não confere com a particular agendada'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('beneficio-reposicao:'||r."matriculaId"||':'||inicio_esperado::text,0));
    SELECT count(*) INTO ocupadas FROM "AgendaReposicaoIndividual" a JOIN "ReposicaoIndividual" ar ON ar.id=a."reposicaoId" JOIN "EncontroAgenda" agendado ON agendado.id=a."encontroId" JOIN "ConfiguracaoOperacional" conf ON conf.id='escola' WHERE ar."matriculaId"=r."matriculaId" AND a."statusBeneficio" IN ('RESERVADA','CONSUMIDA') AND ((agendado.inicio AT TIME ZONE 'UTC') AT TIME ZONE conf."fusoInstitucional")::date >= inicio_esperado AND ((agendado.inicio AT TIME ZONE 'UTC') AT TIME ZONE conf."fusoInstitucional")::date < fim_esperado;
    IF ocupadas >= b."quantidadePorPeriodo" THEN RAISE EXCEPTION 'Benefício de reposição sem saldo no período'; END IF;
  END IF;
  SELECT EXISTS (SELECT 1 FROM "VersaoCalendarioEscolar" v JOIN "DecisaoCalendarioEscolar" d ON d."calendarioId"=v.id AND d.aprovada CROSS JOIN LATERAL jsonb_to_recordset(v.periodos) AS p(id TEXT, inicio DATE, fim DATE) WHERE p.inicio <= (((e.fim - interval '1 millisecond') AT TIME ZONE 'UTC') AT TIME ZONE v."fusoInstitucional")::date AND p.fim >= data_agendada) INTO periodo_nao_letivo;
  IF periodo_nao_letivo AND NOT EXISTS (SELECT 1 FROM "ExcecaoAgendaReposicaoIndividual" x JOIN "DecisaoExcecaoAgendaReposicaoIndividual" d ON d."excecaoId"=x.id AND d.aprovada WHERE x.id=NEW."excecaoId" AND x."reposicaoId"=r.id AND x."professorId"=e."professorId" AND x.inicio=e.inicio AND x.fim=e.fim AND x."fusoOrigem"=e."fusoOrigem") THEN RAISE EXCEPTION 'Dia não letivo exige exceção aprovada para este encontro'; END IF;
  IF NOT periodo_nao_letivo AND NEW."excecaoId" IS NOT NULL THEN RAISE EXCEPTION 'Exceção só é válida para o intervalo não letivo correspondente'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER validar_agenda_reposicao_individual AFTER INSERT OR UPDATE ON "AgendaReposicaoIndividual" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_agenda_reposicao_individual();

CREATE OR REPLACE FUNCTION validar_encontro_reposicao_individual_agendado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.finalidade='REPOSICAO' THEN
    IF NEW."reposicaoIndividualId" IS NULL OR NOT EXISTS (SELECT 1 FROM "AgendaReposicaoIndividual" a WHERE a."reposicaoId"=NEW."reposicaoIndividualId" AND a."encontroId"=NEW.id) THEN RAISE EXCEPTION 'Encontro REPOSICAO exige agenda vinculada ao pedido específico'; END IF;
  ELSIF NEW."reposicaoIndividualId" IS NOT NULL THEN RAISE EXCEPTION 'Somente encontro REPOSICAO pode vincular pedido individual'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER validar_encontro_reposicao_individual_agendado AFTER INSERT OR UPDATE ON "EncontroAgenda" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_encontro_reposicao_individual_agendado();

CREATE OR REPLACE FUNCTION consumir_beneficio_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE aluno TEXT;
BEGIN
  IF OLD.finalidade='REPOSICAO' AND OLD.status='PREVISTO' AND NEW.status='MINISTRADO' THEN
    SELECT m."alunoId" INTO aluno FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id=r."matriculaId" WHERE r.id=NEW."reposicaoIndividualId";
    IF aluno IS NULL OR NOT EXISTS (SELECT 1 FROM "AulaDiario" d JOIN "RegistroAulaAluno" registro ON registro."aulaId"=d.id WHERE d."encontroId"=NEW.id AND registro."alunoId"=aluno AND registro.participacao IN ('PRESENTE','FALTA')) THEN RAISE EXCEPTION 'Reposição ministrada exige diário e participação do aluno'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "AgendaReposicaoIndividual" WHERE "encontroId"=NEW.id AND "statusBeneficio"='ISENTA_EXCECAO') THEN
      UPDATE "AgendaReposicaoIndividual" SET "statusBeneficio"='CONSUMIDA', "consumidaEm"=CURRENT_TIMESTAMP WHERE "encontroId"=NEW.id AND "statusBeneficio"='RESERVADA';
      IF NOT FOUND THEN RAISE EXCEPTION 'Benefício reservado não encontrado para encontro de reposição'; END IF;
    END IF;
  ELSIF OLD.finalidade='REPOSICAO' AND OLD.status='PREVISTO' AND NEW.status='CANCELADO' THEN
    RAISE EXCEPTION 'Cancelamento de reposição exige fluxo acadêmico específico de devolução';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER consumir_beneficio_reposicao_individual BEFORE UPDATE OF status ON "EncontroAgenda" FOR EACH ROW EXECUTE FUNCTION consumir_beneficio_reposicao_individual();

-- A conclusão particular só pode usar o encontro que a agenda vinculou ao
-- pedido, inclusive quando alguém tentar inserir fonte diretamente no banco.
CREATE OR REPLACE FUNCTION validar_conclusao_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE modalidade "ModalidadeReposicaoIndividual"; aluno_contrato TEXT; fim_origem TIMESTAMP(3); fim_encontro TIMESTAMP(3); presente "ParticipacaoAula";
BEGIN
  SELECT r.modalidade, m."alunoId", origem.fim INTO modalidade, aluno_contrato, fim_origem FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id=r."matriculaId" JOIN "EncontroAgenda" origem ON origem.id=r."aulaOriginalId" WHERE r.id=NEW."reposicaoId";
  IF NOT EXISTS (SELECT 1 FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId"=NEW."reposicaoId" AND aprovada) OR NEW.concluida IS NOT TRUE THEN RAISE EXCEPTION 'Conclusão exige autorização aprovada e estado concluído'; END IF;
  IF modalidade='PARTICULAR' THEN
    SELECT e.fim, registro.participacao INTO fim_encontro,presente FROM "EncontroAgenda" e LEFT JOIN "AulaDiario" diario ON diario."encontroId"=e.id LEFT JOIN "RegistroAulaAluno" registro ON registro."aulaId"=diario.id AND registro."alunoId"=aluno_contrato WHERE e.id=NEW."encontroReposicaoId" AND e.finalidade='REPOSICAO' AND e.status='MINISTRADO';
    IF NEW."encontroReposicaoId" IS NULL OR NOT EXISTS (SELECT 1 FROM "AgendaReposicaoIndividual" a WHERE a."reposicaoId"=NEW."reposicaoId" AND a."encontroId"=NEW."encontroReposicaoId") OR NEW."realizadaEm" IS NULL OR NEW."entregaId" IS NOT NULL OR NEW."validadaEm" IS NOT NULL OR NEW."validadaPorId" IS NOT NULL OR fim_encontro IS NULL OR fim_encontro<>NEW."realizadaEm" OR fim_encontro<fim_origem OR presente<>'PRESENTE' THEN RAISE EXCEPTION 'Particular exige encontro próprio agendado, diário presente e data posterior à aula original'; END IF;
  ELSE
    IF NEW."encontroReposicaoId" IS NOT NULL OR NEW."realizadaEm" IS NOT NULL OR NEW."entregaId" IS NULL OR NEW."validadaEm" IS NULL OR NEW."validadaPorId" IS NULL OR NOT EXISTS (SELECT 1 FROM "EntregaReposicaoGravacao" WHERE id=NEW."entregaId" AND "reposicaoId"=NEW."reposicaoId" AND "entregueEm"<=NEW."validadaEm") OR NEW."validadaEm"<fim_origem OR NOT EXISTS (SELECT 1 FROM "DesignacaoAvaliadorReposicaoIndividual" d JOIN "Usuario" u ON u.id=d."professorId" AND u.ativo WHERE d."reposicaoId"=NEW."reposicaoId" AND d."professorId"=NEW."validadaPorId" AND d.inicio<=NEW."validadaEm" AND (d.fim IS NULL OR d.fim>NEW."validadaEm")) THEN RAISE EXCEPTION 'Gravação exige entrega e validação do docente designado ativo'; END IF;
  END IF;
  IF btrim(NEW.evidencia)='' THEN RAISE EXCEPTION 'Conclusão exige evidência'; END IF; RETURN NEW;
END $$;
