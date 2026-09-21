-- Q145: a identidade direta do aluno também é dinâmica. A matrícula basta
-- para situar o histórico, mas não autoriza novo envio para telefone removido,
-- trocado ou sem WhatsApp ativo.
CREATE OR REPLACE FUNCTION validar_destino_direto_pedagogico_atual_265()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  contato_aluno_id TEXT;
  contato_responsavel_id TEXT;
  contato_telefone TEXT;
BEGIN
  IF NEW."finalidade" <> 'PEDAGOGICO' OR NEW."alunoId" IS NULL
    OR NEW."autorizacaoComunicacaoAcademicaId" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT c."alunoId", c."responsavelId", c."telefoneE164"
    INTO contato_aluno_id, contato_responsavel_id, contato_telefone
  FROM "ConversaWhatsApp" cv
  JOIN "ContatoWhatsApp" c ON c.id = cv."contatoId"
  WHERE cv.id = NEW."conversaId"
  FOR SHARE OF cv, c;

  -- O ramo de responsável continua sendo protegido pela autorização 264.
  IF contato_responsavel_id IS NOT NULL OR contato_aluno_id IS DISTINCT FROM NEW."alunoId" THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM "Matricula" m
  JOIN "Aluno" a ON a.id = m."alunoId"
  WHERE m.id = NEW."matriculaId"
    AND m."alunoId" = NEW."alunoId"
    AND a.whatsapp IS TRUE
    AND a."telefoneE164" IS NOT NULL
    AND a."telefoneE164" = contato_telefone
  FOR SHARE OF m, a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendimento pedagógico direto exige telefone WhatsApp atual do aluno.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validar_destino_direto_pedagogico_atual_atendimento_265
BEFORE INSERT ON "AtendimentoWhatsApp"
FOR EACH ROW EXECUTE FUNCTION validar_destino_direto_pedagogico_atual_265();

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
  -- Resultado e auditoria de intenção histórica continuam graváveis depois da
  -- mudança do contato; a trava é somente quando ela pode voltar ao envio.
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('PENDENTE', 'ADIADA', 'ENVIANDO') THEN
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

CREATE TRIGGER validar_intencao_destino_direto_pedagogico_atual_265
BEFORE INSERT OR UPDATE ON "IntencaoMensagem"
FOR EACH ROW EXECUTE FUNCTION validar_intencao_destino_direto_pedagogico_atual_265();
