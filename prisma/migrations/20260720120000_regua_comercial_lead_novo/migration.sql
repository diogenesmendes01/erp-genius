-- Régua COMERCIAL como dado (doc 27 §Tese) — cadência "lead novo sem resposta" (C1) e as
-- demais no mesmo modelo. Migration aditiva. Nasce sem registro → seed cria DESLIGADA.

CREATE TABLE "PoliticaComercial" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "estado" "EstadoPolitica" NOT NULL DEFAULT 'DESLIGADA',
    "janelaInicio" INTEGER NOT NULL DEFAULT 9,
    "janelaFim" INTEGER NOT NULL DEFAULT 20,
    "diasSemana" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "tetoPorContatoDia" INTEGER NOT NULL DEFAULT 2,
    "silencioPosInboundHoras" INTEGER NOT NULL DEFAULT 72,
    "numeroRemetenteId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PoliticaComercial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PoliticaComercial_chave_key" ON "PoliticaComercial"("chave");

CREATE TABLE "DegrauComercial" (
    "id" TEXT NOT NULL,
    "politicaId" TEXT NOT NULL,
    "passo" TEXT NOT NULL,
    "offsetMinutos" INTEGER NOT NULL,
    "rotulo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "templateId" TEXT,
    CONSTRAINT "DegrauComercial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DegrauComercial_politicaId_passo_key" ON "DegrauComercial"("politicaId", "passo");

-- Vínculo de domínio da intenção comercial (Lead + passo da cadência) + idempotência.
ALTER TABLE "IntencaoMensagem" ADD COLUMN "leadId" TEXT;
ALTER TABLE "IntencaoMensagem" ADD COLUMN "passoComercial" TEXT;
ALTER TABLE "IntencaoMensagem" ADD COLUMN "politicaComercialId" TEXT;
CREATE UNIQUE INDEX "IntencaoMensagem_leadId_passoComercial_key" ON "IntencaoMensagem"("leadId", "passoComercial");

ALTER TABLE "PoliticaComercial" ADD CONSTRAINT "PoliticaComercial_numeroRemetenteId_fkey" FOREIGN KEY ("numeroRemetenteId") REFERENCES "NumeroWhatsApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DegrauComercial" ADD CONSTRAINT "DegrauComercial_politicaId_fkey" FOREIGN KEY ("politicaId") REFERENCES "PoliticaComercial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DegrauComercial" ADD CONSTRAINT "DegrauComercial_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TemplateWhatsApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_politicaComercialId_fkey" FOREIGN KEY ("politicaComercialId") REFERENCES "PoliticaComercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
