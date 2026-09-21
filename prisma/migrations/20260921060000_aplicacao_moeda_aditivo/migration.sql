-- Q173 (decisões de 21/09/2026): aplicação do aditivo de MOEDA, só para o futuro e só com a matrícula
-- "limpa" na moeda anterior. Proposta do Financeiro, decisão independente, aplicação pelo aprovador após
-- a vigência; o trigger atualiza Matricula.moeda. Crédito na moeda antiga segue restrito a cobranças da
-- mesma moeda (regra que já existia). Nenhuma conversão cambial existe no sistema.
-- CreateTable
CREATE TABLE "PropostaMoedaAditivo" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "propostaAditivoId" TEXT NOT NULL,
    "versaoCondicoesId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "moedaAnterior" TEXT NOT NULL,
    "moedaNova" TEXT NOT NULL,
    "fotografia" JSONB NOT NULL,
    "fotografiaHash" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidencia" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaMoedaAditivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoMoedaAditivo" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "fotografiaHash" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoMoedaAditivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplicacaoMoedaAditivo" (
    "id" TEXT NOT NULL,
    "decisaoId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "fotografiaHash" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "moedaAnterior" TEXT NOT NULL,
    "moedaNova" TEXT NOT NULL,
    "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AplicacaoMoedaAditivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaMoedaAditivo_matriculaId_criadaEm_idx" ON "PropostaMoedaAditivo"("matriculaId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaMoedaAditivo_preparadorId_chaveIdempotencia_key" ON "PropostaMoedaAditivo"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoMoedaAditivo_propostaId_key" ON "DecisaoMoedaAditivo"("propostaId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoMoedaAditivo_decisorId_chaveIdempotencia_key" ON "DecisaoMoedaAditivo"("decisorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacaoMoedaAditivo_decisaoId_key" ON "AplicacaoMoedaAditivo"("decisaoId");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacaoMoedaAditivo_executorId_chaveIdempotencia_key" ON "AplicacaoMoedaAditivo"("executorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "PropostaMoedaAditivo" ADD CONSTRAINT "PropostaMoedaAditivo_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaMoedaAditivo" ADD CONSTRAINT "PropostaMoedaAditivo_propostaAditivoId_fkey" FOREIGN KEY ("propostaAditivoId") REFERENCES "PropostaAditivoContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaMoedaAditivo" ADD CONSTRAINT "PropostaMoedaAditivo_versaoCondicoesId_fkey" FOREIGN KEY ("versaoCondicoesId") REFERENCES "VersaoCondicoesAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaMoedaAditivo" ADD CONSTRAINT "PropostaMoedaAditivo_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoMoedaAditivo" ADD CONSTRAINT "DecisaoMoedaAditivo_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaMoedaAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoMoedaAditivo" ADD CONSTRAINT "DecisaoMoedaAditivo_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AplicacaoMoedaAditivo" ADD CONSTRAINT "AplicacaoMoedaAditivo_decisaoId_fkey" FOREIGN KEY ("decisaoId") REFERENCES "DecisaoMoedaAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AplicacaoMoedaAditivo" ADD CONSTRAINT "AplicacaoMoedaAditivo_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


ALTER TABLE "PropostaMoedaAditivo" ADD CONSTRAINT "PropostaMoedaAditivo_moedas_check" CHECK ("moedaAnterior" ~ '^[A-Z]{3}$' AND "moedaNova" ~ '^[A-Z]{3}$' AND "moedaAnterior" <> "moedaNova");

-- Q173: a troca só acontece com a matrícula "limpa" na moeda antiga. Cada item é uma pendência
-- que a operação precisa resolver antes; lista vazia = apta.
CREATE FUNCTION pendencias_moeda_antiga_173(matricula_id TEXT, moeda_antiga TEXT, vigencia TIMESTAMP)
RETURNS TEXT[] LANGUAGE sql STABLE AS $$
  SELECT coalesce(array_agg(p ORDER BY p), ARRAY[]::TEXT[]) FROM (
    SELECT 'COBRANCA_EM_ABERTO' AS p WHERE EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=matricula_id AND c.moeda=moeda_antiga AND c.status IN ('PENDENTE','ATRASADO'))
    UNION ALL SELECT 'COMPROVANTE_A_CONFERIR' WHERE EXISTS (SELECT 1 FROM "PagamentoInformado" pi JOIN "Cobranca" c ON c.id=pi."cobrancaId" WHERE c."matriculaId"=matricula_id AND c.moeda=moeda_antiga AND pi.status='A_CONFERIR')
    UNION ALL SELECT 'COBERTURA_MENSAL_ALEM_DA_VIGENCIA' WHERE EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=matricula_id AND c.moeda=moeda_antiga AND c.tipo='MENSALIDADE' AND c.status<>'CANCELADA' AND c."coberturaFim" IS NOT NULL AND c."coberturaFim" >= vigencia::date)
    UNION ALL SELECT 'SALDO_HORAS_PRE_PAGAS' WHERE EXISTS (
      SELECT 1 FROM "CompraHorasAntecipadas" ch WHERE ch."matriculaId"=matricula_id AND ch.moeda=moeda_antiga
        AND NOT EXISTS (SELECT 1 FROM "LiquidacaoHorasAcerto" lq WHERE lq."compraId"=ch.id)
        AND ch."minutosComprados" > coalesce((
          SELECT sum(r.minutos) FROM "ReservaHorasCompradas" r WHERE r."compraId"=ch.id
            AND (EXISTS (SELECT 1 FROM "ConsumoHorasCompradas" co WHERE co."reservaId"=r.id AND NOT EXISTS (SELECT 1 FROM "EstornoConsumoHorasCompradas" es WHERE es."consumoId"=co.id))
              OR EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" d JOIN "PropostaLiberacaoHoras" pl ON pl.id=d."propostaId" WHERE d."reservaId"=r.id AND d.aprovada AND pl.destino='CREDITO'))), 0))
    UNION ALL SELECT 'PERMUTA_VIGENTE' WHERE EXISTS (SELECT 1 FROM "AcordoPermutaServico" a WHERE a."matriculaId"=matricula_id AND a.moeda=moeda_antiga AND a."vigenciaFim" >= vigencia::date)
  ) pendencias
$$;

CREATE FUNCTION fotografia_moeda_aditivo_173(versao_id TEXT, moeda_nova TEXT)
RETURNS JSONB LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('versaoCondicoesId',v.id,'propostaAditivoId',v."propostaId",'condicoesHash',v."condicoesHash",'conferenciaFinalId',v."conferenciaFinalId",
 'matriculaId',m.id,'moedaAnterior',m.moeda,'moedaNova',moeda_nova,'vigenciaInicio',v."vigenciaInicio",
 'pendencias',to_jsonb(pendencias_moeda_antiga_173(m.id,m.moeda,v."vigenciaInicio")))
 FROM "VersaoCondicoesAditivo" v JOIN "Matricula" m ON m.id=v."matriculaId" WHERE v.id=versao_id;
$$;

CREATE FUNCTION conferir_fonte_moeda_aditivo_173(p "PropostaMoedaAditivo") RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v "VersaoCondicoesAditivo"%ROWTYPE; moeda_atual TEXT; foto JSONB;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT moeda INTO moeda_atual FROM "Matricula" WHERE id=p."matriculaId" FOR UPDATE;
 SELECT * INTO v FROM "VersaoCondicoesAditivo" WHERE id=p."versaoCondicoesId";
 IF moeda_atual IS NULL OR moeda_atual IS DISTINCT FROM p."moedaAnterior" OR v."matriculaId" IS DISTINCT FROM p."matriculaId" OR v."propostaId" IS DISTINCT FROM p."propostaAditivoId"
 THEN RAISE EXCEPTION 'Origem ou fotografia da moeda divergente'; END IF;
 IF v.condicoes->'MOEDA'->>'tipo' IS DISTINCT FROM 'MOEDA' OR v.condicoes->'MOEDA'->>'moeda' IS DISTINCT FROM p."moedaNova"
 THEN RAISE EXCEPTION 'Moeda diverge da condição contratual formalizada'; END IF;
 IF EXISTS (SELECT 1 FROM "VersaoCondicoesAditivo" WHERE "matriculaId"=p."matriculaId" AND versao>v.versao) THEN RAISE EXCEPTION 'Versão contratual superada'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "PropostaAditivoContratual" pa, jsonb_array_elements(pa.snapshot->'entrada'->'alteracoes') a WHERE pa.id=p."propostaAditivoId" AND a->>'origem'='MOEDA')
 THEN RAISE EXCEPTION 'Condição herdada não autoriza novo acerto'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "ConferenciaFinalAditivo" f JOIN "ConclusaoAssinaturaAditivo" ca ON ca.id=f."conclusaoId" JOIN "ProcessoAssinaturaAditivo" pr ON pr.id=ca."processoId"
 WHERE f.id=v."conferenciaFinalId" AND pr."propostaId"=p."propostaAditivoId" AND pr.ambiente='PRODUCAO') THEN RAISE EXCEPTION 'Acerto exige aditivo assinado e conferido'; END IF;
 IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" posterior JOIN "PropostaAditivoContratual" origem ON origem.id=p."propostaAditivoId"
 WHERE posterior."matriculaId"=p."matriculaId" AND posterior.versao>origem.versao) THEN RAISE EXCEPTION 'Proposta contratual superada'; END IF;
 foto := fotografia_moeda_aditivo_173(v.id,p."moedaNova");
 IF jsonb_array_length(foto->'pendencias')>0 THEN RAISE EXCEPTION 'A matrícula ainda possui pendências na moeda anterior'; END IF;
 IF p.fotografia IS DISTINCT FROM foto OR p."fotografiaHash" IS DISTINCT FROM encode(sha256(convert_to(p.fotografia::TEXT,'UTF8')),'hex')
 THEN RAISE EXCEPTION 'Fotografia financeira incompatível'; END IF;
END;
$$;

CREATE FUNCTION guardar_moeda_aditivo_173() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; p "PropostaMoedaAditivo"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta e decisão de moeda são imutáveis'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 IF TG_TABLE_NAME='PropostaMoedaAditivo' THEN
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
  IF u.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Preparação exige Financeiro ativo'; END IF;
  IF EXISTS (SELECT 1 FROM "PropostaMoedaAditivo" o LEFT JOIN "DecisaoMoedaAditivo" d ON d."propostaId"=o.id LEFT JOIN "AplicacaoMoedaAditivo" a ON a."decisaoId"=d.id
    WHERE o."matriculaId"=NEW."matriculaId" AND (d.id IS NULL OR (d.aprovada AND a.id IS NULL))) THEN RAISE EXCEPTION 'Já existe troca de moeda em andamento nesta matrícula'; END IF;
  PERFORM conferir_fonte_moeda_aditivo_173(NEW);
 ELSE
  SELECT * INTO p FROM "PropostaMoedaAditivo" WHERE id=NEW."propostaId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash"
  OR u.id IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes)))
  THEN RAISE EXCEPTION 'Decisão exige aprovador financeiro independente'; END IF;
  IF NEW.aprovada THEN PERFORM conferir_fonte_moeda_aditivo_173(p); END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guardar_proposta_moeda_173 BEFORE INSERT OR UPDATE OR DELETE ON "PropostaMoedaAditivo" FOR EACH ROW EXECUTE FUNCTION guardar_moeda_aditivo_173();
