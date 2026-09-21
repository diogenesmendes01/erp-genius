-- Q157 (decisão de 21/09/2026): correção versionada, com aprovação independente, do período
-- de um relato de falta de oferta JÁ CONFIRMADO. O relato passa a refletir a última correção
-- aprovada (todos os consumidores, TS e SQL, leem o período vigente); cada versão preserva o
-- período anterior e o novo, e motivo/evidência/autoria originais nunca mudam.
-- CreateTable
CREATE TABLE "PropostaCorrecaoRelatoIndisponibilidadeOferta" (
    "id" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "inicioAnterior" DATE NOT NULL,
    "fimAnterior" DATE,
    "inicioNovo" DATE NOT NULL,
    "fimNovo" DATE,
    "motivo" TEXT NOT NULL,
    "evidenciaTexto" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaCorrecaoRelatoIndisponibilidadeOferta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoCorrecaoRelatoIndisponibilidadeOferta" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidenciaTexto" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoCorrecaoRelatoIndisponibilidadeOferta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaCorrecaoRelatoIndisponibilidadeOferta_registroId_ve_key" ON "PropostaCorrecaoRelatoIndisponibilidadeOferta"("registroId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaCorrecaoRelatoIndisponibilidadeOferta_autorId_chave_key" ON "PropostaCorrecaoRelatoIndisponibilidadeOferta"("autorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoCorrecaoRelatoIndisponibilidadeOferta_propostaId_key" ON "DecisaoCorrecaoRelatoIndisponibilidadeOferta"("propostaId");

-- AddForeignKey
ALTER TABLE "PropostaCorrecaoRelatoIndisponibilidadeOferta" ADD CONSTRAINT "PropostaCorrecaoRelatoIndisponibilidadeOferta_registroId_fkey" FOREIGN KEY ("registroId") REFERENCES "RegistroIndisponibilidadeOfertaMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaCorrecaoRelatoIndisponibilidadeOferta" ADD CONSTRAINT "PropostaCorrecaoRelatoIndisponibilidadeOferta_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoCorrecaoRelatoIndisponibilidadeOferta" ADD CONSTRAINT "DecisaoCorrecaoRelatoIndisponibilidadeOferta_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaCorrecaoRelatoIndisponibilidadeOferta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoCorrecaoRelatoIndisponibilidadeOferta" ADD CONSTRAINT "DecisaoCorrecaoRelatoIndisponibilidadeOferta_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


-- Dias que deixariam de estar cobertos pelo relato não podem já sustentar compensação
-- aprovada nem período integral aprovado: esses efeitos precisam ser tratados antes.
CREATE FUNCTION dias_removidos_correcao_relato_oferta_157(ini_ant date, fim_ant date, ini_novo date, fim_novo date)
RETURNS TABLE(inicio date, fim date) LANGUAGE sql IMMUTABLE AS $$
  SELECT ini_ant, LEAST(COALESCE(fim_ant, DATE '9999-12-31'), ini_novo - 1) WHERE ini_novo > ini_ant
  UNION ALL
  SELECT GREATEST(ini_ant, fim_novo + 1), COALESCE(fim_ant, DATE '9999-12-31')
    WHERE fim_novo IS NOT NULL AND fim_novo < COALESCE(fim_ant, DATE '9999-12-31')
$$;

CREATE FUNCTION validar_proposta_correcao_relato_oferta_157() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "RegistroIndisponibilidadeOfertaMatricula"%ROWTYPE; u "Usuario"%ROWTYPE; termino date;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Propostas de correção do relato são preservadas.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM m.id FROM "Matricula" m JOIN "RegistroIndisponibilidadeOfertaMatricula" registro ON registro."matriculaId" = m.id
    WHERE registro.id = NEW."registroId" FOR UPDATE OF m;
  SELECT * INTO r FROM "RegistroIndisponibilidadeOfertaMatricula" WHERE id = NEW."registroId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Relato de indisponibilidade não encontrado.'; END IF;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['SECRETARIA_ACADEMICA','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Sem permissão para propor correção do relato.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "ConfirmacaoIndisponibilidadeOfertaMatricula" c WHERE c."registroId" = r.id AND c.confirmada) THEN
    RAISE EXCEPTION 'Somente relato confirmado admite correção de período.';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaCorrecaoRelatoIndisponibilidadeOferta" p
             LEFT JOIN "DecisaoCorrecaoRelatoIndisponibilidadeOferta" d ON d."propostaId" = p.id
             WHERE p."registroId" = r.id AND d.id IS NULL) THEN
    RAISE EXCEPTION 'Já existe correção aguardando decisão para este relato.';
  END IF;
  IF NEW.versao <> COALESCE((SELECT max(versao) FROM "PropostaCorrecaoRelatoIndisponibilidadeOferta" WHERE "registroId" = r.id), 0) + 1 THEN
    RAISE EXCEPTION 'Versão da correção fora de sequência.';
  END IF;
  IF NEW."inicioAnterior" <> r.inicio OR NEW."fimAnterior" IS DISTINCT FROM r.fim THEN
    RAISE EXCEPTION 'O período atual do relato mudou; atualize a proposta.';
  END IF;
  IF NEW."inicioNovo" = r.inicio AND NEW."fimNovo" IS NOT DISTINCT FROM r.fim THEN
    RAISE EXCEPTION 'A correção não altera o período do relato.';
  END IF;
  -- Relato aberto termina pelo fluxo de término (Q156); a correção só trata fim já informado no relato.
  IF r.fim IS NULL AND NEW."fimNovo" IS NOT NULL THEN
    RAISE EXCEPTION 'Relato aberto encerra pelo término aprovado, não pela correção.';
  END IF;
  IF r.fim IS NOT NULL AND NEW."fimNovo" IS NULL THEN
    RAISE EXCEPTION 'A correção não reabre um relato encerrado.';
  END IF;
  SELECT t.fim INTO termino FROM "PropostaTerminoIndisponibilidadeOferta" t
    JOIN "DecisaoTerminoIndisponibilidadeOferta" dt ON dt."propostaId" = t.id AND dt.aprovada WHERE t."registroId" = r.id LIMIT 1;
  IF NEW."inicioNovo" < DATE '0001-01-01' OR NEW."inicioNovo" > COALESCE(NEW."fimNovo", termino, DATE '9999-12-31') THEN
    RAISE EXCEPTION 'O início corrigido não pode ultrapassar o fim vigente do relato.';
  END IF;
  IF length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."evidenciaTexto")) NOT BETWEEN 5 AND 4000
     OR length(trim(NEW."chaveIdempotencia")) NOT BETWEEN 8 AND 100 OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Motivo, evidência, chave ou hash da correção inválidos.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_proposta_correcao_relato_oferta_157
