import { Papel, type FinalidadeAtendimentoWhatsApp, type Prisma, type RegraDistribuicao } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento, type Resultado } from "@/server/_shared";
import { setoresDoUsuario } from "@/server/crm/setores-papel";
import { SETORES } from "@/server/whatsapp/setor";

export type MotivoAtribuicao = "CARTEIRA" | "RODIZIO" | "MENOR_CARGA";

/** Setores que o autor pode configurar: Admin todos; Gerente Comercial só COMERCIAL; Gerente Pedagógico só PEDAGOGICO. */
export function setoresEditaveis(papeis: Papel[]): FinalidadeAtendimentoWhatsApp[] {
  if (papeis.includes(Papel.ADMINISTRADOR)) return [...SETORES];
  const r: FinalidadeAtendimentoWhatsApp[] = [];
  if (papeis.includes(Papel.GERENTE_COMERCIAL)) r.push("COMERCIAL");
  if (papeis.includes(Papel.GERENTE_PEDAGOGICO)) r.push("PEDAGOGICO");
  return r;
}

export async function exigirEdicaoDoSetor(finalidade: FinalidadeAtendimentoWhatsApp) {
  const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.GERENTE_PEDAGOGICO);
  if (!setoresEditaveis(autor.papeis).includes(finalidade)) throw new ErroRegra("Você não pode configurar este setor.");
  return autor;
}

interface EntradaEscolha {
  regra: RegraDistribuicao;
  participantes: string[];
  ultimoAtribuidoId: string | null;
  cargaAberta: Record<string, number>;
  donoCarteira: string | null;
}

/** Pura. Carteira vem primeiro; depois rodízio (ordem da lista) ou menor carga (empate pela ordem); MANUAL/sem participantes = fila (null). */
export function escolherResponsavel(i: EntradaEscolha): string | null {
  if (i.regra === "MANUAL" || i.participantes.length === 0) return null;
  if (i.donoCarteira) return i.donoCarteira;
  return escolhaDaRegra(i)?.id ?? null;
}

function escolhaDaRegra(i: EntradaEscolha): { id: string; motivo: MotivoAtribuicao } | null {
  if (i.regra === "RODIZIO") {
    const pos = i.ultimoAtribuidoId ? i.participantes.indexOf(i.ultimoAtribuidoId) : -1;
    return { id: i.participantes[(pos + 1) % i.participantes.length], motivo: "RODIZIO" };
  }
  if (i.regra === "MENOR_CARGA") {
    let melhor = i.participantes[0];
    for (const p of i.participantes) if ((i.cargaAberta[p] ?? 0) < (i.cargaAberta[melhor] ?? 0)) melhor = p;
    return { id: melhor, motivo: "MENOR_CARGA" };
  }
  return null;
}

const DistribuicaoSchema = z.object({
  finalidade: z.enum(SETORES as unknown as [FinalidadeAtendimentoWhatsApp, ...FinalidadeAtendimentoWhatsApp[]]),
  regra: z.enum(["RODIZIO", "MENOR_CARGA", "MANUAL"]),
  participantesIds: z.array(z.string().trim().min(1)).max(100),
});

export async function salvarDistribuicaoSetor(i: { finalidade: FinalidadeAtendimentoWhatsApp; regra: RegraDistribuicao; participantesIds: string[] }): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = DistribuicaoSchema.parse(i);
    const autor = await exigirEdicaoDoSetor(dados.finalidade);
    const ids = [...new Set(dados.participantesIds)];
    await prisma.$transaction(async (tx) => {
      const usuarios = await tx.usuario.findMany({ where: { id: { in: ids }, ativo: true }, select: { id: true, papeis: true } });
      for (const id of ids) {
        const u = usuarios.find((x) => x.id === id);
        if (!u) throw new ErroRegra("Participante inexistente ou inativo.");
        if (!setoresDoUsuario(u.papeis).includes(dados.finalidade)) throw new ErroRegra("Participante não pertence a este setor.");
      }
      const antes = await tx.prazoRespostaSetor.findUnique({ where: { finalidade: dados.finalidade }, select: { regraDistribuicao: true, participantesIds: true } });
      await tx.prazoRespostaSetor.upsert({
        where: { finalidade: dados.finalidade },
        create: { finalidade: dados.finalidade, minutos: 60, regraDistribuicao: dados.regra, participantesIds: ids },
        update: { regraDistribuicao: dados.regra, participantesIds: ids },
      });
      await registrarEvento(tx, {
        tipo: "DistribuicaoAlterada", agregadoTipo: "ConfigSetorAtendimento", agregadoId: dados.finalidade, autorId: autor.id,
        payload: { finalidade: dados.finalidade, de: antes ?? null, para: { regra: dados.regra, participantesIds: ids } },
      });
    });
    return undefined;
  });
}

