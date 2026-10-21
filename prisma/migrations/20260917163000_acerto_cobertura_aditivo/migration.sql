-- 238: Q168/Q169. Coberturas de mensalidades são corrigidas somente por conjunto
-- completo, independente e ligado à versão formalizada do aditivo.
CREATE TYPE "EscolhaCicloCoberturaAditivo" AS ENUM ('PRESERVAR_REFERENCIA', 'MUDAR_REFERENCIA');
CREATE TYPE "ClassificacaoImpactoCoberturaAditivo" AS ENUM ('AFETADA', 'PRESERVADA');
CREATE TYPE "StatusConjuntoImpactosCoberturaAditivo" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'COMPLETO', 'OBSOLETO');

CREATE TABLE "ConjuntoImpactosCoberturaAditivo" (
 "id" TEXT NOT NULL, "matriculaId" TEXT NOT NULL, "propostaAditivoId" TEXT NOT NULL, "conferenciaFinalId" TEXT NOT NULL, "versaoCondicoesId" TEXT NOT NULL,
 "preparadorId" TEXT NOT NULL, "escolhaCiclo" "EscolhaCicloCoberturaAditivo" NOT NULL, "cicloFuturo" JSONB NOT NULL, "hashFormalizado" TEXT NOT NULL,
 "fotografia" JSONB NOT NULL, "fotografiaHash" TEXT NOT NULL, "motivo" TEXT NOT NULL, "evidencia" TEXT NOT NULL, "chaveIdempotencia" TEXT NOT NULL,
 "status" "StatusConjuntoImpactosCoberturaAditivo" NOT NULL DEFAULT 'PENDENTE', "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ConjuntoImpactosCoberturaAditivo_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ConjuntoImpactosCoberturaAditivo_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "ConjuntoImpactosCoberturaAditivo_propostaAditivoId_fkey" FOREIGN KEY ("propostaAditivoId") REFERENCES "PropostaAditivoContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "ConjuntoImpactosCoberturaAditivo_conferenciaFinalId_fkey" FOREIGN KEY ("conferenciaFinalId") REFERENCES "ConferenciaFinalAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "ConjuntoImpactosCoberturaAditivo_versaoCondicoesId_fkey" FOREIGN KEY ("versaoCondicoesId") REFERENCES "VersaoCondicoesAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "ConjuntoImpactosCoberturaAditivo_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "ConjuntoImpactosCoberturaAditivo_preparadorId_chaveIdempotencia_key" ON "ConjuntoImpactosCoberturaAditivo"("preparadorId", "chaveIdempotencia");
CREATE INDEX "ConjuntoImpactosCoberturaAditivo_propostaAditivoId_fotografiaHash_idx" ON "ConjuntoImpactosCoberturaAditivo"("propostaAditivoId", "fotografiaHash");
CREATE INDEX "ConjuntoImpactosCoberturaAditivo_matriculaId_criadaEm_idx" ON "ConjuntoImpactosCoberturaAditivo"("matriculaId", "criadaEm");
CREATE UNIQUE INDEX "ConjuntoImpactosCoberturaAditivo_propostaAditivoId_ativo_key" ON "ConjuntoImpactosCoberturaAditivo"("propostaAditivoId") WHERE "status" IN ('PENDENTE','APROVADO','COMPLETO');

CREATE TABLE "DecisaoConjuntoImpactosCoberturaAditivo" (
 "id" TEXT NOT NULL, "conjuntoId" TEXT NOT NULL, "decisorId" TEXT NOT NULL, "aprovada" BOOLEAN NOT NULL, "motivo" TEXT NOT NULL, "fotografiaHash" TEXT NOT NULL, "chaveIdempotencia" TEXT NOT NULL, "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DecisaoConjuntoImpactosCoberturaAditivo_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "DecisaoConjuntoImpactosCoberturaAditivo_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "ConjuntoImpactosCoberturaAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "DecisaoConjuntoImpactosCoberturaAditivo_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "DecisaoConjuntoImpactosCoberturaAditivo_conjuntoId_key" ON "DecisaoConjuntoImpactosCoberturaAditivo"("conjuntoId");
CREATE UNIQUE INDEX "DecisaoConjuntoImpactosCoberturaAditivo_decisorId_chaveIdempotencia_key" ON "DecisaoConjuntoImpactosCoberturaAditivo"("decisorId", "chaveIdempotencia");

CREATE TABLE "ImpactoCoberturaAditivo" (
 "id" TEXT NOT NULL, "conjuntoId" TEXT NOT NULL, "cobrancaId" TEXT NOT NULL, "classificacao" "ClassificacaoImpactoCoberturaAditivo" NOT NULL,
 "coberturaInicioAnterior" DATE, "coberturaFimAnterior" DATE, "coberturaInicioNova" DATE, "coberturaFimNova" DATE,
 "justificativa" TEXT NOT NULL, "versaoCobranca" INTEGER NOT NULL,
 CONSTRAINT "ImpactoCoberturaAditivo_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ImpactoCoberturaAditivo_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "ConjuntoImpactosCoberturaAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "ImpactoCoberturaAditivo_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "ImpactoCoberturaAditivo_conjuntoId_cobrancaId_key" ON "ImpactoCoberturaAditivo"("conjuntoId", "cobrancaId");
CREATE INDEX "ImpactoCoberturaAditivo_cobrancaId_idx" ON "ImpactoCoberturaAditivo"("cobrancaId");

CREATE TABLE "AplicacaoCoberturaAditivo" (
 "id" TEXT NOT NULL, "impactoId" TEXT NOT NULL, "cobrancaId" TEXT NOT NULL, "executorId" TEXT NOT NULL, "fotografiaHash" TEXT NOT NULL, "chaveIdempotencia" TEXT NOT NULL,
 "versaoCobrancaAntes" INTEGER NOT NULL, "versaoCobrancaDepois" INTEGER NOT NULL,
 "coberturaInicioAnterior" DATE NOT NULL, "coberturaFimAnterior" DATE NOT NULL, "coberturaInicioNova" DATE NOT NULL, "coberturaFimNova" DATE NOT NULL, "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AplicacaoCoberturaAditivo_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AplicacaoCoberturaAditivo_impactoId_fkey" FOREIGN KEY ("impactoId") REFERENCES "ImpactoCoberturaAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "AplicacaoCoberturaAditivo_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "AplicacaoCoberturaAditivo_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "AplicacaoCoberturaAditivo_impactoId_key" ON "AplicacaoCoberturaAditivo"("impactoId");
CREATE UNIQUE INDEX "AplicacaoCoberturaAditivo_executorId_chaveIdempotencia_key" ON "AplicacaoCoberturaAditivo"("executorId", "chaveIdempotencia");
CREATE INDEX "AplicacaoCoberturaAditivo_cobrancaId_idx" ON "AplicacaoCoberturaAditivo"("cobrancaId");

CREATE FUNCTION conferir_linhas_conjunto_cobertura_238(conjunto_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE conjunto "ConjuntoImpactosCoberturaAditivo"%ROWTYPE; total_mensalidades integer; total_linhas integer;
BEGIN
 SELECT * INTO conjunto FROM "ConjuntoImpactosCoberturaAditivo" WHERE id=conjunto_id FOR SHARE;
 IF conjunto.id IS NULL THEN RAISE EXCEPTION 'Conjunto de cobertura indisponível'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "VersaoCondicoesAditivo" v JOIN "ConferenciaFinalAditivo" f ON f.id=conjunto."conferenciaFinalId" JOIN "PropostaAditivoContratual" p ON p.id=conjunto."propostaAditivoId" WHERE v.id=conjunto."versaoCondicoesId" AND v."matriculaId"=conjunto."matriculaId" AND v."propostaId"=p.id AND f.id=v."conferenciaFinalId" AND p."matriculaId"=conjunto."matriculaId" AND p."entradaHash"=conjunto."hashFormalizado" AND conjunto."cicloFuturo"=p.snapshot->'entrada'->'cicloCoberturaFutura' AND conjunto."escolhaCiclo"=(p.snapshot->'entrada'->'cicloCoberturaFutura'->>'escolha')::"EscolhaCicloCoberturaAditivo") THEN RAISE EXCEPTION 'Conjunto diverge da formalização assinada'; END IF;
 SELECT count(*) INTO total_mensalidades FROM "Cobranca" WHERE "matriculaId"=conjunto."matriculaId" AND tipo='MENSALIDADE';
 SELECT count(*) INTO total_linhas FROM "ImpactoCoberturaAditivo" WHERE "conjuntoId"=conjunto.id;
 IF total_mensalidades<>total_linhas OR EXISTS(SELECT 1 FROM "Cobranca" b WHERE b."matriculaId"=conjunto."matriculaId" AND b.tipo='MENSALIDADE' AND NOT EXISTS(SELECT 1 FROM "ImpactoCoberturaAditivo" i WHERE i."conjuntoId"=conjunto.id AND i."cobrancaId"=b.id)) OR EXISTS(SELECT 1 FROM "ImpactoCoberturaAditivo" i LEFT JOIN "Cobranca" b ON b.id=i."cobrancaId" AND b."matriculaId"=conjunto."matriculaId" AND b.tipo='MENSALIDADE' WHERE i."conjuntoId"=conjunto.id AND b.id IS NULL) THEN RAISE EXCEPTION 'Conjunto deve classificar exatamente as mensalidades existentes'; END IF;
 IF EXISTS(SELECT 1 FROM "ImpactoCoberturaAditivo" i WHERE i."conjuntoId"=conjunto.id AND (length(btrim(i.justificativa))<5 OR (i.classificacao='AFETADA' AND (i."coberturaInicioAnterior" IS NULL OR i."coberturaFimAnterior" IS NULL OR i."coberturaInicioNova" IS NULL OR i."coberturaFimNova" IS NULL)))) THEN RAISE EXCEPTION 'Impacto de cobertura incompleto'; END IF;
END $$;

CREATE FUNCTION proteger_decisao_cobertura_238() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "ConjuntoImpactosCoberturaAditivo"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão é imutável'; END IF;
 SELECT * INTO c FROM "ConjuntoImpactosCoberturaAditivo" WHERE id=NEW."conjuntoId" FOR UPDATE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
 IF c.id IS NULL OR c.status<>'PENDENTE' OR NEW."fotografiaHash"<>c."fotografiaHash" OR NEW."decisorId"=c."preparadorId" THEN RAISE EXCEPTION 'Decisão não corresponde ao conjunto pendente'; END IF;
 IF NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) THEN RAISE EXCEPTION 'Decisor sem alçada vigente'; END IF; RETURN NEW;
END $$;
-- 234: Q170 reconhece conjunto completo, nunca acerto de uma cobrança isolada.
CREATE OR REPLACE FUNCTION conferir_campos_aplicacao_direta_231(versao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE atual "VersaoCondicoesAditivo"%ROWTYPE; origem "VersaoCondicoesAditivo"%ROWTYPE; campo TEXT;
BEGIN
 SELECT * INTO atual FROM "VersaoCondicoesAditivo" WHERE id=versao_id;
 IF atual.id IS NULL THEN RAISE EXCEPTION 'Versão indisponível'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PropostaAditivoContratual" p, LATERAL jsonb_array_elements(p.snapshot->'entrada'->'alteracoes') a WHERE p.id=atual."propostaId" AND a->>'origem'=ANY(ARRAY['ALUNO_NOME','ALUNO_DOCUMENTO','ALUNO_EMAIL','ALUNO_ENDERECO','PAGADOR_NOME','PAGADOR_DOCUMENTO','PAGADOR_EMAIL','PAGADOR_ENDERECO','MENSALIDADE_VALOR','HORA_VALOR','AGENDA_PARTICULAR'])) THEN RAISE EXCEPTION 'A proposta contém somente condições com aplicação própria'; END IF;
 FOR campo IN SELECT jsonb_object_keys(atual.condicoes) LOOP
   WITH RECURSIVE cadeia AS (
     SELECT v.* FROM "VersaoCondicoesAditivo" v WHERE v.id=atual.id
     UNION ALL SELECT anterior.* FROM "VersaoCondicoesAditivo" anterior JOIN cadeia c ON anterior.id=c."anteriorId" AND anterior."matriculaId"=c."matriculaId" AND anterior.versao=c.versao-1
   ) SELECT c.* INTO origem FROM cadeia c JOIN "PropostaAditivoContratual" p ON p.id=c."propostaId" AND p."matriculaId"=c."matriculaId"
   WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(p.snapshot->'entrada'->'alteracoes') a WHERE a->>'origem'=campo AND a->'valorEstruturado'=atual.condicoes->campo)
   AND NOT EXISTS(SELECT 1 FROM cadeia nova JOIN "PropostaAditivoContratual" np ON np.id=nova."propostaId" WHERE nova.versao>c.versao AND EXISTS(SELECT 1 FROM jsonb_array_elements(np.snapshot->'entrada'->'alteracoes') na WHERE na->>'origem'=campo))
   ORDER BY c.versao DESC LIMIT 1;
   IF origem.id IS NULL THEN RAISE EXCEPTION 'Origem explícita do campo divergente'; END IF;
   IF campo='PRIMEIRA_MENSALIDADE_VENCIMENTO' THEN
     IF NOT EXISTS(SELECT 1 FROM "AplicacaoVencimentoAditivo" a JOIN "DecisaoVencimentoAditivo" d ON d.id=a."decisaoId" AND d.aprovada JOIN "PropostaVencimentoAditivo" p ON p.id=d."propostaId" WHERE p."versaoCondicoesId"=origem.id AND p."propostaAditivoId"=origem."propostaId" AND p."matriculaId"=atual."matriculaId") THEN RAISE EXCEPTION 'Vencimento exige aplicação própria'; END IF;
   ELSIF campo = ANY(ARRAY['COBERTURA_INICIO','COBERTURA_FIM']) THEN
     IF NOT EXISTS (
       SELECT 1 FROM "ConjuntoImpactosCoberturaAditivo" c
       JOIN "DecisaoConjuntoImpactosCoberturaAditivo" d ON d."conjuntoId"=c.id AND d.aprovada AND d."decisorId"<>c."preparadorId" AND d."fotografiaHash"=c."fotografiaHash"
       WHERE c.status='COMPLETO' AND c."versaoCondicoesId"=origem.id AND c."propostaAditivoId"=origem."propostaId" AND c."matriculaId"=atual."matriculaId"
     ) THEN RAISE EXCEPTION 'Cobertura exige conjunto de impactos completo'; END IF;
   ELSIF campo = ANY(ARRAY['TAXA_VALOR','TAXA_VENCIMENTO']) THEN
     IF NOT EXISTS (
       SELECT 1 FROM "ConjuntoImpactosTaxaAditivo" c
       JOIN "DecisaoConjuntoImpactosTaxaAditivo" d ON d."conjuntoId"=c.id AND d.aprovada AND d."fotografiaHash"=c."fotografiaHash" AND d."decisorId"<>c."preparadorId"
       WHERE c.status='COMPLETO' AND c."versaoCondicoesId"=origem.id
         AND c."propostaAditivoId"=origem."propostaId" AND c."matriculaId"=atual."matriculaId"
     ) THEN RAISE EXCEPTION 'Taxa exige conjunto de impactos completo'; END IF;
   ELSIF campo = ANY(ARRAY['ALUNO_NOME','ALUNO_DOCUMENTO','ALUNO_EMAIL','ALUNO_ENDERECO','PAGADOR_NOME','PAGADOR_DOCUMENTO','PAGADOR_EMAIL','PAGADOR_ENDERECO','MENSALIDADE_VALOR','HORA_VALOR','AGENDA_PARTICULAR']) THEN
     IF origem.id<>atual.id AND NOT EXISTS(SELECT 1 FROM "AplicacaoCondicoesAditivo" a WHERE a."versaoCondicoesId"=origem.id AND a."condicoesHash"=origem."condicoesHash" AND a."matriculaId"=atual."matriculaId") THEN RAISE EXCEPTION 'Campo herdado aguarda aplicação da origem'; END IF;
   ELSE RAISE EXCEPTION 'Condição financeira exige fluxo próprio antes da aplicação';
   END IF;
 END LOOP;
END $$;


-- Reforço 238: a aplicação prova exatamente o impacto aprovado; a transação não
-- pode persistir com apenas parte das mensalidades afetadas aplicada.
CREATE FUNCTION proteger_aplicacao_cobertura_238() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i "ImpactoCoberturaAditivo"%ROWTYPE; c "ConjuntoImpactosCoberturaAditivo"%ROWTYPE; cobr "Cobranca"%ROWTYPE; u "Usuario"%ROWTYPE; d "DecisaoConjuntoImpactosCoberturaAditivo"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Aplicação é imutável'; END IF;
 SELECT * INTO i FROM "ImpactoCoberturaAditivo" WHERE id=NEW."impactoId" FOR SHARE; SELECT * INTO c FROM "ConjuntoImpactosCoberturaAditivo" WHERE id=i."conjuntoId" FOR SHARE; SELECT * INTO d FROM "DecisaoConjuntoImpactosCoberturaAditivo" WHERE "conjuntoId"=c.id FOR SHARE; SELECT * INTO cobr FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR SHARE; SELECT * INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
 IF i.id IS NULL OR c.status<>'APROVADO' OR i.classificacao<>'AFETADA' OR d.id IS NULL OR NOT d.aprovada OR d."decisorId"<>NEW."executorId" OR NEW."executorId"=c."preparadorId" OR NEW."cobrancaId"<>i."cobrancaId" OR NEW."fotografiaHash"<>c."fotografiaHash" OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes)) ) OR NEW."versaoCobrancaAntes"<>i."versaoCobranca" OR NEW."versaoCobrancaDepois"<>NEW."versaoCobrancaAntes"+1 OR NEW."coberturaInicioAnterior" IS DISTINCT FROM i."coberturaInicioAnterior" OR NEW."coberturaFimAnterior" IS DISTINCT FROM i."coberturaFimAnterior" OR NEW."coberturaInicioNova" IS DISTINCT FROM i."coberturaInicioNova" OR NEW."coberturaFimNova" IS DISTINCT FROM i."coberturaFimNova" OR cobr.versao<>NEW."versaoCobrancaDepois" OR cobr."coberturaInicio" IS DISTINCT FROM NEW."coberturaInicioNova" OR cobr."coberturaFim" IS DISTINCT FROM NEW."coberturaFimNova" THEN RAISE EXCEPTION 'Aplicação não prova exatamente o impacto aprovado'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION conferir_atomicidade_cobertura_238() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "ConjuntoImpactosCoberturaAditivo"%ROWTYPE;