BEFORE INSERT OR UPDATE OR DELETE ON "PropostaCorrecaoRelatoIndisponibilidadeOferta"
FOR EACH ROW EXECUTE FUNCTION validar_proposta_correcao_relato_oferta_157();

CREATE FUNCTION validar_decisao_correcao_relato_oferta_157() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaCorrecaoRelatoIndisponibilidadeOferta"%ROWTYPE; r "RegistroIndisponibilidadeOfertaMatricula"%ROWTYPE; u "Usuario"%ROWTYPE; termino date;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisões de correção do relato são preservadas.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO p FROM "PropostaCorrecaoRelatoIndisponibilidadeOferta" WHERE id = NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de correção não encontrada.'; END IF;
  PERFORM m.id FROM "Matricula" m JOIN "RegistroIndisponibilidadeOfertaMatricula" registro ON registro."matriculaId" = m.id
    WHERE registro.id = p."registroId" FOR UPDATE OF m;
  SELECT * INTO r FROM "RegistroIndisponibilidadeOfertaMatricula" WHERE id = p."registroId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
  IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Sem permissão para decidir correção do relato.';
  END IF;
  IF NEW."decisorId" = p."autorId" THEN RAISE EXCEPTION 'Outra pessoa deve decidir a correção do relato.'; END IF;
  IF length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."evidenciaTexto")) NOT BETWEEN 5 AND 4000 OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Motivo, evidência ou hash da decisão inválidos.';
  END IF;
  IF NOT NEW.aprovada THEN RETURN NEW; END IF;
  IF p."inicioAnterior" <> r.inicio OR p."fimAnterior" IS DISTINCT FROM r.fim THEN
    RAISE EXCEPTION 'O período do relato mudou depois da proposta; prepare nova correção.';
  END IF;
  SELECT t.fim INTO termino FROM "PropostaTerminoIndisponibilidadeOferta" t
    JOIN "DecisaoTerminoIndisponibilidadeOferta" dt ON dt."propostaId" = t.id AND dt.aprovada WHERE t."registroId" = r.id LIMIT 1;
  IF p."inicioNovo" > COALESCE(p."fimNovo", termino, DATE '9999-12-31') THEN
    RAISE EXCEPTION 'O início corrigido ultrapassa o fim vigente do relato.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM dias_removidos_correcao_relato_oferta_157(r.inicio, COALESCE(r.fim, termino), p."inicioNovo", COALESCE(p."fimNovo", termino)) removido
    JOIN "DiaCompensacaoCobertura" dia ON dia."matriculaId" = r."matriculaId" AND dia."diaOrigem" BETWEEN removido.inicio AND removido.fim
    JOIN "CompensacaoCoberturaMatricula" c ON c.id = dia."compensacaoId" AND c.status = 'APROVADA'
  ) THEN
    RAISE EXCEPTION 'A correção retira dias que já sustentam compensação aprovada. Trate a compensação antes.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM dias_removidos_correcao_relato_oferta_157(r.inicio, COALESCE(r.fim, termino), p."inicioNovo", COALESCE(p."fimNovo", termino)) removido
    JOIN "PropostaPeriodoIntegral" pi ON pi."matriculaId" = r."matriculaId"
    JOIN "DecisaoPeriodoIntegral" dpi ON dpi."propostaId" = pi.id AND dpi.aprovada
    JOIN "Cobranca" cob ON cob.id = pi."cobrancaId"
    WHERE cob."coberturaInicio" <= removido.fim AND cob."coberturaFim" >= removido.inicio
  ) THEN
    RAISE EXCEPTION 'A correção retira dias de um período integral já aprovado. Trate o período integral antes.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_decisao_correcao_relato_oferta_157
BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoCorrecaoRelatoIndisponibilidadeOferta"
FOR EACH ROW EXECUTE FUNCTION validar_decisao_correcao_relato_oferta_157();

-- O relato continua preservado: a única mutação aceita é a aplicação do período de uma
-- correção aprovada, a mais recente, partindo exatamente do período que ela fotografou.
CREATE OR REPLACE FUNCTION validar_registro_indisponibilidade_oferta_matricula() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'inicio' - 'fim') IS DISTINCT FROM (to_jsonb(OLD) - 'inicio' - 'fim') THEN
      RAISE EXCEPTION 'Relatos de indisponibilidade da oferta são preservados.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "PropostaCorrecaoRelatoIndisponibilidadeOferta" p
      JOIN "DecisaoCorrecaoRelatoIndisponibilidadeOferta" d ON d."propostaId" = p.id AND d.aprovada
      WHERE p."registroId" = OLD.id
        AND p.versao = (SELECT max(versao) FROM "PropostaCorrecaoRelatoIndisponibilidadeOferta" WHERE "registroId" = OLD.id)
        AND p."inicioAnterior" = OLD.inicio AND p."fimAnterior" IS NOT DISTINCT FROM OLD.fim
        AND p."inicioNovo" = NEW.inicio AND p."fimNovo" IS NOT DISTINCT FROM NEW.fim
    ) THEN
      RAISE EXCEPTION 'Relatos de indisponibilidade da oferta são preservados.';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Relatos de indisponibilidade da oferta são preservados.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula não encontrada.'; END IF;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['SECRETARIA_ACADEMICA','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Sem permissão para relatar indisponibilidade da oferta.';
  END IF;
  IF NEW.fim IS NOT NULL AND NEW.fim < NEW.inicio THEN
    RAISE EXCEPTION 'O fim da indisponibilidade não pode preceder o início.';
  END IF;
  IF length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."evidenciaTexto")) NOT BETWEEN 5 AND 4000 THEN
    RAISE EXCEPTION 'Motivo ou evidência da indisponibilidade inválidos.';
  END IF;
  IF length(trim(NEW."chaveIdempotencia")) NOT BETWEEN 8 AND 100 OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Chave de idempotência ou hash do relato inválido.';
  END IF;
  RETURN NEW;
END $$;
