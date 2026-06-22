-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "documento" TEXT,
ADD COLUMN     "genero" "Genero",
ADD COLUMN     "nascimento" TIMESTAMP(3),
ADD COLUMN     "telefoneE164" TEXT;