BEGIN
 SELECT * INTO c FROM "ConjuntoImpactosCoberturaAditivo" WHERE id=(SELECT "conjuntoId" FROM "ImpactoCoberturaAditivo" WHERE id=NEW."impactoId") FOR SHARE;
 IF c.status<>'COMPLETO' THEN RAISE EXCEPTION 'Aplicação parcial de cobertura não pode persistir'; END IF;
 PERFORM conferir_linhas_conjunto_cobertura_238(c.id);
 IF EXISTS(SELECT 1 FROM "ImpactoCoberturaAditivo" i LEFT JOIN "AplicacaoCoberturaAditivo" a ON a."impactoId"=i.id LEFT JOIN "Cobranca" b ON b.id=i."cobrancaId" WHERE i."conjuntoId"=c.id AND ((i.classificacao='AFETADA' AND (a.id IS NULL OR b.versao IS DISTINCT FROM a."versaoCobrancaDepois" OR b."coberturaInicio" IS DISTINCT FROM a."coberturaInicioNova" OR b."coberturaFim" IS DISTINCT FROM a."coberturaFimNova")) OR (i.classificacao='PRESERVADA' AND (a.id IS NOT NULL OR b.versao IS DISTINCT FROM i."versaoCobranca" OR b."coberturaInicio" IS DISTINCT FROM i."coberturaInicioAnterior" OR b."coberturaFim" IS DISTINCT FROM i."coberturaFimAnterior")))) THEN RAISE EXCEPTION 'Conjunto completo sem efeitos comprovados'; END IF; RETURN NULL;
