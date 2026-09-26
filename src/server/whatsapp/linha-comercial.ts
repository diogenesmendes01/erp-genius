import { Papel, type AtendimentoWhatsApp, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { congelar, memoPorRequisicao } from "@/server/_shared/memo-requisicao";

// LINHA COMERCIAL (docs/specs/whatsapp-linha-comercial.md — SPEC-ERP-005).
// Número de finalidade VENDAS é o WhatsApp de trabalho do vendedor: a inbox espelha o aparelho.
// Cada conversa (número + contato) tem UM atendimento COMERCIAL aberto, com ou sem lead; o lead,
// quando surge, é gravado nele (não abre outro). O canal institucional (COBRANCA/AGENDA) não passa
// por aqui — LC-I01.

/** Chave de contexto do atendimento da linha. Reaberturas após encerramento: `COMERCIAL:LINHA:<n>`. */
export const CHAVE_LINHA = "COMERCIAL:LINHA";

export function ehLinhaComercial(numero: { finalidade: string }): boolean {
  return numero.finalidade === "VENDAS";
}

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Atendimento COMERCIAL único da conversa numa linha. Devolve null quando a conversa não é de linha
 * comercial ou quando o atendimento aberto já pertence a OUTRO lead (dois leads com o mesmo telefone:
 * quem chama mantém o atendimento próprio daquele lead, como antes da SPEC-ERP-005).
 * Sem `leadId`, nunca há conflito: devolve (ou cria) o atendimento da linha.
 */
export async function atendimentoComercialDaLinha(
  tx: Prisma.TransactionClient,
  conversaId: string,
  dados: { leadId?: string | null; responsavelId?: string | null } = {},
): Promise<AtendimentoWhatsApp | null> {
  const conversa = await tx.conversaWhatsApp.findUnique({
    where: { id: conversaId },
    select: { numero: { select: { finalidade: true, donoId: true } } },
  });
  if (!conversa || !ehLinhaComercial(conversa.numero)) return null;

  const abertos = await tx.atendimentoWhatsApp.findMany({
    where: { conversaId, finalidade: "COMERCIAL", encerradoEm: null },
    orderBy: [{ ultimaMensagemEm: { sort: "desc", nulls: "last" } }, { criadoEm: "desc" }],
  });
  const leadId = dados.leadId ?? null;
  // Preferência: o atendimento deste lead → o da linha → o mais recente (legado anterior à SPEC).
  const atual = (leadId ? abertos.find((a) => a.leadId === leadId) : undefined)
    ?? abertos.find((a) => a.contextoChave.startsWith(CHAVE_LINHA))
    ?? abertos[0];
  if (atual) {
    if (!leadId || atual.leadId === leadId) return atual;
    if (atual.leadId) return null;
    // Condicional: dois vínculos concorrentes não sobrescrevem um ao outro.
    const marcado = await tx.atendimentoWhatsApp.updateMany({ where: { id: atual.id, leadId: null }, data: { leadId } });
    const depois = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atual.id } });
    return marcado.count === 1 || depois.leadId === leadId ? depois : null;
  }

  // Nenhum aberto: nasce o da linha. Encerrado não reabre — ganha uma chave nova (1 aberto por vez).
  const anteriores = await tx.atendimentoWhatsApp.count({ where: { conversaId, contextoChave: { startsWith: CHAVE_LINHA } } });
  const contextoChave = anteriores ? `${CHAVE_LINHA}:${anteriores + 1}` : CHAVE_LINHA;
  return tx.atendimentoWhatsApp.upsert({
    where: { conversaId_contextoChave: { conversaId, contextoChave } },
    create: {
      conversaId, contextoChave, finalidade: "COMERCIAL", leadId,
      // Auditoria: quem era o dono quando nasceu. O ACESSO vem da linha (LC-D02), não deste campo.
      responsavelId: dados.responsavelId ?? conversa.numero.donoId,
    },
    update: {},
  });
}

/**
 * Roteamento do inbound numa linha (LC §5.2). `undefined` = não se aplica (número institucional,
 * ou a conversa da linha já tem atendimento institucional aberto — ex.: pedagógico aberto pela
 * escola nesse número): o chamador segue o roteamento institucional de sempre.
 */
