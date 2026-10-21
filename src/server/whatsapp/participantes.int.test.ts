import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { atendimentoVisivel, garantirAtendimento } from "./atendimentos";
import { convidarParticipante, revogarParticipante } from "./acoes-atendimento";
import { PRAZO_MAXIMO_CONVITE_DIAS } from "./participantes";
import type { UsuarioSessao } from "@/server/_shared/sessao";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });

const comoUsuario = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const sessao = (u: { id: string; papeis: Papel[] }) => ({ id: u.id, papeis: u.papeis, nome: "" }) as unknown as UsuarioSessao;
const motivo = "Dúvida sobre boleto";

async function cenario() {
  const v1 = await criarUsuario([Papel.VENDEDOR], "Vend Um");
  const gc = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const fin = await criarUsuario([Papel.FINANCEIRO], "Fin");
  const adm = await criarUsuario([Papel.ADMINISTRADOR], "Adm");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL", "FINANCEIRO"], donoId: v1.id });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: v1.id }));
  return { v1, gc, fin, adm, a };
}
const convidar = async (a: { id: string }, fin: { id: string }, extra: Partial<{ podeEnviar: boolean; fim: string; motivo: string }> = {}) => {
  const r = await convidarParticipante({ atendimentoId: a.id, usuarioId: fin.id, podeEnviar: false, fim: emDias(2), motivo, ...extra });
  return r;
};