END $$;

-- A recuperação de uma aprovação só cabe quando a fotografia das mensalidades
-- deixou de corresponder ao estado real. A ação Node guarda a mesma regra; esta
-- função impede que uma atualização SQL transforme uma aprovação íntegra em
-- obsoleta. A cópia explícita em fotografia evita depender do hash da aplicação.
CREATE FUNCTION cobertura_materialmente_divergente_238(conjunto_id TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT EXISTS(
   SELECT 1
   FROM "ConjuntoImpactosCoberturaAditivo" c
   CROSS JOIN LATERAL jsonb_array_elements(c.fotografia->'cobrancas') linha
   LEFT JOIN "Cobranca" b ON b.id=linha->>'id'
   WHERE c.id=conjunto_id AND (
     b.id IS NULL
     OR b.versao IS DISTINCT FROM ((linha->'fotografia'->'cobranca'->>'versao')::integer)
     OR b."coberturaInicio" IS DISTINCT FROM ((linha->'fotografia'->'cobranca'->>'coberturaInicio')::date)
     OR b."coberturaFim" IS DISTINCT FROM ((linha->'fotografia'->'cobranca'->>'coberturaFim')::date)
     OR b.status::text IS DISTINCT FROM (linha->'fotografia'->'cobranca'->>'status')
     OR b."valorRecebido" IS DISTINCT FROM ((linha->'fotografia'->'cobranca'->>'valorRecebido')::numeric)
   )
   UNION ALL
   SELECT 1
   FROM "ConjuntoImpactosCoberturaAditivo" c
   JOIN "Cobranca" b ON b."matriculaId"=c."matriculaId" AND b.tipo='MENSALIDADE'
   WHERE c.id=conjunto_id
     AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c.fotografia->'cobrancas') linha WHERE linha->>'id'=b.id)
 );
