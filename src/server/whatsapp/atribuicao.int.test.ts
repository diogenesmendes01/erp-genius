import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { atendimentoVisivel, garantirAtendimento } from "./atendimentos";
import { assumirAtendimento, atribuirAtendimento, devolverParaFila } from "./acoes-atendimento";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });

type U = { id: string };
function comoUsuario(u: U) { authMock.mockResolvedValue({ user: { id: u.id } }); }
/** auth() é um mock global: cada chamada concorrente precisa enxergar o seu usuário já na 1ª leitura. */
async function como<T>(u: U, f: () => Promise<T>): Promise<T> { comoUsuario(u); return f(); }

/**
 * Padrão: número institucional que atende o COMERCIAL fora de uma linha de VENDAS — ali o responsável gravado dá
 * acesso (escopo.ts). `linhaVendas` monta a linha de VENDAS, onde a posse vem do dono da linha (LC-D02).
 */
async function cenario(opcoes: { linhaVendas?: boolean; donoDaLinha?: "v1" } = {}) {
  const v1 = await criarUsuario([Papel.VENDEDOR], "Vend Um");
  const v2 = await criarUsuario([Papel.VENDEDOR], "Vend Dois");
  const gc = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const fin = await criarUsuario([Papel.FINANCEIRO], "Fin");
  const numero = opcoes.linhaVendas
    ? await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990001", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", donoId: opcoes.donoDaLinha === "v1" ? v1.id : null } })
    : await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL"], finalidade: "AGENDA", donoId: null });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL" }));
  return { v1, v2, gc, fin, numero, contato, a };
}
const sessao = (u: { id: string; nome: string; papeis: Papel[] }) => ({ id: u.id, nome: u.nome, papeis: u.papeis });
const MSG_LINHA = "Nesta linha de vendas o atendimento fica com o dono da linha; ele não pode ser assumido por quem não atende a linha.";
const ler = (id: string) => prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id } });
const eventos = (tipo: string) => prisma.evento.findMany({ where: { tipo }, orderBy: { criadoEm: "asc" } });

