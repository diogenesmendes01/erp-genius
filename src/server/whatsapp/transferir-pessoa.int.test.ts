import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { DriverWhatsApp, Papel } from "@prisma/client";
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { CANAL_INBOX, type AvisoInbox } from "@/server/inbox/barramento";
import { criarFiltroDeAvisos } from "@/server/inbox/eventos-sse";
import { listarAtendimentosPagina, obterItemListaInbox } from "@/server/inbox/consultas-pagina";
import { atendimentoVisivel, encerrarAtendimentoNaTransacao, garantirAtendimento } from "./atendimentos";
import { atribuirAtendimento, devolverParaFila } from "./acoes-atendimento";
import { podeVerLeadNaThread } from "./visibilidade-lead";
import { transferirPessoaInbox } from "./transferencia-inbox";

type U = Awaited<ReturnType<typeof criarUsuario>>;
let c: Awaited<ReturnType<typeof cenario>>;
let seq = 0;
const sess = (u: U) => ({ id: u.id, nome: u.nome, papeis: u.papeis, ativo: u.ativo, permissoes: u.permissoes });
const como = (u: { id: string }) => mocks.auth.mockResolvedValue({ user: { id: u.id } });
const ler = (id: string) => prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id } });
const fresco = async (u: U) => sess(await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } }));
const acessos = (atendimentoId: string) => prisma.atendimentoAcessoTransferido.findMany({ where: { atendimentoId }, orderBy: { criadoEm: "asc" } });
const eventos = (atendimentoId: string, tipo: string) => prisma.evento.findMany({ where: { agregadoId: atendimentoId, tipo }, orderBy: { criadoEm: "asc" } });
const aviso = (a: { id: string; conversaId: string }): AvisoInbox => ({ tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId });

async function atendimentoComercial(numeroId: string, responsavelId: string | null, vendedorDonoId: string) {
  seq += 1;
  const telefone = "+5068100" + String(seq).padStart(4, "0");
  const lead = await prisma.oportunidade.create({ data: { nome: "Lead fictício 370-" + seq, telefoneE164: telefone, vendedorDonoId } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id, responsavelId }));
  return { a, lead, contato };
}

async function cenario() {
  const v1 = await criarUsuario([Papel.VENDEDOR], "Vendedora dona 370");
  const v2 = await criarUsuario([Papel.VENDEDOR], "Vendedor colega 370");
  const v3 = await criarUsuario([Papel.VENDEDOR], "Vendedora terceira 370");
  const gc = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente 370");
  const fin = await criarUsuario([Papel.FINANCEIRO], "Financeiro 370");
  const numero = await criarNumeroSetor({ telefoneE164: "+5500000000370", setores: ["COMERCIAL"], finalidade: "AGENDA", donoId: null });
  const principal = await atendimentoComercial(numero.id, v1.id, v1.id);
  return { v1, v2, v3, gc, fin, numero, ...principal };
}

const transferir = (usuarioId: string, extra: { contexto?: string; chaveIdempotencia?: string; atendimentoId?: string } = {}) =>
  transferirPessoaInbox({ atendimentoId: extra.atendimentoId ?? c.a.id, usuarioId, contexto: extra.contexto ?? "", chaveIdempotencia: extra.chaveIdempotencia ?? "370-" + usuarioId + "-" + (extra.contexto ?? "") });

async function escutar() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const quadros: AvisoInbox[] = [];
  client.on("notification", (n) => { if (n.channel === CANAL_INBOX && n.payload) quadros.push(JSON.parse(n.payload) as AvisoInbox); });
  await client.connect();
  await client.query("LISTEN " + CANAL_INBOX);
  const para = (usuarioId: string) => quadros.filter((q) => q.paraUsuarioId === usuarioId);
  return { para, esperar: (usuarioId: string) => vi.waitFor(() => expect(para(usuarioId).length).toBeGreaterThan(0), { timeout: 3000 }), sair: () => client.end() };
}

beforeEach(async () => { await truncarBanco(); mocks.auth.mockReset(); seq = 0; c = await cenario(); como(c.v1); });
afterAll(() => prisma.$disconnect());