$$;

CREATE FUNCTION proteger_conjunto_cobertura_238() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE decisao "DecisaoConjuntoImpactosCoberturaAditivo"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
 IF TG_OP='INSERT' THEN SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE; IF NEW.status<>'PENDENTE' OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR 'FINANCEIRO'=ANY(u.papeis)) OR length(btrim(NEW.motivo))<5 OR length(btrim(NEW.evidencia))<5 THEN RAISE EXCEPTION 'Conjunto exige preparador financeiro ativo e evidências'; END IF; RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Conjunto de cobertura é imutável'; END IF; IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'Fotografia e política formalizada são imutáveis'; END IF;
 SELECT * INTO decisao FROM "DecisaoConjuntoImpactosCoberturaAditivo" WHERE "conjuntoId"=NEW.id FOR SHARE;
 IF OLD.status='PENDENTE' AND NEW.status IN ('APROVADO','REJEITADO') THEN IF decisao.id IS NULL OR decisao.aprovada<>(NEW.status='APROVADO') OR decisao."fotografiaHash"<>NEW."fotografiaHash" OR decisao."decisorId"=NEW."preparadorId" THEN RAISE EXCEPTION 'Decisão independente correspondente é obrigatória'; END IF; IF NEW.status='APROVADO' THEN PERFORM conferir_linhas_conjunto_cobertura_238(NEW.id); END IF; RETURN NEW; END IF;
 IF OLD.status='APROVADO' AND NEW.status='COMPLETO' THEN
   PERFORM conferir_linhas_conjunto_cobertura_238(NEW.id);
   IF NOT EXISTS(SELECT 1 FROM "ImpactoCoberturaAditivo" WHERE "conjuntoId"=NEW.id AND classificacao='AFETADA') THEN RAISE EXCEPTION 'Conjunto completo exige ao menos uma mensalidade afetada'; END IF;
   IF EXISTS(SELECT 1 FROM "ImpactoCoberturaAditivo" i LEFT JOIN "AplicacaoCoberturaAditivo" a ON a."impactoId"=i.id WHERE i."conjuntoId"=NEW.id AND ((i.classificacao='AFETADA' AND a.id IS NULL) OR (i.classificacao='PRESERVADA' AND a.id IS NOT NULL))) THEN RAISE EXCEPTION 'Conjunto completo exige todas e somente aplicações afetadas'; END IF;
   RETURN NEW;
 END IF;
 IF OLD.status='PENDENTE' AND NEW.status='OBSOLETO' THEN RETURN NEW; END IF;
 IF OLD.status='APROVADO' AND NEW.status='OBSOLETO' AND NOT EXISTS(SELECT 1 FROM "ImpactoCoberturaAditivo" i JOIN "AplicacaoCoberturaAditivo" a ON a."impactoId"=i.id WHERE i."conjuntoId"=NEW.id) AND cobertura_materialmente_divergente_238(NEW.id) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Transição de conjunto inválida';
