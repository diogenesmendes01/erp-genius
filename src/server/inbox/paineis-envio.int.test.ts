import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { enviarTextoInbox } from "@/server/whatsapp/acoes";
import { carregarPainel } from "./paineis";

// C6 do #217 (follow-up da revisão): o podeEnviar do painel decide o compositor, então precisa ser EXATAMENTE o
// critério do envio de verdade (`enviarTextoInbox` → `conversaVisivel(autor, id, true)`, alias de
// `atendimentoVisivel`). A secretaria responsável só envia ao destinatário atual do atendimento
// (`destinatarioAtualDoAtendimento`): com aluno, o telefone do contato tem de ser o do aluno (ou do responsável
// pedagógico); sem aluno (triagem por setor), envia.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
// Nada sai de verdade: sem WHATSAPP_LIVE e com o driver do motor falso.
vi.mock("@/server/whatsapp/drivers/motor", () => ({ driverMotor: { enviarTexto: vi.fn(), enviarTemplate: vi.fn(), enviarMidia: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const u = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!u?.ativo) throw new original.ErroAutenticacao();
    return u;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const u = await sessao(); original.exigirPapel(u, ...papeis); return u;
  } };
});

type U = Awaited<ReturnType<typeof criarUsuario>>;
const sess = (u: U) => ({ id: u.id, nome: u.nome, papeis: u.papeis }) as never;

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });

async function cenario(o: { telefoneAluno: string | null; telefoneContato: string; comAluno: boolean }) {
  const cat = await seedCatalogoMinimo();
  const sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA]);
  const { numero } = await seedCanal();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", paisId: cat.pais.id, telefoneE164: o.telefoneAluno } });
  const m = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: o.telefoneContato, alunoId: o.comAluno ? aluno.id : null } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  const a = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: `SECRETARIA::${aluno.id}`, finalidade: "SECRETARIA",
    responsavelId: sec.id, ...(o.comAluno ? { alunoId: aluno.id, matriculaId: m.id } : {}) } });
  authMock.mockResolvedValue({ user: { id: sec.id } });
  return { sec, a };
}

async function envioAceito(atendimentoId: string): Promise<boolean> {
  const r = await enviarTextoInbox({ conversaId: atendimentoId, texto: "Olá" });
  const intencoes = await prisma.intencaoMensagem.count({ where: { atendimentoId } });
  if (!r.ok) expect(intencoes).toBe(0);
  return r.ok && intencoes === 1;
}

describe("painel: podeEnviar da secretaria responsável = critério do envio real (C6 do #217)", () => {
  it("contato ligado ao aluno com o telefone atual do aluno: painel libera e o envio aceita", async () => {
    const { sec, a } = await cenario({ telefoneAluno: "+50680002222", telefoneContato: "+50680002222", comAluno: true });
    expect(await carregarPainel(sess(sec), a.id)).toMatchObject({ podeEnviar: true });
    expect(await envioAceito(a.id)).toBe(true);
  });

  it("aluno sem telefone ou com outro telefone: o painel nega e o envio real também recusa", async () => {
    const semTelefone = await cenario({ telefoneAluno: null, telefoneContato: "+50680003333", comAluno: true });
    expect(await carregarPainel(sess(semTelefone.sec), semTelefone.a.id)).toMatchObject({ podeEnviar: false });
    expect(await envioAceito(semTelefone.a.id)).toBe(false);

    await truncarBanco();
    const outro = await cenario({ telefoneAluno: "+50680004444", telefoneContato: "+50680005555", comAluno: true });
    expect(await carregarPainel(sess(outro.sec), outro.a.id)).toMatchObject({ podeEnviar: false });
    expect(await envioAceito(outro.a.id)).toBe(false);
  });

  it("atendimento de secretaria sem aluno (triagem por setor): painel libera e o envio aceita", async () => {
    const { sec, a } = await cenario({ telefoneAluno: null, telefoneContato: "+50680006666", comAluno: false });
    expect(await carregarPainel(sess(sec), a.id)).toMatchObject({ podeEnviar: true });
    expect(await envioAceito(a.id)).toBe(true);
  });
});