describe("convidar e revogar participante", () => {
  it("convidado de outro setor vê; com podeEnviar=false não envia", async () => {
    const { v1, fin, a } = await cenario();
    expect(await atendimentoVisivel(sessao(fin), a.id)).toBeNull();
    comoUsuario(v1);
    const r = await convidar(a, fin);
    expect(r.ok).toBe(true);
    expect(await atendimentoVisivel(sessao(fin), a.id)).not.toBeNull();
    expect(await atendimentoVisivel(sessao(fin), a.id, true)).toBeNull();
    const p = await prisma.participanteAtendimentoWhatsApp.findFirstOrThrow({ where: { atendimentoId: a.id } });
    expect(p).toMatchObject({ usuarioId: fin.id, concedenteId: v1.id, podeEnviar: false, motivo, revogadoEm: null });
    const ev = await prisma.evento.findMany({ where: { tipo: "ParticipanteConvidado", agregadoId: a.id } });
    expect(ev).toHaveLength(1);
    expect(ev[0].payload).toMatchObject({ participanteId: p.id, usuarioId: fin.id, podeEnviar: false, motivo });
  });

  it("com podeEnviar=true o convidado também envia", async () => {
    const { v1, fin, a } = await cenario();
    comoUsuario(v1);
    expect((await convidar(a, fin, { podeEnviar: true })).ok).toBe(true);
    expect(await atendimentoVisivel(sessao(fin), a.id, true)).not.toBeNull();
  });

  it("revogar corta o acesso na hora (sem delete) e grava evento", async () => {
    const { v1, fin, a } = await cenario();
    comoUsuario(v1);
    const r = await convidar(a, fin);
    const participanteId = r.ok ? r.dado!.participanteId : "";
    expect((await revogarParticipante(participanteId)).ok).toBe(true);
    expect(await atendimentoVisivel(sessao(fin), a.id)).toBeNull();
    const p = await prisma.participanteAtendimentoWhatsApp.findUniqueOrThrow({ where: { id: participanteId } });
    expect(p.revogadoEm).not.toBeNull();
    expect(await prisma.evento.count({ where: { tipo: "ParticipanteRevogado", agregadoId: a.id } })).toBe(1);
    expect((await revogarParticipante(participanteId)).ok).toBe(false);
  });

  it("revogar cancela as intenções pendentes do convidado, mas não as de quem ainda envia por outro vínculo (C5 da R1)", async () => {
    const { v1, gc, fin, a } = await cenario();
    const atend = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id }, include: { conversa: true } });
    const nova = (autorId: string, status: "PENDENTE" | "ADIADA" | "DESPACHADA") => prisma.intencaoMensagem.create({ data: { numeroId: atend.conversa.numeroId, contatoId: atend.conversa.contatoId!, atendimentoId: a.id, origem: "HUMANO", autorId, status, corpoRenderizado: "x" } });
    comoUsuario(v1);
    const r = await convidar(a, fin, { podeEnviar: true });
    const pend = await nova(fin.id, "PENDENTE"); const adi = await nova(fin.id, "ADIADA"); const env = await nova(fin.id, "DESPACHADA");
    expect((await revogarParticipante(r.ok ? r.dado!.participanteId : "")).ok).toBe(true);
    const st = async (id: string) => (await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id } })).status;
    expect([await st(pend.id), await st(adi.id), await st(env.id)]).toEqual(["CANCELADA", "CANCELADA", "DESPACHADA"]);
    // O gerente comercial convidado continua enviando pelo setor: nada dele é cancelado.
    const r2 = await convidar(a, gc, { podeEnviar: true });
    const doGerente = await nova(gc.id, "PENDENTE");
    expect((await revogarParticipante(r2.ok ? r2.dado!.participanteId : "")).ok).toBe(true);
    expect(await st(doGerente.id)).toBe("PENDENTE");
  });

  it("recusa prazo acima de 30 dias, prazo vencido, motivo curto, usuário inativo e duplicado", async () => {
    const { v1, fin, a } = await cenario();
    expect(PRAZO_MAXIMO_CONVITE_DIAS).toBe(30);
    comoUsuario(v1);
    expect((await convidar(a, fin, { fim: emDias(31) })).ok).toBe(false);
    expect((await convidar(a, fin, { fim: emDias(-1) })).ok).toBe(false);
    expect((await convidar(a, fin, { fim: "ontem" })).ok).toBe(false);
    expect((await convidar(a, fin, { motivo: "curto" })).ok).toBe(false);
    expect((await convidar(a, fin, { fim: emDias(29) })).ok).toBe(true);
    expect((await convidar(a, fin)).ok).toBe(false);
    const inativo = await criarUsuario([Papel.FINANCEIRO], "Inat");
    await prisma.usuario.update({ where: { id: inativo.id }, data: { ativo: false } });
    expect((await convidar(a, inativo)).ok).toBe(false);
    expect(await prisma.participanteAtendimentoWhatsApp.count()).toBe(1);
  });

  it("só o responsável ou gerente do setor convida; o convidado não convida outro", async () => {
    const { v1, gc, fin, adm, a } = await cenario();
    const outro = await criarUsuario([Papel.VENDEDOR], "Vend Dois");
    comoUsuario(outro);
    expect((await convidar(a, fin)).ok).toBe(false);
    comoUsuario(gc);
    expect((await convidar(a, fin)).ok).toBe(true);
    comoUsuario(fin);
    expect((await convidar(a, adm)).ok).toBe(false);
    expect(v1.id).toBeTruthy();
  });

  it("revogar: concedente, gerente do setor e admin podem; outro vendedor, o próprio convidado e gerente de outro setor não", async () => {
    const { v1, gc, fin, adm, a } = await cenario();
    const outro = await criarUsuario([Papel.VENDEDOR], "Vend Dois");
    const gp = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gerente Ped");
    const novo = async () => { comoUsuario(v1); const r = await convidar(a, fin); return r.ok ? r.dado!.participanteId : ""; };
    let id = await novo();
    for (const nao of [outro, fin, gp]) { comoUsuario(nao); expect((await revogarParticipante(id)).ok).toBe(false); }
    expect((await prisma.participanteAtendimentoWhatsApp.findUniqueOrThrow({ where: { id } })).revogadoEm).toBeNull();
    comoUsuario(v1); expect((await revogarParticipante(id)).ok).toBe(true);
    id = await novo(); comoUsuario(gc); expect((await revogarParticipante(id)).ok).toBe(true);
    id = await novo(); comoUsuario(adm); expect((await revogarParticipante(id)).ok).toBe(true);
    expect((await revogarParticipante("inexistente")).ok).toBe(false);
  });

  it("não convida em atendimento encerrado", async () => {
    const { v1, fin, a } = await cenario();
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
    comoUsuario(v1);
    expect((await convidar(a, fin)).ok).toBe(false);
  });
});