export async function atendimentoDaLinhaParaInbound(
  tx: Prisma.TransactionClient,
  conversaId: string,
): Promise<string | null | undefined> {
  const c = await tx.conversaWhatsApp.findUnique({
    where: { id: conversaId },
    select: { numero: { select: { finalidade: true, ativo: true } }, contato: { select: { leadId: true } } },
  });
  if (!c || !ehLinhaComercial(c.numero)) return undefined;
  const institucional = await tx.atendimentoWhatsApp.count({
    where: { conversaId, encerradoEm: null, finalidade: { not: "COMERCIAL" } },
  });
  if (institucional) return undefined;
  if (!c.numero.ativo) {
    // Linha desativada não cria atendimento novo; mensagem de conversa já aberta continua nela.
    const aberto = await tx.atendimentoWhatsApp.findFirst({
      where: { conversaId, finalidade: "COMERCIAL", encerradoEm: null },
      orderBy: [{ ultimaMensagemEm: { sort: "desc", nulls: "last" } }, { criadoEm: "desc" }],
      select: { id: true },
    });
    return aberto?.id ?? null;
  }
  const a = (await atendimentoComercialDaLinha(tx, conversaId, { leadId: c.contato.leadId }))
    ?? (await atendimentoComercialDaLinha(tx, conversaId));
  return a && !a.encerradoEm ? a.id : null;
}

/**
 * LC-15: mensagens de linha que ficaram sem atendimento (triagem) antes da SPEC-ERP-005 passam para o
 * atendimento da linha. Idempotente (só toca `atendimentoId IS NULL`); roda ao salvar o número e a
 * cada tick do cron, em lote limitado. Conversa com atendimento institucional aberto fica de fora
 * (continua na triagem administrativa, como qualquer mensagem institucional).
 */
export async function adotarMensagensOrfasDaLinha(
  opcoes: { numeroId?: string; limiteConversas?: number } = {},
): Promise<{ conversas: number; mensagens: number }> {
  const conversas = await prisma.conversaWhatsApp.findMany({
    where: {
      ...(opcoes.numeroId ? { numeroId: opcoes.numeroId } : {}),
      numero: { finalidade: "VENDAS", ativo: true },
      mensagens: { some: { atendimentoId: null } },
      // Sem isso, conversas que ficam na triagem ocupariam o lote de todo tick para sempre.
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
      // Entradas que ninguém da linha leu (estavam só na triagem) chegam como não lidas.
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

/**
 * Donos de linha cujas conversas o usuário vê (LC-D02): o próprio usuário (vendedor ou gerente que
 * possua linha) e, para o gerente comercial, os vendedores da equipe dele. Administrador vê tudo por
 * outra regra. Cobertura de carteira NÃO concede linha (LC-D02); o substituto segue vendo os leads cobertos.
 */
export async function donosDeLinhaVisiveis(usuario: { id: string; papeis: Papel[] }, db: Db = prisma): Promise<string[]> {
  const vendedor = usuario.papeis.includes(Papel.VENDEDOR);
  const gerente = usuario.papeis.includes(Papel.GERENTE_COMERCIAL);
  if (!usuario.id || (!vendedor && !gerente)) return [];
  if (!gerente) return [usuario.id];
  // Lista, thread, contador e envio pedem o escopo na mesma requisição: memo só fora de transação
  // (dentro dela a equipe é lida na própria tx), como em escopoComercialAtual.
  return db === prisma ? equipeMemo(usuario.id) : equipeComercial(usuario.id, db);
}

async function equipeComercial(gerenteId: string, db: Db): Promise<string[]> {
  const equipe = await db.usuario.findMany({ where: { gerenteComercialId: gerenteId }, select: { id: true } });
  return [...new Set([gerenteId, ...equipe.map((m) => m.id)])];
}

const equipeMemo = memoPorRequisicao((gerenteId: string) => equipeComercial(gerenteId, prisma).then(congelar));

/** Filtro de atendimentos da linha visíveis por posse da linha (a regra de carteira segue à parte). */
export function whereLinhasDosDonos(donos: string[]): Prisma.AtendimentoWhatsAppWhereInput {
  return { finalidade: "COMERCIAL", conversa: { numero: { finalidade: "VENDAS", ativo: true, donoId: { in: donos } } } };
}