/**
 * Atribuição automática na abertura sem responsável (primeiro inbound). Trava a linha do setor com
 * FOR UPDATE para o rodízio não repetir sob concorrência. Devolve o responsável ou null (fila).
 */
export async function atribuirAutomaticamente(tx: Prisma.TransactionClient, atendimentoId: string): Promise<string | null> {
  const a = await tx.atendimentoWhatsApp.findUnique({
    where: { id: atendimentoId },
    select: { finalidade: true, status: true, responsavelId: true, primeiroInboundEm: true, encerradoEm: true, leadId: true, conversa: { select: { grupoId: true, contato: { select: { leadId: true } } } } },
  });
  if (!a || a.responsavelId || a.encerradoEm || a.primeiroInboundEm || a.status !== "ABERTO_SEM_RESPONSAVEL" || a.conversa.grupoId) return null;
  const travada = await tx.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok FROM "PrazoRespostaSetor" WHERE "finalidade" = ${a.finalidade}::"FinalidadeAtendimentoWhatsApp" FOR UPDATE`;
  if (!travada.length) return null;
  const cfg = await tx.prazoRespostaSetor.findUniqueOrThrow({ where: { finalidade: a.finalidade } });
  if (cfg.regraDistribuicao === "MANUAL") return null;
  const ativos = await tx.usuario.findMany({ where: { id: { in: cfg.participantesIds }, ativo: true }, select: { id: true } });
  const ativosSet = new Set(ativos.map((u) => u.id));
  const participantes = cfg.participantesIds.filter((id) => ativosSet.has(id));
  if (!participantes.length) return null;

  let donoCarteira: string | null = null;
  const leadId = a.leadId ?? a.conversa.contato?.leadId ?? null;
  if (a.finalidade === "COMERCIAL" && leadId) {
    const lead = await tx.oportunidade.findUnique({ where: { id: leadId }, select: { vendedorDonoId: true } });
    if (lead?.vendedorDonoId) {
      const dono = await tx.usuario.findFirst({ where: { id: lead.vendedorDonoId, ativo: true }, select: { id: true } });
      donoCarteira = dono?.id ?? null;
    }
  }
  const grupos = await tx.atendimentoWhatsApp.groupBy({
    by: ["responsavelId"], _count: { _all: true },
    where: { finalidade: a.finalidade, encerradoEm: null, responsavelId: { in: participantes } },
  });
  const cargaAberta: Record<string, number> = {};
  for (const g of grupos) if (g.responsavelId) cargaAberta[g.responsavelId] = g._count._all;
  const entrada: EntradaEscolha = { regra: cfg.regraDistribuicao, participantes, ultimoAtribuidoId: cfg.ultimoAtribuidoId, cargaAberta, donoCarteira };
  const escolhido = escolherResponsavel(entrada);
  if (!escolhido) return null;
  const motivo: MotivoAtribuicao = donoCarteira ? "CARTEIRA" : (escolhaDaRegra(entrada)?.motivo ?? "RODIZIO");

  await tx.atendimentoWhatsApp.update({ where: { id: atendimentoId }, data: { responsavelId: escolhido, status: "EM_ATENDIMENTO" } });
  if (!donoCarteira) await tx.prazoRespostaSetor.update({ where: { finalidade: a.finalidade }, data: { ultimoAtribuidoId: escolhido } });
  await registrarEvento(tx, {
    tipo: "AtendimentoAtribuido", agregadoTipo: "ConfigSetorAtendimento", agregadoId: a.finalidade, autorId: null,
    payload: { atendimentoId, responsavelId: escolhido, motivo },
  });
  return escolhido;
}