END $$;
CREATE FUNCTION proteger_impacto_cobertura_238() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "ConjuntoImpactosCoberturaAditivo"%ROWTYPE; cobr "Cobranca"%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Impacto é imutável'; END IF; SELECT * INTO c FROM "ConjuntoImpactosCoberturaAditivo" WHERE id=COALESCE(NEW."conjuntoId",OLD."conjuntoId") FOR SHARE; IF c.id IS NULL OR c.status<>'PENDENTE' OR TG_OP='UPDATE' THEN RAISE EXCEPTION 'Impacto é imutável fora do conjunto pendente'; END IF; SELECT * INTO cobr FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR SHARE;
 IF cobr.id IS NULL OR cobr."matriculaId"<>c."matriculaId" OR cobr.tipo<>'MENSALIDADE' OR NEW."versaoCobranca"<>cobr.versao OR NEW."coberturaInicioAnterior" IS DISTINCT FROM cobr."coberturaInicio" OR NEW."coberturaFimAnterior" IS DISTINCT FROM cobr."coberturaFim" OR length(btrim(NEW.justificativa))<5 OR (NEW.classificacao='AFETADA' AND (NEW."coberturaInicioNova" IS NULL OR NEW."coberturaFimNova" IS NULL OR NEW."coberturaInicioNova">NEW."coberturaFimNova")) OR (NEW.classificacao='PRESERVADA' AND (NEW."coberturaInicioNova" IS NOT NULL OR NEW."coberturaFimNova" IS NOT NULL)) THEN RAISE EXCEPTION 'Impacto não corresponde à mensalidade fotografada'; END IF; RETURN NEW;
END $$;

CREATE TRIGGER "ConjuntoImpactosCoberturaAditivo_proteger" BEFORE INSERT OR UPDATE OR DELETE ON "ConjuntoImpactosCoberturaAditivo" FOR EACH ROW EXECUTE FUNCTION proteger_conjunto_cobertura_238();
CREATE TRIGGER "DecisaoConjuntoImpactosCoberturaAditivo_proteger" BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoConjuntoImpactosCoberturaAditivo" FOR EACH ROW EXECUTE FUNCTION proteger_decisao_cobertura_238();
CREATE TRIGGER "ImpactoCoberturaAditivo_proteger" BEFORE INSERT OR UPDATE OR DELETE ON "ImpactoCoberturaAditivo" FOR EACH ROW EXECUTE FUNCTION proteger_impacto_cobertura_238();
CREATE TRIGGER "AplicacaoCoberturaAditivo_proteger" BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoCoberturaAditivo" FOR EACH ROW EXECUTE FUNCTION proteger_aplicacao_cobertura_238();
CREATE CONSTRAINT TRIGGER "AplicacaoCoberturaAditivo_atomicidade" AFTER INSERT ON "AplicacaoCoberturaAditivo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION conferir_atomicidade_cobertura_238();
