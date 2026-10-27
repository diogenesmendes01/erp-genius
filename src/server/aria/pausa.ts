import type { MotivoPausaAtendimentoIA, OrigemEnvio, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado, type UsuarioSessao } from "../_shared";
import { escopoAtendimentos } from "../whatsapp/escopo";

type Tx = Prisma.TransactionClient;

export const MOTIVO_ARIA_PAUSADA = "aria_pausada";

async function cancelarIntencoesDaAria(tx: Tx, atendimentoId: string, preservarIntencaoId: string | null = null): Promise<number> {
  const r = await tx.intencaoMensagem.updateMany({
    where: {
      atendimentoId,
      origem: "IA",
      status: { in: ["PENDENTE", "ADIADA"] },
      ...(preservarIntencaoId ? { id: { not: preservarIntencaoId } } : {}),
    },
    data: { status: "CANCELADA", motivoFalha: MOTIVO_ARIA_PAUSADA, despacharAposEm: null },
  });
  return r.count;
}

export async function pausarAriaNoAtendimento(
  tx: Tx,
  atendimentoId: string,
  motivo: MotivoPausaAtendimentoIA,
  autorId: string | null,
  opcoes: { preservarIntencaoId?: string | null } = {},
): Promise<boolean> {
  await cancelarIntencoesDaAria(tx, atendimentoId, opcoes.preservarIntencaoId ?? null);
  return registrarPausaNoAtendimento(tx, atendimentoId, motivo, autorId);
}

async function registrarPausaNoAtendimento(tx: Tx, atendimentoId: string, motivo: MotivoPausaAtendimentoIA, autorId: string | null): Promise<boolean> {
  const r = await tx.atendimentoWhatsApp.updateMany({
    where: { id: atendimentoId, iaPausadaEm: null },
    data: { iaPausadaEm: new Date(), iaPausaMotivo: motivo },
  });
  if (r.count === 0) return false;
  await registrarEvento(tx, {
    tipo: "AriaPausadaNoAtendimento",
    agregadoTipo: "AtendimentoWhatsApp",
    agregadoId: atendimentoId,
    autorId,
    payload: { motivo },
  });
  return true;
}

export async function aoGravarSaidaHumana(
  tx: Tx,
  m: { atendimentoId: string | null; origem: OrigemEnvio | null; autorId: string | null },
): Promise<void> {
  if (!m.atendimentoId) return;
  if (m.origem === "HUMANO") await pausarAriaNoAtendimento(tx, m.atendimentoId, "HUMANO_RESPONDEU", m.autorId);
  else if (m.origem === "CELULAR") await pausarAriaNoAtendimento(tx, m.atendimentoId, "CELULAR", m.autorId);
}

export async function podeDevolverParaAria(db: Tx | typeof prisma, u: UsuarioSessao, atendimentoId: string): Promise<boolean> {
  const visivel = await db.atendimentoWhatsApp.count({ where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(u, { enviar: true, db })] } });
  return visivel === 1;
}

export async function devolverParaAria(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    await prisma.$transaction(async (tx) => {
      if (!(await podeDevolverParaAria(tx, u, atendimentoId))) throw new ErroRegra("Atendimento fora do seu escopo.");
      const r = await tx.atendimentoWhatsApp.updateMany({
        where: { id: atendimentoId, iaPausadaEm: { not: null } },
        data: { iaPausadaEm: null, iaPausaMotivo: null, iaRetomadaEm: new Date(), iaRetomadaPorId: u.id },
      });
      if (r.count === 0) return;
      await registrarEvento(tx, {
        tipo: "AriaDevolvida",
        agregadoTipo: "AtendimentoWhatsApp",
        agregadoId: atendimentoId,
        autorId: u.id,
        payload: {},
      });
    });
  });
}

export async function pausarAriaComIntencoesTravadasTx(tx: Tx, atendimentoId: string, autorId: string, ids: readonly string[]): Promise<boolean> {
 const qualificados = [...new Set(ids)].sort();
 const atuais = await tx.intencaoMensagem.findMany({where:{atendimentoId,origem:"IA",status:{in:["PENDENTE","ADIADA"]}},select:{id:true},orderBy:{id:"asc"}});
 const mudou = () => new ErroRegra("O conjunto de mensagens da Aria mudou. Atualize a conversa antes de aprovar.");
 if (atuais.length !== qualificados.length || atuais.map(i=>i.id).sort().some((id,i)=>id!==qualificados[i])) throw mudou();
 if (qualificados.length) {
  const r = await tx.intencaoMensagem.updateMany({where:{id:{in:qualificados},atendimentoId,origem:"IA",status:{in:["PENDENTE","ADIADA"]}},data:{status:"CANCELADA",motivoFalha:MOTIVO_ARIA_PAUSADA,despacharAposEm:null}});
  if(r.count!==qualificados.length)throw mudou();
 }
 return registrarPausaNoAtendimento(tx, atendimentoId, "HUMANO_RESPONDEU", autorId);
}