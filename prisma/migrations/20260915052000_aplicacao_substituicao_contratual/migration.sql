-- 218: consumo atômico da aprovação e confirmação Q116.
CREATE TABLE "AplicacaoSubstituicaoContratual" (
 id TEXT PRIMARY KEY,
 "intencaoId" TEXT NOT NULL REFERENCES "IntencaoCancelamentoAssinatura"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "observacaoId" TEXT NOT NULL REFERENCES "ObservacaoCancelamentoAssinatura"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "processoSubstitutoId" TEXT NOT NULL,
 "executorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "propostaHash" TEXT NOT NULL CHECK ("propostaHash" ~ '^[a-f0-9]{64}$'),
 "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
 CONSTRAINT "AplicacaoSubstituicaoContratual_processoSubstitutoId_fkey" FOREIGN KEY ("processoSubstitutoId") REFERENCES "ProcessoAssinaturaContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED
);
CREATE UNIQUE INDEX "AplicacaoSubstituicaoContratual_intencaoId_key" ON "AplicacaoSubstituicaoContratual"("intencaoId");
CREATE UNIQUE INDEX "AplicacaoSubstituicaoContratual_observacaoId_key" ON "AplicacaoSubstituicaoContratual"("observacaoId");
CREATE UNIQUE INDEX "AplicacaoSubstituicaoContratual_processoSubstitutoId_key" ON "AplicacaoSubstituicaoContratual"("processoSubstitutoId");

CREATE FUNCTION fonte_assinada_substituicao_218(processo TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 WITH RECURSIVE fontes AS (
  SELECT i."processoId" FROM "AplicacaoSubstituicaoContratual" a JOIN "IntencaoCancelamentoAssinatura" i ON i.id=a."intencaoId" WHERE a."processoSubstitutoId"=processo
  UNION
  SELECT i."processoId" FROM fontes f JOIN "AplicacaoSubstituicaoContratual" a ON a."processoSubstitutoId"=f."processoId" JOIN "IntencaoCancelamentoAssinatura" i ON i.id=a."intencaoId"
 ) SELECT EXISTS(SELECT 1 FROM fontes JOIN "ConclusaoAssinaturaContratual" c USING ("processoId"));
$$;

CREATE FUNCTION validar_aplicacao_substituicao_218() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE i "IntencaoCancelamentoAssinatura"%ROWTYPE; p "PropostaSubstituicaoContratual"%ROWTYPE; ator "Usuario"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Aplicação de substituição é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO i FROM "IntencaoCancelamentoAssinatura" WHERE id=NEW."intencaoId";
 SELECT * INTO p FROM "PropostaSubstituicaoContratual" WHERE id=i."propostaId";
 IF p.id IS NULL OR NEW."propostaHash" IS DISTINCT FROM p."entradaHash" OR NEW."propostaHash" IS DISTINCT FROM i."propostaHash" OR NEW."processoSubstitutoId"=i."processoId" THEN RAISE EXCEPTION 'Aplicação incompatível com a proposta'; END IF;
 PERFORM conferir_fonte_substituicao_216(p);
 IF NOT EXISTS(SELECT 1 FROM "ObservacaoCancelamentoAssinatura" o WHERE o.id=NEW."observacaoId" AND o."intencaoId"=i.id AND o.resultado='CONFIRMADO' AND o."referenciaExterna"=i."referenciaExterna") THEN RAISE EXCEPTION 'Aplicação exige cancelamento confirmado da intenção exata'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "DecisaoSubstituicaoContratual" d WHERE d.id=i."decisaoId" AND d."propostaId"=p.id AND d.aprovada AND d."propostaHash"=NEW."propostaHash" AND d."decisorId"<>p."preparadaPorId") THEN RAISE EXCEPTION 'Aplicação exige aprovação independente'; END IF;
 IF EXISTS(SELECT 1 FROM "PropostaSubstituicaoContratual" n WHERE n."processoFonteId"=p."processoFonteId" AND n.versao>p.versao) THEN RAISE EXCEPTION 'Proposta superada'; END IF;
 IF fonte_assinada_substituicao_218(i."processoId") THEN RAISE EXCEPTION 'Contrato anterior assinado exige conferência Q117'; END IF;
 SELECT * INTO ator FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
 IF NOT FOUND OR NOT ator.ativo OR NOT(ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Aplicação exige Secretaria ou Administração ativa'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validar_aplicacao_substituicao_218 BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoSubstituicaoContratual" FOR EACH ROW EXECUTE FUNCTION validar_aplicacao_substituicao_218();

CREATE FUNCTION conferir_fim_aplicacao_substituicao_218() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "IntencaoCancelamentoAssinatura" i JOIN "PropostaSubstituicaoContratual" p ON p.id=i."propostaId" JOIN "ProcessoAssinaturaContratual" f ON f.id=i."processoId" JOIN "ProcessoAssinaturaContratual" n ON n.id=NEW."processoSubstitutoId"
  WHERE i.id=NEW."intencaoId" AND f.estado='CANCELADO' AND n.estado='PREPARADO' AND n."matriculaId"=f."matriculaId" AND n."artefatoId"=p."artefatoSubstitutoId" AND n."conferenciaId"=p."conferenciaSubstitutoId"
  AND n.fornecedor=f.fornecedor AND n.ambiente=f.ambiente AND n."referenciaExterna" IS NULL AND n."tentativaAtual"=0 AND n."preparadorId"=NEW."executorId") THEN RAISE EXCEPTION 'Substituição deve encerrar a fonte e preparar o destino na mesma transação'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER conferir_fim_aplicacao_substituicao_218 AFTER INSERT ON "AplicacaoSubstituicaoContratual" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION conferir_fim_aplicacao_substituicao_218();

CREATE FUNCTION proteger_transicao_substituicao_218() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.estado='CANCELADO' AND NEW.estado<>'CANCELADO' THEN RAISE EXCEPTION 'Processo cancelado não pode ser reaberto'; END IF;
 IF TG_OP='UPDATE' AND OLD.estado<>'CANCELADO' AND NEW.estado='CANCELADO' THEN
  IF EXISTS(SELECT 1 FROM "ConclusaoAssinaturaContratual" WHERE "processoId"=OLD.id) OR NOT EXISTS(SELECT 1 FROM "AplicacaoSubstituicaoContratual" a JOIN "IntencaoCancelamentoAssinatura" i ON i.id=a."intencaoId" WHERE i."processoId"=OLD.id) THEN RAISE EXCEPTION 'Cancelamento exige aplicação comprovada sem assinatura concluída'; END IF;
 END IF;
 IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId"=NEW."matriculaId") THEN
  IF NOT EXISTS(SELECT 1 FROM "AplicacaoSubstituicaoContratual" WHERE "processoSubstitutoId"=NEW.id) THEN RAISE EXCEPTION 'Novo processo exige aplicação da substituição'; END IF;
 END IF;
 IF NEW.estado IN ('PREPARADO','ENVIANDO','ENVIO_INCERTO','ENVIADO') AND fonte_assinada_substituicao_218(NEW.id) THEN RAISE EXCEPTION 'Contrato anterior assinado exige conferência Q117'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER proteger_transicao_substituicao_218 BEFORE INSERT OR UPDATE ON "ProcessoAssinaturaContratual" FOR EACH ROW EXECUTE FUNCTION proteger_transicao_substituicao_218();