CREATE TRIGGER guardar_decisao_moeda_173 BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoMoedaAditivo" FOR EACH ROW EXECUTE FUNCTION guardar_moeda_aditivo_173();

CREATE FUNCTION guardar_aplicacao_moeda_173() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaMoedaAditivo"%ROWTYPE; d "DecisaoMoedaAditivo"%ROWTYPE; u "Usuario"%ROWTYPE; vigencia TIMESTAMP;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Aplicação de moeda é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO d FROM "DecisaoMoedaAditivo" WHERE id=NEW."decisaoId";
 SELECT * INTO p FROM "PropostaMoedaAditivo" WHERE id=d."propostaId";
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
 IF d.aprovada IS DISTINCT FROM true OR u.ativo IS DISTINCT FROM true OR NEW."executorId" IS DISTINCT FROM d."decisorId" OR NEW."executorId"=p."preparadorId"
 OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes)))
 THEN RAISE EXCEPTION 'Execução exige o aprovador financeiro autorizado'; END IF;
 SELECT v."vigenciaInicio" INTO vigencia FROM "VersaoCondicoesAditivo" v WHERE v.id=p."versaoCondicoesId";
 IF vigencia IS NULL OR vigencia > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Aguarde a vigência aprovada antes de aplicar a moeda'; END IF;
 PERFORM conferir_fonte_moeda_aditivo_173(p);
 IF NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR d."fotografiaHash" IS DISTINCT FROM p."fotografiaHash"
 OR NEW."moedaAnterior" IS DISTINCT FROM p."moedaAnterior" OR NEW."moedaNova" IS DISTINCT FROM p."moedaNova" THEN RAISE EXCEPTION 'Aplicação diverge da proposta aprovada'; END IF;
 NEW."aplicadaEm" := CURRENT_TIMESTAMP AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;
