ALTER TABLE "AvisoAlteracaoAgenda" ADD COLUMN "destinatarioAlunoId" TEXT;
ALTER TABLE "AvisoAlteracaoAgenda" ADD COLUMN "destinatarioResponsavelId" TEXT;
ALTER TABLE "AvisoAlteracaoAgenda" ADD COLUMN "autorizacaoComunicacaoAcademicaId" TEXT;
ALTER TABLE "AvisoAlteracaoAgenda" ADD CONSTRAINT "AvisoAlteracaoAgenda_destinatarioAlunoId_fkey" FOREIGN KEY ("destinatarioAlunoId") REFERENCES "Aluno"(id) ON DELETE RESTRICT;
ALTER TABLE "AvisoAlteracaoAgenda" ADD CONSTRAINT "AvisoAlteracaoAgenda_destinatarioResponsavelId_fkey" FOREIGN KEY ("destinatarioResponsavelId") REFERENCES "Responsavel"(id) ON DELETE RESTRICT;
