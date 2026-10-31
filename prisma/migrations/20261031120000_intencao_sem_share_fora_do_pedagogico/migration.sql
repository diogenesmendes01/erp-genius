-- Atualizar uma intenção comercial (status ENVIANDO, por exemplo) não pode
-- tomar FOR SHARE no atendimento. A aprovação da Aria segura o atendimento com
-- FOR NO KEY UPDATE e em seguida trava as intenções IA com FOR UPDATE. O FOR
-- SHARE do gatilho pedagógico, disparado em toda intenção que ainda pode ser
-- enviada, fechava o ciclo e gerava deadlock 40P01.
--
-- Fora do pedagógico a função volta sem lock. No pedagógico o FOR SHARE e as
-- mesmas recusas permanecem, relidas debaixo do lock.

CREATE OR REPLACE FUNCTION validar_intencao_pedagogica_264()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  atendimento_finalidade "FinalidadeAtendimentoWhatsApp";
  atendimento_aluno_id TEXT;
  atendimento_matricula_id TEXT;
  atendimento_autorizacao_id TEXT;
  atendimento_numero_id TEXT;
  atendimento_contato_id TEXT;
  contato_aluno_id TEXT;
  contato_responsavel_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE'
    AND (NEW."atendimentoId", NEW."numeroId", NEW."contatoId")
      IS DISTINCT FROM (OLD."atendimentoId", OLD."numeroId", OLD."contatoId")
    AND OLD."atendimentoId" IS NOT NULL THEN
    PERFORM 1 FROM "AtendimentoWhatsApp"
      WHERE id = OLD."atendimentoId" AND finalidade = 'PEDAGOGICO' AND "alunoId" IS NOT NULL
      FOR SHARE;
    IF FOUND THEN
      RAISE EXCEPTION 'Intenção pedagógica não pode trocar atendimento ou envelope.';
    END IF;
  END IF;
  IF NEW."atendimentoId" IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('PENDENTE', 'ADIADA', 'ENVIANDO') THEN
    RETURN NEW;
  END IF;

  SELECT a.finalidade, a."alunoId"
    INTO atendimento_finalidade, atendimento_aluno_id
  FROM "AtendimentoWhatsApp" a
  WHERE a.id = NEW."atendimentoId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intenção não possui atendimento válido.';
  END IF;
  IF atendimento_finalidade <> 'PEDAGOGICO' OR atendimento_aluno_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.finalidade, a."alunoId", a."matriculaId", a."autorizacaoComunicacaoAcademicaId", cv."numeroId", cv."contatoId",
         c."alunoId", c."responsavelId"
    INTO atendimento_finalidade, atendimento_aluno_id, atendimento_matricula_id, atendimento_autorizacao_id,
         atendimento_numero_id, atendimento_contato_id,
         contato_aluno_id, contato_responsavel_id
  FROM "AtendimentoWhatsApp" a
  JOIN "ConversaWhatsApp" cv ON cv.id = a."conversaId"
  JOIN "ContatoWhatsApp" c ON c.id = cv."contatoId"
  WHERE a.id = NEW."atendimentoId"
  FOR SHARE OF a, cv, c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intenção não possui atendimento válido.';
  END IF;
  IF atendimento_finalidade <> 'PEDAGOGICO' OR atendimento_aluno_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW."numeroId" IS DISTINCT FROM atendimento_numero_id
    OR NEW."contatoId" IS DISTINCT FROM atendimento_contato_id THEN
    RAISE EXCEPTION 'Intenção pedagógica deve usar o número e contato do atendimento.';
  END IF;
  IF atendimento_matricula_id IS NULL THEN
    RAISE EXCEPTION 'Atendimento pedagógico legado exige conferência antes de novo envio.';
  END IF;

  IF contato_responsavel_id IS NOT NULL THEN
    IF atendimento_autorizacao_id IS NULL THEN
      RAISE EXCEPTION 'Intenção pedagógica exige autorização vigente do responsável.';
    END IF;
    PERFORM 1
    FROM "AutorizacaoComunicacaoAcademica" au
    JOIN "Matricula" m ON m.id = au."matriculaId"
    JOIN "AlunoResponsavel" ar ON ar."alunoId" = m."alunoId"
      AND ar."responsavelId" = au."responsavelId"
    WHERE au.id = atendimento_autorizacao_id
      AND au."matriculaId" = atendimento_matricula_id
      AND au."responsavelId" = contato_responsavel_id
      AND m."alunoId" = atendimento_aluno_id
      AND ar.papel = 'PEDAGOGICO'::"PapelResponsavel"
      AND au."vigenteEm" <= CURRENT_TIMESTAMP
      AND au."revogadaEm" IS NULL
    FOR SHARE OF au, m, ar;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Intenção pedagógica exige autorização vigente do responsável.';
    END IF;
  ELSIF contato_aluno_id = atendimento_aluno_id THEN
    IF atendimento_autorizacao_id IS NOT NULL THEN
      RAISE EXCEPTION 'Atendimento pedagógico direto ao aluno não usa autorização de responsável.';
    END IF;
    PERFORM 1 FROM "Matricula" m
      WHERE m.id = atendimento_matricula_id AND m."alunoId" = atendimento_aluno_id
      FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Matrícula pedagógica não corresponde ao aluno do atendimento.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Contato pedagógico não corresponde ao aluno ou responsável autorizado.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validar_intencao_destino_direto_pedagogico_atual_265()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  atendimento_finalidade "FinalidadeAtendimentoWhatsApp";
  atendimento_aluno_id TEXT;
  atendimento_matricula_id TEXT;
  atendimento_autorizacao_id TEXT;
  atendimento_numero_id TEXT;
  atendimento_contato_id TEXT;
  contato_aluno_id TEXT;
  contato_responsavel_id TEXT;
  contato_telefone TEXT;