describe("transferir para pessoa (D5): responsável passa a conversa ao colega do setor", () => {
  it("vendedor responsável passa para outro vendedor: responsável muda, intenções dele canceladas, Evento com via transferencia", async () => {
    const intencao = await prisma.intencaoMensagem.create({ data: { atendimentoId: c.a.id, numeroId: c.numero.id, contatoId: c.contato.id, origem: "HUMANO", autorId: c.v1.id, corpoRenderizado: "Fixture não enviada 370" } });
    expect(await transferir(c.v2.id)).toEqual({ ok: true });
    expect(await ler(c.a.id)).toMatchObject({ responsavelId: c.v2.id, status: "EM_ATENDIMENTO" });
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } })).status).toBe("CANCELADA");
    const [e] = await eventos(c.a.id, "AtendimentoAtribuido");
    expect(e.autorId).toBe(c.v1.id);
    expect(e.payload).toMatchObject({ de: c.v1.id, para: c.v2.id, via: "transferencia", contexto: null, acessoContextual: true });
  });

  it("a carteira (vendedorDonoId) não muda e o CRM do colega não se amplia", async () => {
    expect((await transferir(c.v2.id)).ok).toBe(true);
    expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: c.lead.id } })).vendedorDonoId).toBe(c.v1.id);
    expect(await prisma.oportunidade.count({ where: { AND: [{ id: c.lead.id }, await escopoComercialAtual(await fresco(c.v2))] } })).toBe(0);
    expect(await podeVerLeadNaThread(await fresco(c.v2), c.a.id, c.lead.id, Date.now())).toBe(false);
  });

  it("concede acesso contextual somente à conversa transferida: leitura, lista, envio e tempo real", async () => {
    const outro = await atendimentoComercial(c.numero.id, c.v1.id, c.v1.id);
    const v2 = await fresco(c.v2);
    expect(await atendimentoVisivel(v2, c.a.id)).toBeNull();
    expect(await criarFiltroDeAvisos(v2)(aviso(c.a))).toBe(false);
    expect((await transferir(c.v2.id)).ok).toBe(true);
    const [acesso] = await acessos(c.a.id);
    expect(acesso).toMatchObject({ usuarioId: c.v2.id, concedenteId: c.v1.id, revogadoEm: null });
    expect(await atendimentoVisivel(v2, c.a.id)).not.toBeNull();
    expect(await atendimentoVisivel(v2, c.a.id, true)).not.toBeNull();
    expect(await obterItemListaInbox(v2, c.a.id)).not.toBeNull();
    const lista = (await listarAtendimentosPagina(v2, {}, null)).itens.map((i) => i.id);
    expect(lista).toContain(c.a.id);
    expect(lista).not.toContain(outro.a.id);
    expect(await atendimentoVisivel(v2, outro.a.id)).toBeNull();
    expect(await criarFiltroDeAvisos(v2)(aviso(c.a))).toBe(true);
    expect(await criarFiltroDeAvisos(v2)(aviso(outro.a))).toBe(false);
    expect(await atendimentoVisivel(await fresco(c.v1), c.a.id)).not.toBeNull();
  });

  it("contexto vira NotaInterna do mesmo atendimento; vazio não grava", async () => {
    expect((await transferir(c.v2.id, { contexto: "  Cliente pediu proposta 370  " })).ok).toBe(true);
    const notas = await eventos(c.a.id, "NotaInterna");
    expect(notas.map((n) => n.payload)).toEqual([{ nota: "Cliente pediu proposta 370" }]);
    expect((await eventos(c.a.id, "AtendimentoAtribuido"))[0].payload).toMatchObject({ contexto: "Cliente pediu proposta 370" });
    const segundo = await atendimentoComercial(c.numero.id, c.v1.id, c.v1.id);
    expect((await transferir(c.v2.id, { atendimentoId: segundo.a.id, chaveIdempotencia: "370-vazio" })).ok).toBe(true);
    expect(await eventos(segundo.a.id, "NotaInterna")).toHaveLength(0);
  });

  it("quem não é o responsável nem gerente: 'Sua função não autoriza esta ação neste atendimento.'", async () => {
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { responsavelId: c.v3.id } });
    expect(await transferir(c.v2.id)).toEqual({ ok: false, erro: "Sua função não autoriza esta ação neste atendimento." });
    expect((await ler(c.a.id)).responsavelId).toBe(c.v3.id);
    expect(await acessos(c.a.id)).toHaveLength(0);
  });

  it("destino sem papel do setor: 'A pessoa escolhida não atende este setor.'", async () => {
    expect(await transferir(c.fin.id)).toEqual({ ok: false, erro: "A pessoa escolhida não atende este setor." });
    await prisma.usuario.update({ where: { id: c.v2.id }, data: { ativo: false } });
    expect(await transferir(c.v2.id)).toEqual({ ok: false, erro: "A pessoa escolhida não atende este setor." });
    expect((await ler(c.a.id)).responsavelId).toBe(c.v1.id);
    expect(await acessos(c.a.id)).toHaveLength(0);
  });

  it("linha de vendas: destino que não enxergaria é recusado sem conceder acesso", async () => {
    const linha = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990370", rotulo: "Vendas 370", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", donoId: c.v1.id } });
    const naLinha = await atendimentoComercial(linha.id, c.v1.id, c.v1.id);
    expect(await transferir(c.v2.id, { atendimentoId: naLinha.a.id, chaveIdempotencia: "370-linha" })).toEqual({ ok: false, erro: "Nesta linha de vendas o atendimento fica com o dono da linha; ele não pode ser assumido por quem não atende a linha." });
    expect((await ler(naLinha.a.id)).responsavelId).toBe(c.v1.id);
    expect(await acessos(naLinha.a.id)).toHaveLength(0);
  });

  it("mesma chave duas vezes: um Evento e um acesso", async () => {
    expect((await transferir(c.v2.id, { contexto: "Contexto repetido 370", chaveIdempotencia: "370-repetida" })).ok).toBe(true);
    expect((await transferir(c.v2.id, { contexto: "Contexto repetido 370", chaveIdempotencia: "370-repetida" })).ok).toBe(true);
    expect(await eventos(c.a.id, "AtendimentoAtribuido")).toHaveLength(1);
    expect(await eventos(c.a.id, "NotaInterna")).toHaveLength(1);
    expect(await acessos(c.a.id)).toHaveLength(1);
  });

  it("gerente que não é o responsável segue a regra de atribuição e não concede acesso", async () => {
    como(c.gc);
    expect((await transferir(c.v2.id)).ok).toBe(false);
    expect((await ler(c.a.id)).responsavelId).toBe(c.v1.id);
    expect(await acessos(c.a.id)).toHaveLength(0);
  });
});

