-- E6/C1 (doc 27): auto-lead + saudação automática. Migration ADITIVA.

-- Classe reativa: saudação isenta de janela/teto (gap C20). Default false = nada muda p/
-- as intenções existentes (cobrança/inbox seguem sujeitas aos guard-rails de sempre).
ALTER TABLE "IntencaoMensagem" ADD COLUMN "reativa" BOOLEAN NOT NULL DEFAULT false;

-- Config comercial singleton (id fixo "comercial"). Tudo DESLIGADO por padrão
-- (doc 27 §regra de ouro: toda automação nasce desligada).
CREATE TABLE "ConfigComercial" (
    "id" TEXT NOT NULL DEFAULT 'comercial',
    "autoLeadAtivo" BOOLEAN NOT NULL DEFAULT false,
    "saudacaoAtiva" BOOLEAN NOT NULL DEFAULT false,
    "saudacaoTexto" TEXT NOT NULL DEFAULT 'Olá! Recebemos sua mensagem e já retornamos. 😊',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConfigComercial_pkey" PRIMARY KEY ("id")
);
