-- FASE 3 (doc 03): acadêmico + portal do aluno.
-- Diário de classe (Aula/Presenca), avaliações (Avaliacao/Nota), teste de nível,
-- certificado com código público de validação, papel ALUNO (portal) e o vínculo
-- Aluno.usuarioId (acesso 1:1 aos PRÓPRIOS dados).

ALTER TYPE "Papel" ADD VALUE IF NOT EXISTS 'ALUNO';

ALTER TABLE "Aluno" ADD COLUMN "usuarioId" TEXT;
CREATE UNIQUE INDEX "Aluno_usuarioId_key" ON "Aluno"("usuarioId");
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Aula" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "conteudo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Aula_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Aula_turmaId_data_key" ON "Aula"("turmaId", "data");
ALTER TABLE "Aula" ADD CONSTRAINT "Aula_turmaId_fkey"
  FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Presenca" (
    "id" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "presente" BOOLEAN NOT NULL,
    "observacao" TEXT,
    CONSTRAINT "Presenca_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Presenca_aulaId_alunoId_key" ON "Presenca"("aulaId", "alunoId");
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_aulaId_fkey"
  FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_alunoId_fkey"
  FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Avaliacao" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "peso" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "data" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Avaliacao_turmaId_nome_key" ON "Avaliacao"("turmaId", "nome");
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_turmaId_fkey"
  FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Nota" (
    "id" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "valor" DECIMAL(5,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Nota_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Nota_avaliacaoId_alunoId_key" ON "Nota"("avaliacaoId", "alunoId");
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_avaliacaoId_fkey"
  FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_alunoId_fkey"
  FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TesteNivel" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "nivelId" TEXT NOT NULL,
    "pontuacao" DECIMAL(5,2),
    "observacao" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TesteNivel_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TesteNivel" ADD CONSTRAINT "TesteNivel_alunoId_fkey"
  FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TesteNivel" ADD CONSTRAINT "TesteNivel_nivelId_fkey"
  FOREIGN KEY ("nivelId") REFERENCES "Nivel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Certificado" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "nivelId" TEXT NOT NULL,
    "turmaId" TEXT,
    "codigoValidacao" TEXT NOT NULL,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certificado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Certificado_codigoValidacao_key" ON "Certificado"("codigoValidacao");
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_alunoId_fkey"
  FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_nivelId_fkey"
  FOREIGN KEY ("nivelId") REFERENCES "Nivel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
