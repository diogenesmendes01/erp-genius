import { StatusCobranca, TipoCobranca, type DriverWhatsApp, type EstadoPolitica } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REGUA } from "@/server/cobrancas/regua";
import { MODOS_FABRICA, POLITICA_COBRANCA_NOME, TEXTOS_FABRICA } from "@/server/cobrancas/fabrica";
import { seedCatalogoMinimo } from "./integracao";

// Helpers das suítes de integração do canal WhatsApp (doc 30 E1/E2).
// O fuso usado é o DA MÁQUINA para os checks de janela serem determinísticos em qualquer TZ.

export const FUSO_MAQUINA = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "agora" de hoje com hora controlada — vencimentos derivados dele estabilizam o degrau. */
export const agoraAs = (hora: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, 0, 0);
};

export const diasDepois = (base: Date, dias: number) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);

export async function seedCanal(
  over: { driver?: DriverWhatsApp; estado?: EstadoPolitica; janela?: [number, number] } = {},
) {
  const numero = await prisma.numeroWhatsApp.create({
    data: {
      telefoneE164: "+5511999990000",
      rotulo: "Cobrança (teste)",
      driver: over.driver ?? "META_CLOUD",
      finalidade: "COBRANCA",
      providerRef: "PHONE_ID_TESTE",
    },
  });
  const templates = new Map<string, string>();
  for (const [nome, corpo] of Object.entries(TEXTOS_FABRICA)) {
    const t = await prisma.templateWhatsApp.create({ data: { nome, corpo, statusMeta: "APROVADO" } });
    templates.set(nome, t.id);
  }
  const politica = await prisma.politicaRegua.create({
    data: {
      nome: POLITICA_COBRANCA_NOME,
      estado: over.estado ?? "SHADOW",
      janelaInicio: over.janela?.[0] ?? 0,
      janelaFim: over.janela?.[1] ?? 24,
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      numeroRemetenteId: numero.id,
      degraus: {
        create: REGUA.map((d) => ({
          passo: d.passo,
          offsetDias: d.offsetDias,
          tipo: d.tipo,
          rotulo: d.rotulo,
          modo: MODOS_FABRICA[d.passo],
          templateId: templates.get(d.template) ?? null,
        })),
      },
    },
  });
  return { numero, politica, templates };
}

export async function seedCobranca(
  over: {
    telefoneAluno?: string | null;
    responsavelTelefone?: string | null;
    vencimento: Date;
    fusoAluno?: string;
  },
  // Reuso do catálogo p/ criar N cobranças no mesmo teste (codigoISO do país é @unique).
  catalogo?: { pais: { id: string }; produto: { id: string } },
) {
  const { pais, produto } = catalogo ?? (await seedCatalogoMinimo());
  const aluno = await prisma.aluno.create({
    data: {
      primeiroNome: "Maria",
      sobrenome: "Teste",
      paisId: pais.id,
      telefoneE164: over.telefoneAluno === undefined ? "+50688887777" : over.telefoneAluno,
      fuso: over.fusoAluno ?? FUSO_MAQUINA,
      ...(over.responsavelTelefone !== undefined
        ? {
            responsaveis: {
              create: {
                papel: "FINANCEIRO",
                responsavel: { create: { nome: "Pai da Maria", telefoneE164: over.responsavelTelefone } },
              },
            },
          }
        : {}),
    },
  });
  const matricula = await prisma.matricula.create({
    data: { alunoId: aluno.id, produtoId: produto.id, paisId: pais.id, moeda: "CRC" },
  });
  const cobranca = await prisma.cobranca.create({
    data: {
      matriculaId: matricula.id,
      tipo: TipoCobranca.MENSALIDADE,
      valorOriginal: 85000,
      valorNegociado: 85000,
      moeda: "CRC",
      vencimento: over.vencimento,
      status: StatusCobranca.PENDENTE,
    },
  });
  return { pais, aluno, matricula, cobranca };
}
