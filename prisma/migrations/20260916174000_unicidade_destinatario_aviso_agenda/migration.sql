-- A antiga unicidade por canal impedia aluno e responsável autorizado no
-- mesmo evento. Email legado continua único; WhatsApp usa identidade imutável.
ALTER TABLE "AvisoAlteracaoAgenda" DROP CONSTRAINT IF EXISTS "AvisoAlteracaoAgenda_eventoId_matriculaId_canal_key";

CREATE UNIQUE INDEX "AvisoAgenda_email_legado_unico"
  ON "AvisoAlteracaoAgenda"("eventoId", "matriculaId", canal)
  WHERE canal = 'EMAIL'::"CanalAvisoAlteracaoAgenda";
CREATE UNIQUE INDEX "AvisoAgenda_whatsapp_aluno_unico"
  ON "AvisoAlteracaoAgenda"("eventoId", "matriculaId", canal, "destinatarioAlunoId")
  WHERE canal = 'WHATSAPP'::"CanalAvisoAlteracaoAgenda" AND "destinatarioAlunoId" IS NOT NULL;
CREATE UNIQUE INDEX "AvisoAgenda_whatsapp_responsavel_unico"
  ON "AvisoAlteracaoAgenda"("eventoId", "matriculaId", canal, "destinatarioResponsavelId")
  WHERE canal = 'WHATSAPP'::"CanalAvisoAlteracaoAgenda" AND "destinatarioResponsavelId" IS NOT NULL;

CREATE OR REPLACE FUNCTION "guard_identidade_destinatario_aviso_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.canal = 'WHATSAPP'::"CanalAvisoAlteracaoAgenda" THEN
    IF (NEW."destinatarioAlunoId" IS NULL) = (NEW."destinatarioResponsavelId" IS NULL) THEN RAISE EXCEPTION 'WhatsApp exige exatamente uma identidade destinatária'; END IF;
    IF NEW."destinatarioResponsavelId" IS NOT NULL AND NEW."autorizacaoComunicacaoAcademicaId" IS NULL THEN RAISE EXCEPTION 'Responsável exige autorização acadêmica'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "guard_identidade_destinatario_aviso_agenda" BEFORE INSERT OR UPDATE ON "AvisoAlteracaoAgenda" FOR EACH ROW EXECUTE FUNCTION "guard_identidade_destinatario_aviso_agenda"();
