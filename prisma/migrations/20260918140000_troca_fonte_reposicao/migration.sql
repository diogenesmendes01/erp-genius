-- Q23/Q57: a troca do material de reposição adota somente uma revisão já
-- publicada da aula original. A publicação, a reposição e seus compromissos
-- permanecem imutáveis; o único efeito aprovado é a próxima Fonte MATERIAL.

ALTER TABLE "FonteRevisaoGravacao"
  ADD COLUMN "propostaTrocaReposicaoId" TEXT,
  ADD COLUMN "origemPublicacaoId" TEXT,
  ADD CONSTRAINT "FonteRevisaoGravacao_proposta_origem_troca_260_check" CHECK (
    ("propostaTrocaReposicaoId" IS NULL AND "origemPublicacaoId" IS NULL)
    OR ("propostaTrocaReposicaoId" IS NOT NULL AND "origemPublicacaoId" IS NOT NULL)
  ),
  ADD CONSTRAINT "FonteRevisaoGravacao_propostas_exclusivas_260_check" CHECK (
    num_nonnulls("propostaId", "propostaTrocaReposicaoId") <= 1
  );

CREATE TABLE "PropostaTrocaFonteReposicaoGravacao" (
  id TEXT NOT NULL,
  "materialReposicaoId" TEXT NOT NULL,
  "fontePublicacaoId" TEXT NOT NULL,
  "fonteMaterialAnteriorId" TEXT NOT NULL,
  "versaoMaterialEsperada" INTEGER NOT NULL,
  fotografia JSONB NOT NULL,
  "fotografiaHash" TEXT NOT NULL,
  motivo TEXT NOT NULL,
  "preparadorId" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  CONSTRAINT "PropostaTrocaFonteReposicaoGravacao_pkey" PRIMARY KEY (id),
  CONSTRAINT "PropostaTrocaFonteReposicaoGravacao_versao_check" CHECK ("versaoMaterialEsperada" > 0),
  CONSTRAINT "PropostaTrocaFonteReposicaoGravacao_hash_check" CHECK ("fotografiaHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "PropostaTrocaFonteReposicaoGravacao_motivo_check" CHECK (length(btrim(motivo)) BETWEEN 5 AND 4000)
);

CREATE TABLE "DecisaoTrocaFonteReposicaoGravacao" (
  id TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL,
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  CONSTRAINT "DecisaoTrocaFonteReposicaoGravacao_pkey" PRIMARY KEY (id),
  CONSTRAINT "DecisaoTrocaFonteReposicaoGravacao_motivo_check" CHECK (length(btrim(motivo)) BETWEEN 5 AND 4000)
);

CREATE UNIQUE INDEX "FonteRevisaoGravacao_propostaTrocaReposicaoId_key"
  ON "FonteRevisaoGravacao"("propostaTrocaReposicaoId");
CREATE INDEX "FonteRevisaoGravacao_origem_publicacao_idx"
  ON "FonteRevisaoGravacao"("origemPublicacaoId");
CREATE UNIQUE INDEX "FonteRevisaoGravacao_material_origem_publicacao_key"
  ON "FonteRevisaoGravacao"("materialReposicaoId", "origemPublicacaoId")
  WHERE "origemPublicacaoId" IS NOT NULL;
CREATE UNIQUE INDEX "PropostaTrocaFonteReposicaoGravacao_preparador_chave_key"
  ON "PropostaTrocaFonteReposicaoGravacao"("preparadorId", "chaveIdempotencia");
CREATE INDEX "PropostaTrocaFonteReposicaoGravacao_material_idx"
  ON "PropostaTrocaFonteReposicaoGravacao"("materialReposicaoId", "criadaEm");
CREATE INDEX "PropostaTrocaFonteReposicaoGravacao_publicacao_idx"
  ON "PropostaTrocaFonteReposicaoGravacao"("fontePublicacaoId");
CREATE UNIQUE INDEX "DecisaoTrocaFonteReposicaoGravacao_propostaId_key"
  ON "DecisaoTrocaFonteReposicaoGravacao"("propostaId");

ALTER TABLE "FonteRevisaoGravacao"
  ADD CONSTRAINT "FonteRevisaoGravacao_propostaTrocaReposicaoId_fkey"
    FOREIGN KEY ("propostaTrocaReposicaoId") REFERENCES "PropostaTrocaFonteReposicaoGravacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "FonteRevisaoGravacao_origemPublicacaoId_fkey"
    FOREIGN KEY ("origemPublicacaoId") REFERENCES "FonteRevisaoGravacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaTrocaFonteReposicaoGravacao"
  ADD CONSTRAINT "PropostaTrocaFonteReposicaoGravacao_materialReposicaoId_fkey"
    FOREIGN KEY ("materialReposicaoId") REFERENCES "MaterialReposicaoGravacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "PropostaTrocaFonteReposicaoGravacao_fontePublicacaoId_fkey"
    FOREIGN KEY ("fontePublicacaoId") REFERENCES "FonteRevisaoGravacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "PropostaTrocaFonteReposicaoGravacao_fonteMaterialAnteriorId_fkey"
    FOREIGN KEY ("fonteMaterialAnteriorId") REFERENCES "FonteRevisaoGravacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "PropostaTrocaFonteReposicaoGravacao_preparadorId_fkey"
    FOREIGN KEY ("preparadorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoTrocaFonteReposicaoGravacao"
  ADD CONSTRAINT "DecisaoTrocaFonteReposicaoGravacao_propostaId_fkey"
    FOREIGN KEY ("propostaId") REFERENCES "PropostaTrocaFonteReposicaoGravacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "DecisaoTrocaFonteReposicaoGravacao_decisorId_fkey"
    FOREIGN KEY ("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- A mesma fotografia é usada pela proposta e pela aplicação. Valores monetários
-- não participam deste agregado; todos os números aqui são versões inteiras e
-- o tamanho da revisão é serializado como texto, igual ao Node.
CREATE OR REPLACE FUNCTION fotografia_troca_fonte_reposicao_260(
  _material_id TEXT, _fonte_publicacao_id TEXT, _fonte_material_id TEXT
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'materialId', material.id,
    'reposicaoId', reposicao.id,
    'matriculaId', reposicao."matriculaId",
    'aulaOriginalId', reposicao."aulaOriginalId",
    'publicacaoAulaId', publicacao.id,
    'materialDisponivel', material.disponivel,
    'disponibilizacaoId', disponibilizacao.id,
    'fonteMaterialAnterior', jsonb_build_object('id', fonte_material.id, 'versao', fonte_material.versao),
    'fontePublicacao', jsonb_build_object(
      'id', fonte_publicacao.id, 'versao', fonte_publicacao.versao,
      'arquivoOficialId', fonte_publicacao."arquivoOficialId",
      'driveOrganizacaoId', fonte_publicacao."driveOrganizacaoId",
      'driveRevisionId', fonte_publicacao."driveRevisionId",
      'driveRevisionMd5', fonte_publicacao."driveRevisionMd5",
      'driveRevisionSize', fonte_publicacao."driveRevisionSize"::TEXT,
      'mimeType', fonte_publicacao."mimeType"
    )
  )
  FROM "MaterialReposicaoGravacao" material
  JOIN "ReposicaoIndividual" reposicao ON reposicao.id = material."reposicaoId"
  JOIN "PublicacaoGravacaoAula" publicacao ON publicacao.id = material."publicacaoAulaId"
  JOIN "FonteRevisaoGravacao" fonte_publicacao ON fonte_publicacao.id = _fonte_publicacao_id
  JOIN "FonteRevisaoGravacao" fonte_material ON fonte_material.id = _fonte_material_id
  LEFT JOIN "DisponibilizacaoEntregaReposicao" disponibilizacao ON disponibilizacao."materialId" = material.id
  WHERE material.id = _material_id;
$$;

CREATE OR REPLACE FUNCTION validar_proposta_troca_fonte_reposicao_260() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE foto_atual JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Propostas de troca de fonte são imutáveis';
  END IF;

  -- A mesma ordem do preparo/decisão de regularização: usuário, publicação,
  -- material. A publicação fica bloqueada antes de verificar sua cabeça.
  PERFORM 1 FROM "Usuario" usuario WHERE usuario.id = NEW."preparadorId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Preparador da troca não encontrado'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Usuario" usuario
    WHERE usuario.id = NEW."preparadorId" AND usuario.ativo
      AND ('GERENTE_PEDAGOGICO'::"Papel" = ANY(usuario.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(usuario.papeis))
  ) THEN RAISE EXCEPTION 'Preparador da troca sem papel de gestão ativo'; END IF;

  PERFORM 1
    FROM "MaterialReposicaoGravacao" material
    JOIN "PublicacaoGravacaoAula" publicacao ON publicacao.id = material."publicacaoAulaId"
    WHERE material.id = NEW."materialReposicaoId"
    FOR UPDATE OF publicacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Material da troca não tem publicação de origem'; END IF;

  -- O material ancora a serialização da troca; a fonte da publicação é a
  -- cabeça vigente desta aula e a fonte do material é a cabeça anterior.
  PERFORM 1
    FROM "MaterialReposicaoGravacao" material
    JOIN "ReposicaoIndividual" reposicao ON reposicao.id = material."reposicaoId"
    JOIN "DecisaoReposicaoIndividual" decisao_reposicao
      ON decisao_reposicao."reposicaoId" = reposicao.id AND decisao_reposicao.aprovada
    JOIN "PublicacaoGravacaoAula" publicacao ON publicacao.id = material."publicacaoAulaId"
    JOIN "FonteRevisaoGravacao" fonte_publicacao ON fonte_publicacao.id = NEW."fontePublicacaoId"
    JOIN "FonteRevisaoGravacao" fonte_material ON fonte_material.id = NEW."fonteMaterialAnteriorId"
    WHERE material.id = NEW."materialReposicaoId"
      AND reposicao.modalidade = 'GRAVACAO'
      AND reposicao."aulaOriginalId" = publicacao."encontroId"
      AND fonte_publicacao.alvo = 'PUBLICACAO_AULA'
      AND fonte_publicacao."publicacaoAulaId" = publicacao.id
      AND fonte_material.alvo = 'MATERIAL_REPOSICAO'
      AND fonte_material."materialReposicaoId" = material.id
      AND material.disponivel
      AND NOT EXISTS (
        SELECT 1 FROM "FonteRevisaoGravacao" posterior
        WHERE posterior."publicacaoAulaId" = fonte_publicacao."publicacaoAulaId"
          AND posterior.versao > fonte_publicacao.versao
      )
      AND NOT EXISTS (
        SELECT 1 FROM "FonteRevisaoGravacao" posterior
        WHERE posterior."materialReposicaoId" = fonte_material."materialReposicaoId"
          AND posterior.versao > fonte_material.versao
      )
    FOR UPDATE OF material, reposicao;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A troca exige material de reposição aprovado e as fontes vigentes da mesma aula';
  END IF;

  SELECT fotografia_troca_fonte_reposicao_260(NEW."materialReposicaoId", NEW."fontePublicacaoId", NEW."fonteMaterialAnteriorId") INTO foto_atual;

  IF NEW."versaoMaterialEsperada" IS DISTINCT FROM (NEW.fotografia->'fonteMaterialAnterior'->>'versao')::INTEGER
    OR NEW.fotografia IS DISTINCT FROM foto_atual
    OR NEW."fotografiaHash" IS DISTINCT FROM encode(digest(q165_json_canon(foto_atual), 'sha256'), 'hex') THEN
    RAISE EXCEPTION 'Fotografia da troca de fonte não comprova o material e a publicação vigentes';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER "PropostaTrocaFonteReposicaoGravacao_validar_260"
  BEFORE INSERT OR UPDATE OR DELETE ON "PropostaTrocaFonteReposicaoGravacao"
  FOR EACH ROW EXECUTE FUNCTION validar_proposta_troca_fonte_reposicao_260();

CREATE OR REPLACE FUNCTION validar_decisao_troca_fonte_reposicao_260() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaTrocaFonteReposicaoGravacao"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisões de troca de fonte são imutáveis'; END IF;
  SELECT * INTO proposta FROM "PropostaTrocaFonteReposicaoGravacao" WHERE id = NEW."propostaId" FOR SHARE;
  IF proposta.id IS NULL THEN RAISE EXCEPTION 'Proposta de troca não encontrada'; END IF;
  -- Ambos os atores são estabilizados na ordem de identidade para não disputar
  -- uma revogação com ordens inversas entre decisão e aplicação.
  PERFORM 1 FROM "Usuario" WHERE id = LEAST(proposta."preparadorId", NEW."decisorId") FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ator da troca não encontrado'; END IF;
  PERFORM 1 FROM "Usuario" WHERE id = GREATEST(proposta."preparadorId", NEW."decisorId") FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ator da troca não encontrado'; END IF;
  IF proposta."preparadorId" = NEW."decisorId" THEN RAISE EXCEPTION 'Outra pessoa deve decidir a troca de fonte'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Usuario" usuario
    WHERE usuario.id = proposta."preparadorId" AND usuario.ativo
      AND ('GERENTE_PEDAGOGICO'::"Papel" = ANY(usuario.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(usuario.papeis))
  ) THEN RAISE EXCEPTION 'Preparador da troca sem papel de gestão ativo'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Usuario" usuario
    WHERE usuario.id = NEW."decisorId" AND usuario.ativo
      AND ('GERENTE_PEDAGOGICO'::"Papel" = ANY(usuario.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(usuario.papeis))
  ) THEN RAISE EXCEPTION 'Decisor da troca sem papel de gestão ativo'; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER "DecisaoTrocaFonteReposicaoGravacao_validar_260"
  BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoTrocaFonteReposicaoGravacao"
  FOR EACH ROW EXECUTE FUNCTION validar_decisao_troca_fonte_reposicao_260();

-- Mantém a cadeia 147 para fontes originais e regularizações genéricas, e
-- acrescenta a única terceira origem permitida: a proposta contextual aprovada.
CREATE OR REPLACE FUNCTION validar_fonte_revisao_gravacao_260() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaRegularizacaoFonteGravacao"%ROWTYPE;
DECLARE decisao "DecisaoRegularizacaoFonteGravacao"%ROWTYPE;
DECLARE proposta_troca "PropostaTrocaFonteReposicaoGravacao"%ROWTYPE;
DECLARE decisao_troca "DecisaoTrocaFonteReposicaoGravacao"%ROWTYPE;
DECLARE origem "FonteRevisaoGravacao"%ROWTYPE;
DECLARE ultimo INTEGER;
DECLARE foto_atual JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Fontes de revisão são imutáveis'; END IF;

  IF NEW."propostaTrocaReposicaoId" IS NOT NULL THEN
    IF NEW.alvo <> 'MATERIAL_REPOSICAO' OR NEW."propostaId" IS NOT NULL OR NEW."origemPublicacaoId" IS NULL THEN
      RAISE EXCEPTION 'A troca contextual só pode criar a fonte MATERIAL com a origem declarada';
    END IF;
    SELECT * INTO proposta_troca FROM "PropostaTrocaFonteReposicaoGravacao" WHERE id = NEW."propostaTrocaReposicaoId" FOR SHARE;
    SELECT * INTO decisao_troca FROM "DecisaoTrocaFonteReposicaoGravacao" WHERE "propostaId" = NEW."propostaTrocaReposicaoId" AND aprovada FOR SHARE;
    SELECT * INTO origem FROM "FonteRevisaoGravacao" WHERE id = NEW."origemPublicacaoId" FOR SHARE;
    IF proposta_troca.id IS NULL OR decisao_troca.id IS NULL OR origem.id IS NULL THEN
      RAISE EXCEPTION 'Fonte de troca exige proposta e decisão aprovadas';
    END IF;

    -- A decisão de regularização já usa usuário antes da âncora. Mantemos a
    -- mesma ordem para não disputar a retirada de papel com a nova revisão.
    PERFORM 1 FROM "Usuario" WHERE id = LEAST(proposta_troca."preparadorId", decisao_troca."decisorId") FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Preparador da troca não encontrado'; END IF;
    PERFORM 1 FROM "Usuario" WHERE id = GREATEST(proposta_troca."preparadorId", decisao_troca."decisorId") FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Decisor da troca não encontrado'; END IF;
    PERFORM 1 FROM "PublicacaoGravacaoAula" WHERE id = origem."publicacaoAulaId" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Publicação de origem não encontrada'; END IF;
    PERFORM 1 FROM "MaterialReposicaoGravacao" WHERE id = NEW."materialReposicaoId" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Material da fonte não encontrado'; END IF;
    SELECT COALESCE(MAX(versao), 0) INTO ultimo FROM "FonteRevisaoGravacao"
      WHERE "materialReposicaoId" = NEW."materialReposicaoId";
    IF NEW.versao IS DISTINCT FROM ultimo + 1 THEN RAISE EXCEPTION 'A fonte exige a próxima versão sequencial'; END IF;
    SELECT fotografia_troca_fonte_reposicao_260(
      proposta_troca."materialReposicaoId", proposta_troca."fontePublicacaoId", proposta_troca."fonteMaterialAnteriorId"
    ) INTO foto_atual;
    IF proposta_troca."materialReposicaoId" IS DISTINCT FROM NEW."materialReposicaoId"
      OR proposta_troca."fontePublicacaoId" IS DISTINCT FROM NEW."origemPublicacaoId"
      OR proposta_troca."versaoMaterialEsperada" IS DISTINCT FROM ultimo
      OR proposta_troca."preparadorId" = decisao_troca."decisorId"
      OR proposta_troca.fotografia IS DISTINCT FROM foto_atual
      OR proposta_troca."fotografiaHash" IS DISTINCT FROM encode(digest(q165_json_canon(foto_atual), 'sha256'), 'hex')
      OR (foto_atual->>'materialDisponivel') IS DISTINCT FROM 'true'
      OR origem.alvo <> 'PUBLICACAO_AULA'
      OR origem."arquivoOficialId" IS DISTINCT FROM NEW."arquivoOficialId"
      OR origem."driveOrganizacaoId" IS DISTINCT FROM NEW."driveOrganizacaoId"
      OR origem."driveRevisionId" IS DISTINCT FROM NEW."driveRevisionId"
      OR origem."driveRevisionMd5" IS DISTINCT FROM NEW."driveRevisionMd5"
      OR origem."driveRevisionSize" IS DISTINCT FROM NEW."driveRevisionSize"
      OR origem."mimeType" IS DISTINCT FROM NEW."mimeType"
      OR EXISTS (
        SELECT 1 FROM "FonteRevisaoGravacao" posterior
        WHERE posterior."publicacaoAulaId" = origem."publicacaoAulaId"
          AND posterior.versao > origem.versao
      )
      OR NOT EXISTS (
        SELECT 1 FROM "Usuario" usuario WHERE usuario.id = proposta_troca."preparadorId" AND usuario.ativo
          AND ('GERENTE_PEDAGOGICO'::"Papel" = ANY(usuario.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(usuario.papeis))
      )
      OR NOT EXISTS (
        SELECT 1 FROM "Usuario" usuario WHERE usuario.id = decisao_troca."decisorId" AND usuario.ativo
          AND ('GERENTE_PEDAGOGICO'::"Papel" = ANY(usuario.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(usuario.papeis))
      )
      OR NOT EXISTS (
        SELECT 1 FROM "FonteRevisaoGravacao" anterior
        WHERE anterior.id = proposta_troca."fonteMaterialAnteriorId"
          AND anterior."materialReposicaoId" = NEW."materialReposicaoId"
          AND anterior.versao = ultimo
      )
      OR NOT EXISTS (
        SELECT 1 FROM "MaterialReposicaoGravacao" material
        WHERE material.id = NEW."materialReposicaoId"
          AND material."publicacaoAulaId" = origem."publicacaoAulaId"
      )
      OR EXISTS (
        SELECT 1 FROM "FonteRevisaoGravacao" posterior
        WHERE posterior."materialReposicaoId" = NEW."materialReposicaoId"
          AND posterior.versao > proposta_troca."versaoMaterialEsperada"
      ) THEN RAISE EXCEPTION 'Fonte de troca exige fotografia atual, decisão independente e papéis vigentes'; END IF;
    RETURN NEW;
  END IF;

  IF NEW.alvo = 'PUBLICACAO_AULA' THEN
    PERFORM 1 FROM "PublicacaoGravacaoAula" WHERE id = NEW."publicacaoAulaId" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Publicação da fonte não encontrada'; END IF;
  ELSE
    PERFORM 1 FROM "MaterialReposicaoGravacao" WHERE id = NEW."materialReposicaoId" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Material da fonte não encontrado'; END IF;
  END IF;
  SELECT COALESCE(MAX(versao), 0) INTO ultimo FROM "FonteRevisaoGravacao"
    WHERE "publicacaoAulaId" IS NOT DISTINCT FROM NEW."publicacaoAulaId"
      AND "materialReposicaoId" IS NOT DISTINCT FROM NEW."materialReposicaoId";
  IF NEW.versao IS DISTINCT FROM ultimo + 1 THEN RAISE EXCEPTION 'A fonte exige a próxima versão sequencial'; END IF;

  IF NEW."origemPublicacaoId" IS NOT NULL THEN RAISE EXCEPTION 'Origem publicada exige proposta de troca contextual'; END IF;
  IF NEW."propostaId" IS NULL THEN
    IF NEW.versao <> 1 THEN RAISE EXCEPTION 'Somente a fonte original pode não ter aprovação'; END IF;
    IF NEW.alvo = 'PUBLICACAO_AULA' AND NOT EXISTS (SELECT 1 FROM "PublicacaoGravacaoAula" p WHERE p.id=NEW."publicacaoAulaId" AND p."arquivoOficialId"=NEW."arquivoOficialId" AND p."driveOrganizacaoId"=NEW."driveOrganizacaoId" AND p."driveRevisionId"=NEW."driveRevisionId" AND p."driveRevisionMd5"=NEW."driveRevisionMd5" AND p."driveRevisionSize"=NEW."driveRevisionSize" AND p."mimeType"=NEW."mimeType") THEN RAISE EXCEPTION 'Fonte original não corresponde à publicação'; END IF;
    IF NEW.alvo = 'MATERIAL_REPOSICAO' AND NOT EXISTS (SELECT 1 FROM "MaterialReposicaoGravacao" m WHERE m.id=NEW."materialReposicaoId" AND m."arquivoOficialId" IS NOT DISTINCT FROM NEW."arquivoOficialId" AND m."driveOrganizacaoId" IS NOT DISTINCT FROM NEW."driveOrganizacaoId" AND m."driveRevisionId" IS NOT DISTINCT FROM NEW."driveRevisionId" AND m."driveRevisionMd5" IS NOT DISTINCT FROM NEW."driveRevisionMd5" AND m."driveRevisionSize" IS NOT DISTINCT FROM NEW."driveRevisionSize" AND m."mimeType" IS NOT DISTINCT FROM NEW."mimeType") THEN RAISE EXCEPTION 'Fonte original não corresponde ao material'; END IF;
    IF NEW.alvo = 'MATERIAL_REPOSICAO' AND NOT EXISTS (
      SELECT 1 FROM "MaterialReposicaoGravacao" m
      JOIN LATERAL (
        SELECT f."arquivoOficialId", f."driveOrganizacaoId", f."driveRevisionId", f."driveRevisionMd5", f."driveRevisionSize", f."mimeType"
        FROM "FonteRevisaoGravacao" f WHERE f."publicacaoAulaId" = m."publicacaoAulaId"
        ORDER BY f.versao DESC LIMIT 1
      ) origem_atual ON TRUE
      WHERE m.id = NEW."materialReposicaoId" AND m."publicacaoAulaId" IS NOT NULL
        AND origem_atual."arquivoOficialId" IS NOT DISTINCT FROM NEW."arquivoOficialId"
        AND origem_atual."driveOrganizacaoId" IS NOT DISTINCT FROM NEW."driveOrganizacaoId"
        AND origem_atual."driveRevisionId" IS NOT DISTINCT FROM NEW."driveRevisionId"
        AND origem_atual."driveRevisionMd5" IS NOT DISTINCT FROM NEW."driveRevisionMd5"
        AND origem_atual."driveRevisionSize" IS NOT DISTINCT FROM NEW."driveRevisionSize"
        AND origem_atual."mimeType" IS NOT DISTINCT FROM NEW."mimeType"
    ) AND EXISTS (SELECT 1 FROM "MaterialReposicaoGravacao" WHERE id = NEW."materialReposicaoId" AND "publicacaoAulaId" IS NOT NULL) THEN RAISE EXCEPTION 'Fonte derivada não corresponde à publicação'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO proposta FROM "PropostaRegularizacaoFonteGravacao" WHERE id=NEW."propostaId" FOR SHARE;
  SELECT * INTO decisao FROM "DecisaoRegularizacaoFonteGravacao" WHERE "propostaId"=NEW."propostaId" AND aprovada FOR SHARE;
  IF NOT FOUND OR proposta.alvo IS DISTINCT FROM NEW.alvo OR proposta."publicacaoAulaId" IS DISTINCT FROM NEW."publicacaoAulaId" OR proposta."materialReposicaoId" IS DISTINCT FROM NEW."materialReposicaoId" OR proposta."versaoEsperada" IS DISTINCT FROM ultimo OR proposta."arquivoOficialId" IS DISTINCT FROM NEW."arquivoOficialId" OR proposta."driveOrganizacaoId" IS DISTINCT FROM NEW."driveOrganizacaoId" OR proposta."driveRevisionId" IS DISTINCT FROM NEW."driveRevisionId" OR proposta."driveRevisionMd5" IS DISTINCT FROM NEW."driveRevisionMd5" OR proposta."driveRevisionSize" IS DISTINCT FROM NEW."driveRevisionSize" OR proposta."mimeType" IS DISTINCT FROM NEW."mimeType" THEN RAISE EXCEPTION 'Fonte substituta exige proposta aprovada e ainda atual'; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER "FonteRevisaoGravacao_validar_147" ON "FonteRevisaoGravacao";
CREATE TRIGGER "FonteRevisaoGravacao_validar_260"
  BEFORE INSERT OR UPDATE OR DELETE ON "FonteRevisaoGravacao"
  FOR EACH ROW EXECUTE FUNCTION validar_fonte_revisao_gravacao_260();