BEGIN
  IF NEW."atendimentoId" IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('PENDENTE', 'ADIADA', 'ENVIANDO') THEN
    RETURN NEW;
  END IF;

  SELECT a.finalidade, a."alunoId"
    INTO atendimento_finalidade, atendimento_aluno_id
  FROM "AtendimentoWhatsApp" a
  WHERE a.id = NEW."atendimentoId";
  IF NOT FOUND OR atendimento_finalidade <> 'PEDAGOGICO' OR atendimento_aluno_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.finalidade, a."alunoId", a."matriculaId", a."autorizacaoComunicacaoAcademicaId", cv."numeroId", cv."contatoId",
         c."alunoId", c."responsavelId", c."telefoneE164"
    INTO atendimento_finalidade, atendimento_aluno_id, atendimento_matricula_id, atendimento_autorizacao_id,
         atendimento_numero_id, atendimento_contato_id,
         contato_aluno_id, contato_responsavel_id, contato_telefone
  FROM "AtendimentoWhatsApp" a
  JOIN "ConversaWhatsApp" cv ON cv.id = a."conversaId"
  JOIN "ContatoWhatsApp" c ON c.id = cv."contatoId"
  WHERE a.id = NEW."atendimentoId"
  FOR SHARE OF a, cv, c;

  IF NOT FOUND OR atendimento_finalidade <> 'PEDAGOGICO' OR atendimento_aluno_id IS NULL
    OR atendimento_autorizacao_id IS NOT NULL OR contato_responsavel_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW."numeroId" IS DISTINCT FROM atendimento_numero_id
    OR NEW."contatoId" IS DISTINCT FROM atendimento_contato_id THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM "Matricula" m
  JOIN "Aluno" a ON a.id = m."alunoId"
  WHERE m.id = atendimento_matricula_id
    AND m."alunoId" = atendimento_aluno_id
    AND contato_aluno_id = atendimento_aluno_id
    AND a.whatsapp IS TRUE
    AND a."telefoneE164" IS NOT NULL
    AND a."telefoneE164" = contato_telefone
  FOR SHARE OF m, a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intenção pedagógica direta exige telefone WhatsApp atual do aluno.';
  END IF;
  RETURN NEW;
END;
$$;
