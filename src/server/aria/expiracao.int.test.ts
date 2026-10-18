import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { configPadrao } from "./config-schema";
import { expirarSugestoesAria } from "./expiracao";

beforeEach(truncarBanco);

const agora = new Date("2026-10-18T12:00:00.000Z");
const vencida = new Date("2026-10-18T11:00:00.000Z");
const futura = new Date("2026-10-18T13:00:00.000Z");
let seq = 0;

async function publicar(acaoExpiracao: "HANDOFF" | "DESCARTAR") {
  const dono = await criarUsuario([], "Camila Souza");
  const c = configPadrao();
  const config = { ...c, confianca: { ...c.confianca, acaoExpiracao } };
  await prisma.versaoAgenteIA.create({
    data: { numero: 1, status: "PUBLICADA", config, criadaPorId: dono.id, publicadaPorId: dono.id, publicadaEm: new Date() },
  });
  return dono;
}

async function atendimentoComSugestoes(expiraEm: Date[]) {
  const cat = await seedCatalogoMinimo();
  const dono = await criarUsuario([], "Vendedor");
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const n = ++seq;
  const tel = `+5067777${String(1000 + n)}`;
  const op = await prisma.oportunidade.create({ data: { nome: "Ana Lima", paisId: cat.pais.id, telefoneE164: tel, vendedorDonoId: dono.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: tel, leadId: op.id, nomeExibicao: "Ana Lima" } });
  const at = await prisma.$transaction((tx) =>
    garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: op.id }),
  );
  const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id }, select: { conversaId: true } });
  const ancora = await prisma.mensagemWhatsApp.create({
    data: {
      atendimentoId: at.id, conversaId: conv.conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo: "oi",
      driver: "MOTOR", status: "ENTREGUE", providerMessageId: `exp-${n}`,
    },
  });
  const turno = await prisma.turnoAgenteIA.create({
    data: { ancoraMensagemId: ancora.id, atendimentoId: at.id, tipo: "ATENDIMENTO", resultado: "EM_ANDAMENTO" },
  });
  const acoes = [];
  for (const e of expiraEm) {
    acoes.push(
      await prisma.acaoAgenteIA.create({
        data: {
          turnoId: turno.id, atendimentoId: at.id, oportunidadeId: op.id, acao: "RESPONDER", modoConfigurado: "SUGERE",
          status: "SUGERIDA", confianca: 70, payload: { texto: "Olá" }, reversivel: false, expiraEm: e,
        },
      }),
    );
  }
  return { at, acoes, op };
}

describe("expirarSugestoesAria", () => {
  it("vencida_com_handoff_transfere_uma_vez_por_atendimento", async () => {
    await publicar("HANDOFF");
    const c = await atendimentoComSugestoes([vencida, vencida]);
    expect(await expirarSugestoesAria(agora)).toEqual({ expiradas: 2, handoffs: 1 });
    const status = await prisma.acaoAgenteIA.findMany({ where: { id: { in: c.acoes.map((a) => a.id) } }, select: { status: true } });
    expect(status.map((s) => s.status)).toEqual(["EXPIRADA", "EXPIRADA"]);
    expect(await prisma.acaoAgenteIA.count({ where: { acao: "HANDOFF", atendimentoId: c.at.id } })).toBe(1);
    expect(await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.at.id } })).toMatchObject({ iaPausaMotivo: "HANDOFF" });
    const ev = await prisma.evento.findFirstOrThrow({ where: { tipo: "AriaHandoff" } });
    expect(ev.payload).toMatchObject({ motivo: "CONFIANCA" });
    expect(await prisma.evento.count({ where: { tipo: "AcaoAriaExpirada" } })).toBe(2);
  });

  it("descartar_so_expira", async () => {
    await publicar("DESCARTAR");
    const c = await atendimentoComSugestoes([vencida, vencida]);
    expect(await expirarSugestoesAria(agora)).toEqual({ expiradas: 2, handoffs: 0 });
    expect(await prisma.acaoAgenteIA.count({ where: { acao: "HANDOFF" } })).toBe(0);
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.at.id } })).iaPausadaEm).toBeNull();
  });

  it("nao_vencida_fica", async () => {
    await publicar("HANDOFF");
    const c = await atendimentoComSugestoes([futura]);
    expect((await expirarSugestoesAria(agora)).expiradas).toBe(0);
    expect((await prisma.acaoAgenteIA.findUniqueOrThrow({ where: { id: c.acoes[0].id } })).status).toBe("SUGERIDA");
  });

  it("atendimento_ja_pausado_expira_sem_handoff", async () => {
    await publicar("HANDOFF");
    const c = await atendimentoComSugestoes([vencida]);
    await prisma.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { iaPausadaEm: new Date(), iaPausaMotivo: "HUMANO_RESPONDEU" } });
    expect(await expirarSugestoesAria(agora)).toEqual({ expiradas: 1, handoffs: 0 });
  });

  it("idempotente_na_segunda_passada", async () => {
    await publicar("HANDOFF");
    await atendimentoComSugestoes([vencida]);
    await expirarSugestoesAria(agora);
    expect(await expirarSugestoesAria(agora)).toEqual({ expiradas: 0, handoffs: 0 });
  });
});
