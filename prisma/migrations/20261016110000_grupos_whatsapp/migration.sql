-- AlterTable
ALTER TABLE "ConversaWhatsApp" ADD COLUMN     "grupoId" TEXT,
ALTER COLUMN "contatoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MensagemWhatsApp" ADD COLUMN     "participanteE164" TEXT,
ADD COLUMN     "participanteJid" TEXT,
ADD COLUMN     "participanteNome" TEXT;

-- CreateTable
CREATE TABLE "GrupoWhatsApp" (
    "id" TEXT NOT NULL,
    "numeroId" TEXT NOT NULL,
    "grupoJid" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "turmaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrupoWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrupoWhatsApp_numeroId_grupoJid_key" ON "GrupoWhatsApp"("numeroId", "grupoJid");

-- CreateIndex
CREATE UNIQUE INDEX "ConversaWhatsApp_numeroId_grupoId_key" ON "ConversaWhatsApp"("numeroId", "grupoId");

-- AddForeignKey
ALTER TABLE "GrupoWhatsApp" ADD CONSTRAINT "GrupoWhatsApp_numeroId_fkey" FOREIGN KEY ("numeroId") REFERENCES "NumeroWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoWhatsApp" ADD CONSTRAINT "GrupoWhatsApp_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaWhatsApp" ADD CONSTRAINT "ConversaWhatsApp_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Conversa tem contato OU grupo, nunca os dois nem nenhum (E3.5).
ALTER TABLE "ConversaWhatsApp" ADD CONSTRAINT "Conversa_contato_xor_grupo" CHECK (num_nonnulls("contatoId", "grupoId") = 1);

-- Conversa de grupo não abre atendimento (E3.5). Os triggers 264/265 não mudam.
CREATE OR REPLACE FUNCTION impedir_atendimento_em_grupo() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ConversaWhatsApp" WHERE "id" = NEW."conversaId" AND "grupoId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Conversa de grupo não abre atendimento.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER impedir_atendimento_em_grupo
BEFORE INSERT OR UPDATE OF "conversaId" ON "AtendimentoWhatsApp"
FOR EACH ROW EXECUTE FUNCTION impedir_atendimento_em_grupo();
