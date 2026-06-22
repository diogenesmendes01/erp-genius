-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('MASCULINO', 'FEMININO', 'OUTRO', 'NAO_INFORMADO');

-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN     "email" TEXT,
ADD COLUMN     "genero" "Genero";

