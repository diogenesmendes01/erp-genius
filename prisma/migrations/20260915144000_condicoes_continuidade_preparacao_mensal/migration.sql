-- Q607: condições mensais somente existem para contratação mensal preparada.
-- Recria integralmente a função para preservar as demais barreiras da migração 074.

CREATE OR REPLACE FUNCTION validar_condicoes_continuidade_mensal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m "Matricula"%ROWTYPE; u "Usuario"%ROWTYPE; anterior integer;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Condições de continuidade mensal são preservadas.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO m FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula não encontrada.'; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'PENDENTE' OR NEW."decisorId" IS NOT NULL OR NEW."decididaEm" IS NOT NULL OR NEW."motivoDecisao" IS NOT NULL THEN
      RAISE EXCEPTION 'Prepare as condições antes da decisão.';
    END IF;
    SELECT * INTO u FROM "Usuario" WHERE id = NEW."preparadorId" FOR SHARE;
    IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN
      RAISE EXCEPTION 'Sem permissão para preparar condições de continuidade mensal.';
    END IF;
    IF EXISTS (SELECT 1 FROM "CondicoesContinuidadeMensalMatricula" WHERE "matriculaId" = m.id AND status = 'PENDENTE') THEN
      RAISE EXCEPTION 'Existe versão pendente de continuidade mensal.';
    END IF;
    SELECT COALESCE(MAX(versao), 0) INTO anterior FROM "CondicoesContinuidadeMensalMatricula" WHERE "matriculaId" = m.id;
    IF NEW.versao IS DISTINCT FROM anterior + 1 THEN RAISE EXCEPTION 'Versão de continuidade mensal divergente.'; END IF;
  ELSE
    IF OLD.status IS DISTINCT FROM 'PENDENTE' OR NEW.status NOT IN ('APROVADA','REJEITADA')
      OR (to_jsonb(OLD) - ARRAY['status','decisorId','decididaEm','motivoDecisao']) IS DISTINCT FROM
         (to_jsonb(NEW) - ARRAY['status','decisorId','decididaEm','motivoDecisao']) THEN
      RAISE EXCEPTION 'Condições de continuidade mensal são preservadas.';
    END IF;
    SELECT * INTO u FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
    IF u.ativo IS DISTINCT FROM true OR NOT ('ADMINISTRADOR' = ANY(u.papeis)) OR NEW."decisorId" IS NOT DISTINCT FROM NEW."preparadorId" THEN
      RAISE EXCEPTION 'Outra pessoa da Administração deve decidir a continuidade mensal.';
    END IF;
    IF NEW."decididaEm" IS NULL OR COALESCE(length(trim(NEW."motivoDecisao")), 0) < 5 THEN
      RAISE EXCEPTION 'Justifique a decisão de continuidade mensal.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.status = 'APROVADA' THEN
    IF m."contratoOk" IS DISTINCT FROM true OR m."confirmacaoContratoEm" IS NULL OR m."contratoDocumentoId" IS DISTINCT FROM NEW."documentoId" THEN
      RAISE EXCEPTION 'Use o contrato confirmado da matrícula.';
    END IF;
    PERFORM id FROM "Documento" WHERE id = NEW."documentoId" FOR SHARE;
    IF NOT EXISTS (SELECT 1 FROM "Documento" d WHERE d.id = NEW."documentoId" AND d.categoria = 'CONTRATO' AND NOT d.arquivado
      AND (d."matriculaId" = m.id OR d."leadId" = m."leadId")) THEN
      RAISE EXCEPTION 'Documento contratual indisponível.';
    END IF;
    IF NOT COALESCE(
      jsonb_typeof(NEW.regras) = 'object'
      AND jsonb_typeof(NEW.regras->'continuidadeContratada') = 'object'
      AND NEW.regras->'continuidadeContratada'->>'contratada' = 'true'
      AND length(trim(NEW.regras->'continuidadeContratada'->>'clausula')) BETWEEN 1 AND 4000
      AND NEW.regras->'continuidadeContratada'->>'evidenciaId' = NEW."documentoId"
      AND jsonb_typeof(NEW.regras->'regraCobertura') = 'object'
      AND NEW.regras->>'moeda' = m.moeda,
      false
    ) THEN RAISE EXCEPTION 'Regras de continuidade mensal sem cláusula, evidência documental ou moeda compatível.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "PreparacaoComercialMatricula" WHERE "matriculaId" = m.id AND regime = 'MENSALIDADE') THEN
      RAISE EXCEPTION 'Condições exigem contratação mensal preparada.';
    END IF;
    IF length(trim(NEW.motivo)) < 5 THEN RAISE EXCEPTION 'Justifique a transcrição da continuidade mensal.'; END IF;
  END IF;
  RETURN NEW;
END $$;

