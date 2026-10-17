import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { abrirAtendimentoInstitucional } from "./operacoes-atendimento";

// Ruling B2 do #199 (E3.4): abrir um destino que já tem atendimento aberto com outro responsável,
// fora do escopo de quem abre, é recusado antes do evento. Participante só por convite (Task 17).

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });

async function base() {
  const canal = await seedCanal();
  const c = await seedCobranca({ vencimento: new Date("2026-10-10T12:00:00Z"), responsavelTelefone: "+50680001111" });
  return { ...c, canal };
}
function como(u: { id: string }) { authMock.mockResolvedValue({ user: { id: u.id } }); }
const abertos = () => prisma.evento.count({ where: { tipo: "AtendimentoInstitucionalAberto" } });

describe("abrir atendimento institucional já aberto por um colega", () => {
  it("FINANCEIRO: o segundo atendente do mesmo número e matrícula é recusado, sem evento", async () => {
    const c = await base();
    const f1 = await criarUsuario([Papel.FINANCEIRO], "Fin Um");
    const f2 = await criarUsuario([Papel.FINANCEIRO], "Fin Dois");
    const chave = `FINANCEIRO:${c.matricula.id}`;
    como(f1);
    const a = await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: chave });
    expect(a.ok).toBe(true);
    if (!a.ok) throw new Error(a.erro);
    expect(await abertos()).toBe(1);

    como(f2);
    const b = await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: chave });
    expect(b).toEqual({ ok: false, erro: "Este atendimento já está com Fin Um; peça para ser incluído como participante." });
    expect(await abertos()).toBe(1);
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.dado!.id } })).responsavelId).toBe(f1.id);

    // O próprio responsável reabre o mesmo atendimento normalmente.
    como(f1);
    const de = await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: chave });
    expect(de).toEqual({ ok: true, dado: { id: a.dado!.id } });
  });

  it("FINANCEIRO participante vigente do atendimento do colega pode abrir", async () => {
    const c = await base();
    const f1 = await criarUsuario([Papel.FINANCEIRO], "Fin Um");
    const f2 = await criarUsuario([Papel.FINANCEIRO], "Fin Dois");
    const chave = `FINANCEIRO:${c.matricula.id}`;
    como(f1);
    const a = await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: chave });
    if (!a.ok) throw new Error(a.erro);
    const agora = Date.now();
    await prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: a.dado!.id, usuarioId: f2.id, concedenteId: f1.id,
      inicio: new Date(agora - 60_000), fim: new Date(agora + 86_400_000), motivo: "Ajuda com a negociação" } });
    como(f2);
    expect(await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: chave })).toEqual({ ok: true, dado: { id: a.dado!.id } });
  });

  it("SECRETARIA_ACADEMICA: colega de secretaria é recusada em SECRETARIA e em FINANCEIRO de outro responsável", async () => {
    const c = await base();
    const s1 = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Sec Um");
    const s2 = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Sec Dois");
    const f1 = await criarUsuario([Papel.FINANCEIRO], "Fin Um");
    const secretaria = `SECRETARIA:${c.aluno.id}`;
    como(s1);
    expect((await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: secretaria })).ok).toBe(true);
    como(s2);
    expect(await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: secretaria }))
      .toEqual({ ok: false, erro: "Este atendimento já está com Sec Um; peça para ser incluído como participante." });

    como(f1);
    expect((await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: `FINANCEIRO:${c.matricula.id}` })).ok).toBe(true);
    como(s2);
    expect(await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: `FINANCEIRO:${c.matricula.id}` }))
      .toEqual({ ok: false, erro: "Este atendimento já está com Fin Um; peça para ser incluído como participante." });
    expect(await abertos()).toBe(2);
  });

  it("C6: atendimento sem responsável e fora do escopo de quem abre é recusado, sem evento", async () => {
    const c = await base();
    const f1 = await criarUsuario([Papel.FINANCEIRO], "Fin Um");
    const f2 = await criarUsuario([Papel.FINANCEIRO], "Fin Dois");
    const chave = `FINANCEIRO:${c.matricula.id}`;
    como(f1);
    const a = await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: chave });
    if (!a.ok) throw new Error(a.erro);
    // Volta para a fila, mas o número deixa de servir o setor FINANCEIRO: a fila não alcança f2.
    await prisma.atendimentoWhatsApp.update({ where: { id: a.dado!.id }, data: { responsavelId: null } });
    await prisma.numeroSetorWhatsApp.create({ data: { numeroId: c.canal.numero.id, finalidade: "SECRETARIA" } });
    como(f2);
    expect(await abrirAtendimentoInstitucional({ numeroId: c.canal.numero.id, destinoChave: chave }))
      .toEqual({ ok: false, erro: "Este atendimento está fora do seu escopo; peça para ser incluído como participante." });
    expect(await abertos()).toBe(1);
  });
});
