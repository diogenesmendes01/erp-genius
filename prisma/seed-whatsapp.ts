import { PrismaClient } from "@prisma/client";
import { REGUA } from "../src/server/cobrancas/regua";
import { MODOS_FABRICA, POLITICA_COBRANCA_NOME, TEXTOS_FABRICA } from "../src/server/cobrancas/fabrica";

// Seed do canal WhatsApp (doc 30 E1): templates de fábrica + política padrão da régua.
// Idempotente (upsert por nome) e SEGURO: a política nasce DESLIGADA e sem número
// remetente — nada dispara até o admin configurar e ligar (doc 27 §regra de ouro).
// Rodar: npx tsx prisma/seed-whatsapp.ts

const prisma = new PrismaClient();

async function main() {
  // 1. Templates — fonte única dos textos (doc 29 regra 4).
  const templates = new Map<string, string>();
  for (const [nome, corpo] of Object.entries(TEXTOS_FABRICA)) {
    const t = await prisma.templateWhatsApp.upsert({
      where: { nome },
      create: { nome, corpo, idioma: "es", categoria: "utility", statusMeta: "RASCUNHO" },
      update: {}, // não sobrescreve edições do admin
    });
    templates.set(nome, t.id);
  }
  console.log(`Templates: ${templates.size} garantidos.`);

  // 2. Política padrão (DESLIGADA) + degraus de fábrica.
  const politica = await prisma.politicaRegua.upsert({
    where: { nome: POLITICA_COBRANCA_NOME },
    create: { nome: POLITICA_COBRANCA_NOME, escopo: "COBRANCA", estado: "DESLIGADA" },
    update: {},
  });

  for (const d of REGUA) {
    await prisma.degrauPolitica.upsert({
      where: { politicaId_passo: { politicaId: politica.id, passo: d.passo } },
      create: {
        politicaId: politica.id,
        passo: d.passo,
        offsetDias: d.offsetDias,
        tipo: d.tipo,
        rotulo: d.rotulo,
        modo: MODOS_FABRICA[d.passo],
        ativo: true,
        templateId: templates.get(d.template) ?? null,
      },
      update: {}, // não sobrescreve edições do admin
    });
  }
  console.log(`Política "${POLITICA_COBRANCA_NOME}" garantida (estado DESLIGADA) com ${REGUA.length} degraus.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
