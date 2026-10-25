import { Prisma, type PrismaClient } from "@prisma/client";
import { apenasPortal, ErroPermissao, ErroRegra, registrarEvento, type UsuarioSessao } from "@/server/_shared";
import { podeExecutar } from "@/server/inbox/permissoes";
import { rejeitarAcaoAriaTx } from "@/server/aria/historico";
import { pausarAriaNoAtendimento } from "@/server/aria/pausa";
import { atendimentoVisivel } from "./atendimentos";
import { ehLinhaComercial } from "./linha-comercial";
import { proximoStatus } from "./status-atendimento";
import type { Db } from "./escopo";

const MOTIVO = "Conversa assumida por uma pessoa";
const MAX_TENTATIVAS = 3;
class SugestaoSurgiuDuranteEspera extends Error {}
type Tx = Prisma.TransactionClient;

/** Autorização contextual única, também usada pelo DTO; não concede alçada global CRM. */
export async function contextoAssumirAria(db: Db, u: UsuarioSessao, id: string) {
  if (apenasPortal(u)) return null;
  const individual = await db.atendimentoWhatsApp.findFirst({ where: { id, conversa: { grupoId: null } }, select: { id: true } });
  if (!individual) return null;
  const a = await atendimentoVisivel(u, id, true, db);
  if (!a || a.encerradoEm || !a.numero.ativo || a.contato.optOutEm) return null;
  if (a.responsavelId === u.id) return a;
  if (a.responsavelId !== null || !podeExecutar(u, "assumir", {
    setor: a.finalidade, responsavelId: null, linhaComercial: ehLinhaComercial(a.numero), donoLinhaId: a.numero.donoId,
  })) return null;
  return a;
}
async function conferir(tx: Tx, autorId: string, id: string) {
  const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { id: true, nome: true, papeis: true, permissoes: true, ativo: true } });
  if (!u?.ativo) throw new ErroPermissao("Sua sessão não está mais ativa.");
  const a = await contextoAssumirAria(tx, u, id);
  if (!a) throw new ErroRegra("Atendimento fora do seu escopo de envio ou já assumido por outra pessoa.");
  return { u, a };
}
async function repeticao(tx: Tx, id: string, autorId: string, a: { responsavelId: string | null; iaPausadaEm: Date | null; iaPausaMotivo: string | null }) {
  if (a.responsavelId !== autorId || a.iaPausaMotivo !== "MANUAL" || !a.iaPausadaEm) return false;
  const ultimo = await tx.evento.findFirst({
    where: { agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, tipo: { in: ["AtendimentoAssumido", "AtendimentoDevolvido", "AtendimentoAtribuido"] } },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { tipo: true, autorId: true, payload: true },
  });
  const p = ultimo?.payload as Record<string, unknown> | null;
  return ultimo?.tipo === "AtendimentoAssumido" && ultimo.autorId === autorId && p?.daAria === true && p.para === autorId && p.pausaEm === a.iaPausadaEm.toISOString();
}

/** Interna/db-aware: o cliente de pool1 usa a mesma TX em toda a cadeia de autorização. */
export async function assumirAriaNoBanco(db: Pick<PrismaClient, "$transaction">, autorId: string, id: string): Promise<boolean> {
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    try {
      return await db.$transaction(async tx => {
        // Ordem compartilhada com decisões354 e futura355: TODAS as ações antes do pai.
        const travadas = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "AcaoAgenteIA" WHERE "atendimentoId"=${id} AND status='SUGERIDA' ORDER BY id ASC FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${id} FOR NO KEY UPDATE`;
        const { u, a } = await conferir(tx, autorId, id);
        const atuais = await tx.acaoAgenteIA.findMany({ where: { atendimentoId: id, status: "SUGERIDA" }, orderBy: { id: "asc" } });
        const ids = new Set(travadas.map(s => s.id));
        if (atuais.some(s => !ids.has(s.id))) throw new SugestaoSurgiuDuranteEspera();
        const relidas = travadas.length ? await tx.acaoAgenteIA.findMany({ where: { id: { in: [...ids] } } }) : [];
        if (relidas.length !== travadas.length || relidas.some(s => s.atendimentoId !== id || s.status !== "SUGERIDA")) {
          throw new ErroRegra("As sugestões mudaram. Atualize a conversa e tente novamente.");
        }
        if (atuais.length === 0 && await repeticao(tx, id, autorId, a)) return false;
        const anterior = { motivo: a.iaPausaMotivo, pausadaEm: a.iaPausadaEm?.toISOString() ?? null };
        const pausou = await pausarAriaNoAtendimento(tx, id, "MANUAL", u.id);
        if (!pausou) {
          await tx.atendimentoWhatsApp.update({ where: { id }, data: { iaPausaMotivo: "MANUAL", iaPausadaEm: new Date() } });
          await registrarEvento(tx, { tipo: "AriaPausadaNoAtendimento", agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, autorId: u.id, payload: { motivo: "MANUAL", origem: "ASSUMIR", anterior } });
        }
        // O cancelamento de intenções pode esperar outro writer: autorização deve continuar fresca.
        const fresco = await conferir(tx, autorId, id);
        await tx.atendimentoWhatsApp.update({ where: { id }, data: { responsavelId: u.id, status: proximoStatus(fresco.a.status, "ASSUMIDO", true) } });
        // Ser responsável não cria acesso em linha VENDAS: a política é relida após a atribuição.
        await conferir(tx, autorId, id);
        for (const s of atuais) await rejeitarAcaoAriaTx(tx, s, u, MOTIVO);
        const pausa = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id }, select: { iaPausadaEm: true } });
        await registrarEvento(tx, { tipo: "AtendimentoAssumido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, autorId: u.id, payload: { de: a.responsavelId, para: u.id, daAria: true, pausaEm: pausa.iaPausadaEm!.toISOString() } });
        return true;
      });
    } catch (e) {
      if (!(e instanceof SugestaoSurgiuDuranteEspera)) throw e;
      if (tentativa === MAX_TENTATIVAS - 1) throw new ErroRegra("Novas sugestões chegaram durante a operação. Atualize a conversa e tente novamente.");
    }
  }
  throw new ErroRegra("Não foi possível assumir a conversa.");
}
