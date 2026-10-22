import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { assinarInbox, iniciarEscuta, type AvisoInbox } from "@/server/inbox/barramento";
import { garantirAtendimento } from "./atendimentos";
import { transferirAtendimento } from "./acoes-atendimento";
import { notasDoAtendimento, registrarNotaAtendimento } from "./acoes-conversa";

beforeAll(async () => { await iniciarEscuta(process.env.DATABASE_URL!); });
beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
afterAll(() => prisma.$disconnect());
const comoUsuario = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const pausa = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const escutar = () => { const r: AvisoInbox[] = []; const sair = assinarInbox((x) => r.push(x)); return { r, sair }; };

async function cenario() {
  const fin = await criarUsuario([Papel.VENDEDOR], "Vend");
  const fora = await criarUsuario([Papel.FINANCEIRO], "Fora");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL"], donoId: fin.id });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: fin.id }));
  return { fin, fora, a };
}

describe("nota interna do atendimento", () => {
  it("emite atendimento.atualizado só com ids após gravar a nota", async () => {
    const { fin, a } = await cenario();
    await pausa(300);
    const { r, sair } = escutar();
    try {
      comoUsuario(fin);
      expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Cliente ligou" })).ok).toBe(true);
      const esperado: AvisoInbox = { tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId };
      await vi.waitFor(() => expect(r).toContainEqual(esperado), { timeout: 2000 });
      expect(r.filter((aviso) => aviso.atendimentoId === a.id)).toEqual([esperado]);
      expect(JSON.stringify(r)).not.toContain("Cliente ligou");
      expect(JSON.stringify(r)).not.toContain("paraUsuarioId");
    } finally { sair(); }
  });

  it("repetição idempotente devolve a mesma nota sem novo aviso", async () => {
    const { fin, a } = await cenario();
    comoUsuario(fin);
    const chave = "11111111-1111-4111-8111-111111111111";
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "x", chaveIdempotencia: chave })).ok).toBe(true);
    await pausa(300);
    const { r, sair } = escutar();
    try {
      expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "x", chaveIdempotencia: chave })).ok).toBe(true);
      await pausa(300);
      expect(r.filter((aviso) => aviso.atendimentoId === a.id)).toEqual([]);
      expect(await prisma.evento.count({ where: { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id } })).toBe(1);
    } finally { sair(); }
  });
  it("regra 20: nota interna nunca vira mensagem nem intenção", async () => {
    const { fin, a } = await cenario();
    comoUsuario(fin);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Cliente ligou" })).ok).toBe(true);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
    expect((await notasDoAtendimento(a.id))[0]).toMatchObject({ nota: "Cliente ligou", autorNome: fin.nome });
    const ev = await prisma.evento.findMany({ where: { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id } });
    expect(ev).toHaveLength(1);
    expect(ev[0].payload).toEqual({ nota: "Cliente ligou" });
  });

  it("fora do escopo: recusa e não lista", async () => {
    const { fin, fora, a } = await cenario();
    comoUsuario(fin);
    await registrarNotaAtendimento({ atendimentoId: a.id, nota: "segredo" });
    comoUsuario(fora);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "x" })).ok).toBe(false);
    expect(await notasDoAtendimento(a.id)).toEqual([]);
    expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(1);
  });

  it("nota vazia ou acima de 2000 caracteres é recusada", async () => {
    const { fin, a } = await cenario();
    comoUsuario(fin);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "" })).ok).toBe(false);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "x".repeat(2001) })).ok).toBe(false);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "x".repeat(2000) })).ok).toBe(true);
  });

  it("transferência grava o contexto como nota interna do novo atendimento, com o autor de quem transferiu", async () => {
    const adm = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
    const numero = await criarNumeroSetor({ telefoneE164: "+5511999990002", setores: ["COMERCIAL", "SECRETARIA"], donoId: adm.id });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880002" } });
    const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: adm.id }));
    comoUsuario(adm);
    const contexto = "Pediu histórico escolar";
    const r = await transferirAtendimento({ atendimentoId: a.id, destino: "SECRETARIA", destinoChave: null, contexto });
    expect(r.ok).toBe(true);
    const novoId = r.ok ? r.dado!.novoAtendimentoId : "";
    expect((await notasDoAtendimento(novoId))[0]).toMatchObject({ nota: contexto, autorNome: adm.nome });
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });
});
