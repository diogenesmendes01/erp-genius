CREATE TABLE "AutorizacaoComunicacaoAcademica" (
 "id" TEXT PRIMARY KEY, "matriculaId" TEXT NOT NULL, "responsavelId" TEXT NOT NULL, "autorizadaPorId" TEXT NOT NULL, "evidencia" TEXT NOT NULL, "vigenteEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "revogadaEm" TIMESTAMPTZ, "revogadaPorId" TEXT,
 FOREIGN KEY ("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT,
 FOREIGN KEY ("responsavelId") REFERENCES "Responsavel"(id) ON DELETE RESTRICT,
 FOREIGN KEY ("autorizadaPorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT,
 FOREIGN KEY ("revogadaPorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT
);
ALTER TABLE "AvisoAlteracaoAgenda" ADD CONSTRAINT "AvisoAlteracaoAgenda_autorizacaoComunicacaoAcademicaId_fkey" FOREIGN KEY ("autorizacaoComunicacaoAcademicaId") REFERENCES "AutorizacaoComunicacaoAcademica"(id) ON DELETE RESTRICT;
CREATE INDEX "AutorizacaoComunicacaoAcademica_matriculaId_responsavelId_vigenteEm_idx" ON "AutorizacaoComunicacaoAcademica"("matriculaId","responsavelId","vigenteEm");