describe("assumir, devolver e atribuir", () => {
  it("assumir da fila: responsável, EM_ATENDIMENTO e Evento", async () => {
    const { v1, a } = await cenario();
    comoUsuario(v1); expect((await assumirAtendimento(a.id)).ok).toBe(true);
    expect(await ler(a.id)).toMatchObject({ responsavelId: v1.id, status: "EM_ATENDIMENTO" });
    expect(await atendimentoVisivel(sessao(v1), a.id)).not.toBeNull();
    const [e] = await eventos("AtendimentoAssumido");
    expect(e.payload).toEqual({ de: null, para: v1.id });
  });

  it("assumir concorrente: só um vence", async () => {
    const { v1, v2, a } = await cenario();
    // Determinístico: a linha fica travada por uma transação do teste; as duas chamadas passam pelas
    // checagens de leitura (que não bloqueiam) e disputam o UPDATE condicional quando a trava cai.
    // (As chamadas entram escalonadas: dois `import()` dinâmicos simultâneos do módulo mockado de
    // sessão falham no vitest, e isso não é o que o teste mede.)
    let soltar!: () => void;
    const trava = new Promise<void>((r) => { soltar = r; });
    let travou!: () => void;
    const aviso = new Promise<void>((r) => { travou = r; });
    const segurando = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${a.id} FOR UPDATE`;
      travou(); await trava;
    });
    await aviso;
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
    comoUsuario(v1); const p1 = assumirAtendimento(a.id);
    await espera(1500);
    comoUsuario(v2); const p2 = assumirAtendimento(a.id);
    await espera(1500);
    soltar(); await segurando;
    const [r1, r2] = await Promise.all([p1, p2]);
    expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1);
    expect([r1, r2].find((r) => !r.ok)).toEqual({ ok: false, erro: "Outro atendente já assumiu este atendimento." });
    expect(await eventos("AtendimentoAssumido")).toHaveLength(1);
  });

  it("assumir atendimento que já tem dono: recusado (a fila comercial deixa de ser visível ao colega)", async () => {
    const { v1, v2, a } = await cenario();
    await como(v1, () => assumirAtendimento(a.id));
    expect((await como(v2, () => assumirAtendimento(a.id))).ok).toBe(false);
    expect(await ler(a.id)).toMatchObject({ responsavelId: v1.id });
  });

  it("atribuir só para quem tem papel do setor; devolver zera responsável e volta à fila", async () => {
    const { v2, gc, fin, a } = await cenario();
    comoUsuario(gc); expect(await atribuirAtendimento({ atendimentoId: a.id, usuarioId: fin.id })).toEqual({ ok: false, erro: "A pessoa escolhida não atende este setor." });
    expect((await atribuirAtendimento({ atendimentoId: a.id, usuarioId: v2.id })).ok).toBe(true);
    expect(await ler(a.id)).toMatchObject({ responsavelId: v2.id, status: "EM_ATENDIMENTO" });
    expect(await atendimentoVisivel(sessao(v2), a.id)).not.toBeNull();
    expect((await eventos("AtendimentoAtribuido"))[0].payload).toEqual({ de: null, para: v2.id });
    expect((await devolverParaFila(a.id)).ok).toBe(true);
    expect(await ler(a.id)).toMatchObject({ responsavelId: null, status: "ABERTO_SEM_RESPONSAVEL" });
    expect((await eventos("AtendimentoDevolvido"))[0].payload).toEqual({ de: v2.id, para: null });
  });

  it("vendedor não atribui; usuário inativo não recebe", async () => {
    const { v1, v2, gc, a } = await cenario();
    comoUsuario(v1); expect((await atribuirAtendimento({ atendimentoId: a.id, usuarioId: v2.id })).ok).toBe(false);
    await prisma.usuario.update({ where: { id: v2.id }, data: { ativo: false } });
    comoUsuario(gc); expect(await atribuirAtendimento({ atendimentoId: a.id, usuarioId: v2.id })).toEqual({ ok: false, erro: "A pessoa escolhida não atende este setor." });
  });

  it("atribuir e devolver cancelam as intenções HUMANO pendentes do responsável anterior", async () => {
    const { v1, v2, gc, numero, contato, a } = await cenario();
    await como(v1, () => assumirAtendimento(a.id));
    const nova = (autorId: string, status: "PENDENTE" | "ADIADA" | "DESPACHADA") => prisma.intencaoMensagem.create({ data: { numeroId: numero.id, contatoId: contato.id, atendimentoId: a.id, origem: "HUMANO", autorId, status, corpoRenderizado: "x" } });
    const p = await nova(v1.id, "PENDENTE"); const ad = await nova(v1.id, "ADIADA"); const env = await nova(v1.id, "DESPACHADA");
    comoUsuario(gc); expect((await atribuirAtendimento({ atendimentoId: a.id, usuarioId: v2.id })).ok).toBe(true);
    const st = async (id: string) => (await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id } })).status;
    expect([await st(p.id), await st(ad.id), await st(env.id)]).toEqual(["CANCELADA", "CANCELADA", "DESPACHADA"]);
    const p2 = await nova(v2.id, "PENDENTE");
    comoUsuario(gc); expect((await devolverParaFila(a.id)).ok).toBe(true);
    expect(await st(p2.id)).toBe("CANCELADA");
  });

  it("devolver: quem não é o responsável nem gerente é recusado; encerrado não muda", async () => {
    const { v1, v2, gc, a } = await cenario();
    await como(v1, () => assumirAtendimento(a.id));
    comoUsuario(v2); expect((await devolverParaFila(a.id)).ok).toBe(false);
    comoUsuario(gc); await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { status: "ENCERRADO", encerradoEm: new Date() } });
    expect((await devolverParaFila(a.id)).ok).toBe(false);
    expect(await ler(a.id)).toMatchObject({ responsavelId: v1.id, status: "ENCERRADO" });
  });
});

describe("linha de VENDAS: a posse vem do dono da linha (B1 da R1 do #207)", () => {
  it("vendedor que não é dono da linha não assume: recusa, segue na fila e continua visível", async () => {
    const { v1, a } = await cenario({ linhaVendas: true });
    expect(await atendimentoVisivel(sessao(v1), a.id)).not.toBeNull(); // vê pela fila
    comoUsuario(v1); expect(await assumirAtendimento(a.id)).toEqual({ ok: false, erro: MSG_LINHA });
    expect(await ler(a.id)).toMatchObject({ responsavelId: null, status: "ABERTO_SEM_RESPONSAVEL" });
    expect(await atendimentoVisivel(sessao(v1), a.id)).not.toBeNull();
    expect(await eventos("AtendimentoAssumido")).toHaveLength(0);
  });

  it("gerente não atribui a quem não é dono da linha: recusa sem gravar", async () => {
    const { v2, gc, a } = await cenario({ linhaVendas: true });
    comoUsuario(gc); expect(await atribuirAtendimento({ atendimentoId: a.id, usuarioId: v2.id })).toEqual({ ok: false, erro: MSG_LINHA });
    expect(await ler(a.id)).toMatchObject({ responsavelId: null });
    expect(await eventos("AtendimentoAtribuido")).toHaveLength(0);
  });

  it("dono da linha: assume da fila e recebe atribuição, e o atendimento continua visível para ele", async () => {
    const { v1, gc, a } = await cenario({ linhaVendas: true, donoDaLinha: "v1" });
    expect(await ler(a.id)).toMatchObject({ responsavelId: v1.id }); // a linha já entrega ao dono
    comoUsuario(gc); expect((await devolverParaFila(a.id)).ok).toBe(true);
    comoUsuario(v1); expect(await assumirAtendimento(a.id)).toEqual({ ok: true });
    expect(await atendimentoVisivel(sessao(v1), a.id)).not.toBeNull();
    comoUsuario(gc); expect((await devolverParaFila(a.id)).ok).toBe(true);
    expect(await atribuirAtendimento({ atendimentoId: a.id, usuarioId: v1.id })).toEqual({ ok: true });
    expect(await ler(a.id)).toMatchObject({ responsavelId: v1.id });
    expect(await atendimentoVisivel(sessao(v1), a.id)).not.toBeNull();
  });
});
