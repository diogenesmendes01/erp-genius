import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCobranca } from "@/test/integracao-whatsapp";
import { prepararCobrancaManual } from "./cobranca-manual";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
async function base() {
  const c = await seedCobranca({ vencimento: new Date("2026-10-10T12:00:00Z") });
  const usuario = await criarUsuario([Papel.FINANCEIRO]);
  authMock.mockResolvedValue({ user: { id: usuario.id } });
  const entrada = { cobrancaId: c.cobranca.id, modelo: "amigavel" as const, passo: "D-7" as const, cicloRegua: c.cobranca.cicloRegua, texto: 'Olá! Valor & condições?\nConfirme "recebido".' };
  const pagador = (telefoneE164?: string) => prisma.pagadorPreparacaoMatricula.create({ data: { matriculaId: c.matricula.id, preparadorId: usuario.id, versao: 1, tipo: "EMPRESA",
    dados: { nome: "Empresa pagadora", ...(telefoneE164 ? { telefoneE164 } : {}) }, motivo: "Pagador da fixture", chaveIdempotencia: "manual-pagador", entradaHash: "manual-pagador" } });
  return { ...c, usuario, entrada, pagador };
}
async function contadores() {
  return { eventos: await prisma.evento.count(), mensagens: await prisma.mensagemWhatsApp.count(), intencoes: await prisma.intencaoMensagem.count(), contatos: await prisma.contatoWhatsApp.count() };
}

describe("preparação de cobrança manual", () => {
  it("gera link para o pagador do contrato e não comprova envio nem altera a cobrança", async () => {
    const c = await base(); await c.pagador("+50680001122");
    const antes = await contadores();
    const resultado = await prepararCobrancaManual(c.entrada);
    expect(resultado.ok).toBe(true); if (!resultado.ok) throw new Error(resultado.erro);
    const url = new URL(resultado.dado!.url);
    expect(url.origin).toBe("https://wa.me"); expect(url.pathname).toBe("/50680001122");
    expect(url.searchParams.get("text")).toBe(c.entrada.texto);
    expect(resultado.dado!.matriculaId).toBe(c.matricula.id);
    expect(await contadores()).toEqual(antes);
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: c.cobranca.id } })).toEqual(c.cobranca);
  });

  it("sem telefone do pagador não usa o telefone existente do aluno", async () => {
    const c = await base(); await c.pagador();
    const r = await prepararCobrancaManual(c.entrada);
    expect(r.ok).toBe(false); if (!r.ok) expect(r.erro).toContain("pagador");
    expect(await contadores()).toEqual({ eventos: 0, mensagens: 0, intencoes: 0, contatos: 0 });
  });

  it("nega ciclo antigo, cobrança cancelada, texto vazio e campo de telefone inventado", async () => {
    const c = await base();
    await prisma.cobranca.update({ where: { id: c.cobranca.id }, data: { cicloRegua: { increment: 1 } } });
    expect((await prepararCobrancaManual(c.entrada)).ok).toBe(false);
    expect((await prepararCobrancaManual({ ...c.entrada, cicloRegua: 1, texto: "  " })).ok).toBe(false);
    expect((await prepararCobrancaManual({ ...c.entrada, cicloRegua: 1, telefone: "+50680009999" } as typeof c.entrada)).ok).toBe(false);
    await prisma.cobranca.update({ where: { id: c.cobranca.id }, data: { status: "CANCELADA" } });
    expect((await prepararCobrancaManual({ ...c.entrada, cicloRegua: 1 })).ok).toBe(false);
  });

  it("revalida acesso e recusa vendedor ou usuário inativo", async () => {
    const c = await base();
    await prisma.usuario.update({ where: { id: c.usuario.id }, data: { papeis: [Papel.VENDEDOR] } });
    expect((await prepararCobrancaManual(c.entrada)).ok).toBe(false);
    await prisma.usuario.update({ where: { id: c.usuario.id }, data: { papeis: [Papel.FINANCEIRO], ativo: false } });
    expect((await prepararCobrancaManual(c.entrada)).ok).toBe(false);
  });

  it("não escolhe destinatário global para legado com contratos múltiplos", async () => {
    const c = await base();
    expect((await prepararCobrancaManual(c.entrada)).ok).toBe(true);
    await prisma.matricula.create({ data: { alunoId: c.aluno.id, produtoId: c.matricula.produtoId, paisId: c.pais.id, moeda: "CRC" } });
    expect((await prepararCobrancaManual(c.entrada)).ok).toBe(false);
    await c.pagador("+50680001122");
    expect((await prepararCobrancaManual(c.entrada)).ok).toBe(true);
  });

  it("respeita a suspensão de lembretes durante a conferência do comprovante", async () => {
    const c = await base();
    const informe = await prisma.pagamentoInformado.create({ data: { cobrancaId: c.cobranca.id, autorId: c.usuario.id, chaveIdempotencia: "manual-conferencia",
      valor: 100, moeda: "CRC", forma: "TRANSFERENCIA", dataPagamento: new Date(), suspenderLembretesAte: new Date(Date.now() + 3600000) } });
    const r = await prepararCobrancaManual(c.entrada);
    expect(r.ok).toBe(false); if (!r.ok) expect(r.erro).toContain("suspensos");
    await prisma.pagamentoInformado.update({ where: { id: informe.id }, data: { suspenderLembretesAte: new Date(Date.now() - 1000) } });
    expect((await prepararCobrancaManual(c.entrada)).ok).toBe(true);
  });
});
