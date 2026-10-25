import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel, type FinalidadeNumero } from "@prisma/client";
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async original => {
  const real = await original<typeof import("@/server/_shared/sessao")>();
  return { ...real, exigirSessao: async () => {
    const u = await real.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new real.ErroAutenticacao();
    return u;
  } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { vincularContatoWhatsApp } from "@/server/whatsapp/acoes";

beforeEach(async () => { await truncarBanco(); sessao.usuarioId = ""; });
afterEach(() => vi.restoreAllMocks());
afterAll(() => prisma.$disconnect());
let seq = 0;
async function cenario(finalidade: FinalidadeNumero) {
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Administrador fictício329");
  sessao.usuarioId = admin.id;
  const pessoa = await prisma.pessoa.create({ data: { nome: "Retorno fictício329" } });
  const telefone = "+550009329" + (++seq);
  const lead = await prisma.oportunidade.create({ data: { nome: "Curso fictício329", pessoaId: pessoa.id, telefoneE164: telefone, vendedorDonoId: admin.id, etapa: "MATRICULADO" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone, pessoaId: pessoa.id } });
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+550008329" + seq, rotulo: "Canal fictício329", driver: "MOTOR", finalidade, donoId: admin.id, ativo: true } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  const selecionado = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, finalidade: "COMERCIAL", contextoChave: finalidade === "VENDAS" ? "COMERCIAL:LINHA" : "COMERCIAL:::" } });
  const input = { contatoId: contato.id, atendimentoId: selecionado.id, alvo: { tipo: "lead" as const, id: lead.id } };
  return { admin, pessoa, lead, contato, conversa, selecionado, input };
}
const eventos = (contatoId: string) => prisma.evento.findMany({ where: { tipo: "ContatoVinculado", agregadoTipo: "ContatoWhatsApp", agregadoId: contatoId } });

// Correções após caracterização real: provas anteriores preservadas na SPEC/ledger.
it("ACTION real institucional recusa sem Contato, novo atendimento ou Evento", async () => {
  const c = await cenario("AGENDA");
  expect((await vincularContatoWhatsApp(c.input)).ok).toBe(false);
  expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: c.contato.id } })).leadId).toBeNull();
  expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.selecionado.id } })).leadId).toBeNull();
  const outro = await prisma.atendimentoWhatsApp.findFirst({ where: { conversaId: c.conversa.id, leadId: c.lead.id } });
  expect(outro).toBeNull();
  expect(await prisma.atendimentoWhatsApp.count({where:{conversaId:c.conversa.id}})).toBe(1);
  expect(await eventos(c.contato.id)).toHaveLength(0);
});
it("controle ACTION real VENDAS mantém identidade selecionada", async () => {
  const c = await cenario("VENDAS");
  expect((await vincularContatoWhatsApp(c.input)).ok).toBe(true);
  expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.selecionado.id } })).leadId).toBe(c.lead.id);
  expect(await prisma.atendimentoWhatsApp.count({ where: { conversaId: c.conversa.id } })).toBe(1);
  expect(await eventos(c.contato.id)).toHaveLength(1);
});
it("repetição manual da ACTION real registra dois Eventos", async () => {
  const c = await cenario("VENDAS");
  expect((await vincularContatoWhatsApp(c.input)).ok).toBe(true);
  expect((await vincularContatoWhatsApp(c.input)).ok).toBe(true);
  expect(await eventos(c.contato.id)).toHaveLength(2);
});
/** Espera observável no Postgres: não basta esperar uma duração arbitrária. */
async function aguardarBloqueadoPor(pid: number) {
  for (let i = 0; i < 150; i++) {
    const [r] = await prisma.$queryRaw<{ bloqueados: bigint }[]>`SELECT count(*) AS bloqueados FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))`;
    if (Number(r.bloqueados) > 0) return;
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error("A ACTION não chegou à barreira SQL esperada.");
}
it("deriva do Contato durante espera SQL real é recusada sem sobrescrita", async () => {
  const c = await cenario("VENDAS");
  const outro = await prisma.oportunidade.create({ data: { nome: "Vínculo concorrente fictício329", pessoaId: c.pessoa.id, vendedorDonoId: c.admin.id } });
  let entrou!: (pid: number) => void, soltar!: () => void;
  const pronta = new Promise<number>(r => { entrou = r; });
  const liberar = new Promise<void>(r => { soltar = r; });
  const bloqueadora = prisma.$transaction(async tx => {
    const [p] = await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
    await tx.$queryRaw`SELECT id FROM "ContatoWhatsApp" WHERE id=${c.contato.id} FOR UPDATE`;
    await tx.contatoWhatsApp.update({where:{id:c.contato.id},data:{leadId:outro.id}});
    entrou(p.pid); await liberar;
  }, {timeout:20000});
  const pid = await pronta;
  const acao = vincularContatoWhatsApp(c.input);
  try { await aguardarBloqueadoPor(pid); } finally { soltar(); await bloqueadora; }
  expect((await acao).ok).toBe(false);
  expect((await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:c.contato.id}})).leadId).toBe(outro.id);
  expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.selecionado.id}})).leadId).toBeNull();
  expect(await eventos(c.contato.id)).toHaveLength(0);
});