describe("revogação do acesso contextual quando as condições deixam de valer", () => {
  it("devolver para a fila revoga, avisa só o colega e não ressuscita numa nova atribuição", async () => {
    expect((await transferir(c.v2.id)).ok).toBe(true);
    const escuta = await escutar();
    try {
      como(c.v2);
      expect(await devolverParaFila(c.a.id)).toEqual({ ok: true });
      await escuta.esperar(c.v2.id);
      expect(escuta.para(c.v2.id)).toContainEqual({ tipo: "atendimento.atualizado", atendimentoId: c.a.id, mensagemId: null, conversaId: c.a.conversaId, paraUsuarioId: c.v2.id });
    } finally { await escuta.sair(); }
    const [acesso] = await acessos(c.a.id);
    expect(acesso.revogadoEm).not.toBeNull();
    const v2 = await fresco(c.v2);
    expect(await atendimentoVisivel(v2, c.a.id)).toBeNull();
    expect((await listarAtendimentosPagina(v2, {}, null)).itens.map((i) => i.id)).not.toContain(c.a.id);
    const filtro = criarFiltroDeAvisos(v2);
    expect(await filtro(aviso(c.a))).toBe(false);
    expect(await filtro({ ...aviso(c.a), paraUsuarioId: c.v2.id })).toBe(true);
    como(c.gc);
    expect((await atribuirAtendimento({ atendimentoId: c.a.id, usuarioId: c.v2.id })).ok).toBe(false);
    expect(await atendimentoVisivel(v2, c.a.id)).toBeNull();
  });

  it("nova transferência do colega para outro revoga o anterior e concede ao novo", async () => {
    expect((await transferir(c.v2.id)).ok).toBe(true);
    como(c.v2);
    expect((await transferir(c.v3.id)).ok).toBe(true);
    const lista = await acessos(c.a.id);
    expect(lista.map((x) => [x.usuarioId, x.concedenteId, x.revogadoEm === null])).toEqual([[c.v2.id, c.v1.id, false], [c.v3.id, c.v2.id, true]]);
    expect(await atendimentoVisivel(await fresco(c.v2), c.a.id)).toBeNull();
    expect(await atendimentoVisivel(await fresco(c.v3), c.a.id)).not.toBeNull();
  });

  it("atribuição pelo gerente a outra pessoa e encerramento revogam", async () => {
    expect((await transferir(c.v2.id)).ok).toBe(true);
    como(c.gc);
    expect((await atribuirAtendimento({ atendimentoId: c.a.id, usuarioId: c.v1.id })).ok).toBe(true);
    expect((await acessos(c.a.id))[0].revogadoEm).not.toBeNull();
    const segundo = await atendimentoComercial(c.numero.id, c.v1.id, c.v1.id);
    como(c.v1);
    expect((await transferir(c.v2.id, { atendimentoId: segundo.a.id, chaveIdempotencia: "370-encerrar" })).ok).toBe(true);
    await prisma.$transaction((tx) => encerrarAtendimentoNaTransacao(tx, segundo.a.id, c.gc.id));
    expect((await acessos(segundo.a.id))[0].revogadoEm).not.toBeNull();
    expect(await atendimentoVisivel(await fresco(c.v2), segundo.a.id)).toBeNull();
  });

  it("perda do papel comercial ou desativação revoga e avisa o colega", async () => {
    expect((await transferir(c.v2.id)).ok).toBe(true);
    const escuta = await escutar();
    try {
      await prisma.usuario.update({ where: { id: c.v2.id }, data: { papeis: [Papel.FINANCEIRO] } });
      await escuta.esperar(c.v2.id);
      expect(escuta.para(c.v2.id)[0]).toMatchObject({ atendimentoId: c.a.id, paraUsuarioId: c.v2.id });
    } finally { await escuta.sair(); }
    expect((await acessos(c.a.id))[0].revogadoEm).not.toBeNull();
    await prisma.usuario.update({ where: { id: c.v2.id }, data: { papeis: [Papel.VENDEDOR] } });
    expect(await atendimentoVisivel(await fresco(c.v2), c.a.id)).toBeNull();
    const segundo = await atendimentoComercial(c.numero.id, c.v1.id, c.v1.id);
    expect((await transferir(c.v2.id, { atendimentoId: segundo.a.id, chaveIdempotencia: "370-inativo" })).ok).toBe(true);
    await prisma.usuario.update({ where: { id: c.v2.id }, data: { ativo: false } });
    expect((await acessos(segundo.a.id))[0].revogadoEm).not.toBeNull();
  });
});
