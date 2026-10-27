import { PrismaClient } from "@prisma/client";
import { REGUA } from "../src/server/cobrancas/regua";
import { MODOS_FABRICA, POLITICA_COBRANCA_NOME, TEXTOS_FABRICA } from "../src/server/cobrancas/fabrica";

export async function semearWhatsApp(prisma: PrismaClient): Promise<void> {
  const templates = new Map<string, string>();
  for (const [nome, corpo] of Object.entries(TEXTOS_FABRICA)) {
    const t = await prisma.templateWhatsApp.upsert({
      where: { nome },
      create: { nome, corpo, idioma: "es", categoria: "utility", statusMeta: "RASCUNHO" },
      update: {},
    });
    templates.set(nome, t.id);
  }
  console.log(`WhatsApp: ${templates.size} templates garantidos.`);

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
      update: {},
    });
  }
  console.log(`WhatsApp: política "${POLITICA_COBRANCA_NOME}" garantida (DESLIGADA) com ${REGUA.length} degraus.`);
}

const executadoDireto = process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed-whatsapp.ts");
if (executadoDireto) {
  const prisma = new PrismaClient();
  semearWhatsApp(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
