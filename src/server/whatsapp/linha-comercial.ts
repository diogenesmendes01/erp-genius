import { Papel, type AtendimentoWhatsApp, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { congelar, memoPorRequisicao } from "@/server/_shared/memo-requisicao";

export const CHAVE_LINHA = "COMERCIAL:LINHA";

export function ehLinhaComercial(numero: { finalidade: string }): boolean {
  return numero.finalidade === "VENDAS";
}

type Db = Prisma.TransactionClient | typeof prisma;

export async function atendimentoComercialDaLinha(
  tx: Prisma.TransactionClient,
  conversaId: string,
  dados: { leadId?: string | null; responsavelId?: string | null } = {},
): Promise<AtendimentoWhatsApp | null> {
  const conversa = await tx.conversaWhatsApp.findUnique({
    where: { id: conversaId },
    select: { grupoId: true, numero: { select: { finalidade: true, donoId: true } } },
  });
  if (!conversa || conversa.grupoId || !ehLinhaComercial(conversa.numero)) return null;

  const abertos = await tx.atendimentoWhatsApp.findMany({
    where: { conversaId, finalidade: "COMERCIAL", encerradoEm: null },
    orderBy: [{ ultimaMensagemEm: { sort: "desc", nulls: "last" } }, { criadoEm: "desc" }],
  });
  const leadId = dados.leadId ?? null;
  const atual = (leadId ? abertos.find((a) => a.leadId === leadId) : undefined)
    ?? abertos.find((a) => a.contextoChave.startsWith(CHAVE_LINHA))
    ?? abertos[0];
  if (atual) {
    if (!leadId || atual.leadId === leadId) return atual;
    if (atual.leadId) return null;
    const marcado = await tx.atendimentoWhatsApp.updateMany({ where: { id: atual.id, leadId: null }, data: { leadId } });
    const depois = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atual.id } });
    return marcado.count === 1 || depois.leadId === leadId ? depois : null;
  }

  const anteriores = await tx.atendimentoWhatsApp.count({ where: { conversaId, contextoChave: { startsWith: CHAVE_LINHA } } });
  const contextoChave = anteriores ? `${CHAVE_LINHA}:${anteriores + 1}` : CHAVE_LINHA;
  const responsavelId = dados.responsavelId ?? conversa.numero.donoId;
  return tx.atendimentoWhatsApp.upsert({
    where: { conversaId_contextoChave: { conversaId, contextoChave } },
    create: {
      conversaId, contextoChave, finalidade: "COMERCIAL", leadId, responsavelId,
      ...(responsavelId ? { status: "EM_ATENDIMENTO" as const } : {}),
    },
    update: {},
  });
}

export async function atendimentoDaLinhaParaInbound(
  tx: Prisma.TransactionClient,
  conversaId: string,
): Promise<string | null | undefined> {
  const c = await tx.conversaWhatsApp.findUnique({
    where: { id: conversaId },
    select: { grupoId: true, numero: { select: { finalidade: true, ativo: true } }, contato: { select: { leadId: true } } },
  });
  if (!c || c.grupoId || !ehLinhaComercial(c.numero)) return undefined;
  const institucional = await tx.atendimentoWhatsApp.count({
    where: { conversaId, encerradoEm: null, finalidade: { not: "COMERCIAL" } },
  });
  if (institucional) return undefined;
  if (!c.numero.ativo) {
    const aberto = await tx.atendimentoWhatsApp.findFirst({
      where: { conversaId, finalidade: "COMERCIAL", encerradoEm: null },
      orderBy: [{ ultimaMensagemEm: { sort: "desc", nulls: "last" } }, { criadoEm: "desc" }],
      select: { id: true },
    });
    return aberto?.id ?? null;
  }
  const a = (await atendimentoComercialDaLinha(tx, conversaId, { leadId: c.contato?.leadId ?? null }))
    ?? (await atendimentoComercialDaLinha(tx, conversaId));
  return a && !a.encerradoEm ? a.id : null;
}

export async function adotarMensagensOrfasDaLinha(
  opcoes: { numeroId?: string; limiteConversas?: number } = {},
): Promise<{ conversas: number; mensagens: number }> {
  const conversas = await prisma.conversaWhatsApp.findMany({
    where: {
      ...(opcoes.numeroId ? { numeroId: opcoes.numeroId } : {}),
      numero: { finalidade: "VENDAS", ativo: true },
      grupoId: null,
      mensagens: { some: { atendimentoId: null } },
      atendimentos: { none: { encerradoEm: null, finalidade: { not: "COMERCIAL" } } },
    },
    select: { id: true },
    take: opcoes.limiteConversas ?? 50,
  });
  let mensagens = 0;
  let adotadas = 0;
  for (const { id: conversaId } of conversas) {
    const movidas = await prisma.$transaction(async (tx) => {
      const atendimentoId = await atendimentoDaLinhaParaInbound(tx, conversaId);
      if (!atendimentoId) return 0;
      const entradas = await tx.mensagemWhatsApp.count({ where: { conversaId, atendimentoId: null, direcao: "ENTRADA" } });
      const orfas = await tx.mensagemWhatsApp.updateMany({ where: { conversaId, atendimentoId: null }, data: { atendimentoId } });
      if (!orfas.count) return 0;
      const ultima = await tx.mensagemWhatsApp.aggregate({ where: { atendimentoId }, _max: { criadoEm: true } });
      const ultimoInbound = await tx.mensagemWhatsApp.aggregate({ where: { atendimentoId, direcao: "ENTRADA" }, _max: { criadoEm: true } });
      await tx.atendimentoWhatsApp.update({ where: { id: atendimentoId }, data: {
        ultimaMensagemEm: ultima._max.criadoEm,
        ultimoInboundEm: ultimoInbound._max.criadoEm,
        naoLidas: { increment: entradas },
      } });
      return orfas.count;
    });
    if (movidas) { adotadas += 1; mensagens += movidas; }
  }
  return { conversas: adotadas, mensagens };
}

export async function donosDeLinhaVisiveis(usuario: { id: string; papeis: Papel[] }, db: Db = prisma): Promise<string[]> {
  const vendedor = usuario.papeis.includes(Papel.VENDEDOR);
  const gerente = usuario.papeis.includes(Papel.GERENTE_COMERCIAL);
  if (!usuario.id || (!vendedor && !gerente)) return [];
  if (!gerente) return [usuario.id];
  return db === prisma ? equipeMemo(usuario.id) : equipeComercial(usuario.id, db);
}

async function equipeComercial(gerenteId: string, db: Db): Promise<string[]> {
  const equipe = await db.usuario.findMany({ where: { gerenteComercialId: gerenteId }, select: { id: true } });
  return [...new Set([gerenteId, ...equipe.map((m) => m.id)])];
}

const equipeMemo = memoPorRequisicao((gerenteId: string) => equipeComercial(gerenteId, prisma).then(congelar));

export function whereLinhasDosDonos(donos: string[]): Prisma.AtendimentoWhatsAppWhereInput {
  return { finalidade: "COMERCIAL", conversa: { numero: { finalidade: "VENDAS", ativo: true, donoId: { in: donos } } } };
}

