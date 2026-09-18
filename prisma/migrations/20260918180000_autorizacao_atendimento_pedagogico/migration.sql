-- Q145: o responsável do aluno recebe atendimento pedagógico somente no
-- contrato que possui autorização vigente. O operador do atendimento continua
-- sendo AtendimentoWhatsApp.responsavelId (Usuario), sem sobrecarga de FK.
ALTER TABLE "AtendimentoWhatsApp"
  ADD COLUMN "autorizacaoComunicacaoAcademicaId" TEXT;

ALTER TABLE "AtendimentoWhatsApp"
  ADD CONSTRAINT "AtendimentoWhatsApp_autorizacaoComunicacaoAcademicaId_fkey"
  FOREIGN KEY ("autorizacaoComunicacaoAcademicaId")
  REFERENCES "AutorizacaoComunicacaoAcademica"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "AtendimentoWhatsApp_autorizacaoComunicacaoAcademicaId_idx"
  ON "AtendimentoWhatsApp"("autorizacaoComunicacaoAcademicaId");

-- Substitui a guarda de 599 preservando as regras financeiras. Registros
-- pedagógicos anteriores a Q145 continuam consultáveis e encerráveis: a regra
-- exige contexto completo somente em INSERT e torna o contexto imutável.
CREATE OR REPLACE FUNCTION validar_contexto_financeiro_atendimento_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  contato_aluno_id TEXT;
  contato_responsavel_id TEXT;
BEGIN
  IF NEW."finalidade" = 'FINANCEIRO' AND NEW."matriculaId" IS NOT NULL AND NEW."alunoId" IS NULL THEN
    RAISE EXCEPTION 'Atendimento financeiro com matrícula exige aluno correspondente.';
  END IF;

  IF TG_OP = 'INSERT' AND NEW."finalidade" = 'FINANCEIRO' AND NEW."matriculaId" IS NULL THEN
    RAISE EXCEPTION 'Novo atendimento financeiro exige matrícula explícita.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."finalidade" = 'FINANCEIRO'
    AND (NEW."finalidade", NEW."conversaId", NEW."contextoChave", NEW."leadId", NEW."alunoId", NEW."turmaId", NEW."matriculaId")
      IS DISTINCT FROM (OLD."finalidade", OLD."conversaId", OLD."contextoChave", OLD."leadId", OLD."alunoId", OLD."turmaId", OLD."matriculaId") THEN
    RAISE EXCEPTION 'Contexto de atendimento financeiro é imutável.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."finalidade" <> 'FINANCEIRO' AND NEW."finalidade" = 'FINANCEIRO' THEN
    RAISE EXCEPTION 'Atendimento histórico não pode ser reclassificado como financeiro.';
  END IF;

  IF NEW."finalidade" = 'PEDAGOGICO' THEN
    IF NEW."alunoId" IS NULL THEN
      IF NEW."matriculaId" IS NOT NULL OR NEW."autorizacaoComunicacaoAcademicaId" IS NOT NULL THEN
        RAISE EXCEPTION 'Atendimento pedagógico de lead não recebe matrícula ou autorização acadêmica.';
      END IF;
    ELSIF TG_OP = 'INSERT' THEN
      IF NEW."matriculaId" IS NULL THEN
        RAISE EXCEPTION 'Novo atendimento pedagógico de aluno exige matrícula explícita.';
      END IF;

      SELECT c."alunoId", c."responsavelId"
        INTO contato_aluno_id, contato_responsavel_id
      FROM "ConversaWhatsApp" cv
      JOIN "ContatoWhatsApp" c ON c.id = cv."contatoId"
      WHERE cv.id = NEW."conversaId"
      FOR SHARE OF cv, c;

      IF contato_responsavel_id IS NOT NULL THEN
        IF NEW."autorizacaoComunicacaoAcademicaId" IS NULL THEN
          RAISE EXCEPTION 'Atendimento pedagógico exige autorização vigente do responsável para esta matrícula.';
        END IF;

        -- A autorização, a matrícula e o vínculo pedagógico são todos
        -- bloqueados antes de concluir a abertura. Assim, uma revogação ou
        -- mudança de papel que aguardue este INSERT é relida após o lock.
        PERFORM 1
        FROM "AutorizacaoComunicacaoAcademica" a
        JOIN "Matricula" m ON m.id = a."matriculaId"
        JOIN "AlunoResponsavel" ar ON ar."alunoId" = m."alunoId"
          AND ar."responsavelId" = a."responsavelId"
        WHERE a.id = NEW."autorizacaoComunicacaoAcademicaId"
          AND a."matriculaId" = NEW."matriculaId"
          AND a."responsavelId" = contato_responsavel_id
          AND m."alunoId" = NEW."alunoId"
          AND ar.papel = 'PEDAGOGICO'::"PapelResponsavel"
          AND a."vigenteEm" <= CURRENT_TIMESTAMP
          AND a."revogadaEm" IS NULL
        FOR SHARE OF a, m, ar;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Atendimento pedagógico exige autorização vigente do responsável para esta matrícula.';
        END IF;
      ELSIF contato_aluno_id = NEW."alunoId" THEN
        IF NEW."autorizacaoComunicacaoAcademicaId" IS NOT NULL THEN
          RAISE EXCEPTION 'Atendimento pedagógico direto ao aluno não usa autorização de responsável.';
        END IF;
        PERFORM 1 FROM "Matricula" m
          WHERE m.id = NEW."matriculaId" AND m."alunoId" = NEW."alunoId"
          FOR SHARE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Matrícula pedagógica não corresponde ao aluno do atendimento.';
        END IF;
      ELSE
        RAISE EXCEPTION 'Contato pedagógico não corresponde ao aluno ou responsável autorizado.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."finalidade" = 'PEDAGOGICO'
    AND (NEW."finalidade", NEW."conversaId", NEW."contextoChave", NEW."leadId", NEW."alunoId", NEW."turmaId", NEW."matriculaId", NEW."autorizacaoComunicacaoAcademicaId")
      IS DISTINCT FROM (OLD."finalidade", OLD."conversaId", OLD."contextoChave", OLD."leadId", OLD."alunoId", OLD."turmaId", OLD."matriculaId", OLD."autorizacaoComunicacaoAcademicaId") THEN
    RAISE EXCEPTION 'Contexto de atendimento pedagógico é imutável.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."finalidade" <> 'PEDAGOGICO' AND NEW."finalidade" = 'PEDAGOGICO' THEN
    RAISE EXCEPTION 'Atendimento histórico não pode ser reclassificado como pedagógico.';
  END IF;

  RETURN NEW;
END;
$$;

-- Uma intenção criada por SQL não pode contornar a conferência da abertura.
-- O guard só incide quando ela pode voltar à fila/claim; atualizações de
-- resultado, auditoria e cancelamento depois da revogação continuam possíveis.
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
  -- Uma intenção pedagógica já contextualizada não pode ser desligada nem
  -- transferida para outro atendimento. Isso impediria que uma autorização
  -- revogada fosse trocada silenciosamente antes do despacho.
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

CREATE TRIGGER validar_intencao_pedagogica_264_trigger
BEFORE INSERT OR UPDATE ON "IntencaoMensagem"
FOR EACH ROW EXECUTE FUNCTION validar_intencao_pedagogica_264();