CREATE TRIGGER guardar_aplicacao_moeda_173 BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoMoedaAditivo" FOR EACH ROW EXECUTE FUNCTION guardar_aplicacao_moeda_173();

-- A matrícula passa à moeda nova: tudo o que nasce depois (condições, mensalidades, horas) usa a moeda vigente.
CREATE FUNCTION efetivar_moeda_aditivo_173() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaMoedaAditivo"%ROWTYPE;
BEGIN
 SELECT p0.* INTO p FROM "PropostaMoedaAditivo" p0 JOIN "DecisaoMoedaAditivo" d ON d."propostaId"=p0.id WHERE d.id=NEW."decisaoId";
 UPDATE "Matricula" SET moeda=NEW."moedaNova" WHERE id=p."matriculaId" AND moeda=NEW."moedaAnterior";
 IF NOT FOUND THEN RAISE EXCEPTION 'A moeda da matrícula mudou antes da aplicação'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER efetivar_moeda_aditivo_173 AFTER INSERT ON "AplicacaoMoedaAditivo" FOR EACH ROW EXECUTE FUNCTION efetivar_moeda_aditivo_173();

-- 231: ramo da moeda e preservação de taxa/adiantamento reexpressos; demais ramos copiados da definição vigente (20260921030000).
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
   -- Q173: a própria MOEDA e os valores que o aditivo de moeda obriga a reexpressar (taxa e adiantamento já
   -- vividos) ficam provados pela aplicação de moeda da versão de origem: preservados, sem efeito retroativo.
   IF campo = ANY(ARRAY['MOEDA','TAXA_VALOR','ADIANTAMENTO_VALOR']) AND EXISTS(SELECT 1 FROM "PropostaAditivoContratual" pm, jsonb_array_elements(pm.snapshot->'entrada'->'alteracoes') am WHERE pm.id=origem."propostaId" AND am->>'origem'='MOEDA') THEN
     IF NOT EXISTS(SELECT 1 FROM "AplicacaoMoedaAditivo" a JOIN "DecisaoMoedaAditivo" dm ON dm.id=a."decisaoId" AND dm.aprovada JOIN "PropostaMoedaAditivo" p ON p.id=dm."propostaId"
       WHERE p."versaoCondicoesId"=origem.id AND p."propostaAditivoId"=origem."propostaId" AND p."matriculaId"=atual."matriculaId")
     THEN RAISE EXCEPTION 'Moeda exige aplicação financeira própria'; END IF;
   ELSIF campo='PRIMEIRA_MENSALIDADE_VENCIMENTO' THEN
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
   ELSIF campo = ANY(ARRAY['ADIANTAMENTO_VALOR','ADIANTAMENTO_MINUTOS','ADIANTAMENTO_VENCIMENTO']) THEN
     IF NOT EXISTS(SELECT 1 FROM "AplicacaoAdiantamentoAditivo" a JOIN "DecisaoAdiantamentoAditivo" d ON d.id=a."decisaoId" AND d.aprovada
       JOIN "PropostaAdiantamentoAditivo" p ON p.id=d."propostaId" WHERE p."versaoCondicoesId"=origem.id AND p."propostaAditivoId"=origem."propostaId" AND p."matriculaId"=atual."matriculaId")
     THEN RAISE EXCEPTION 'Adiantamento exige aplicação financeira própria'; END IF;
   ELSE RAISE EXCEPTION 'Condição financeira exige fluxo próprio antes da aplicação';
   END IF;
 END LOOP;
END $$;
