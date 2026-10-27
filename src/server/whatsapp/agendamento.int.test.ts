import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock, enviarMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./drivers/motor", () => ({ driverMotor: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { agendarMensagemNoAtendimento, agendarMensagemNoAtendimentoLocal, cancelarAgendamentoDoAtendimento, editarAgendamentoDoAtendimento, enviarAgendamentoAgoraDoAtendimento, manterAgendadaAposResposta } from "./acoes-conversa";
import { agendadasDoAtendimento, tarefasAbertasParaVinculo } from "./consultas-acoes-atendimento";
import { valorCampoLocal } from "@/server/operacao/fuso-entrada";
import { transferirAtendimento } from "./acoes-atendimento";
import { despacharFila, MOTIVO_AGUARDA_CONFIRMACAO } from "./despachante";
import { diaUtilAs } from "@/test/janela-envio";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "@/lib/uploads";
import { midiaSaidaDoAutor, salvarMidiaSaida } from "./midia";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); enviarMock.mockReset().mockResolvedValue({ providerMessageId: "teste-sem-rede" }); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const comoUsuario = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const emMinutos = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const util = (hora: number) => diaUtilAs(hora);

async function cenario() {
  const vend = await criarUsuario([Papel.VENDEDOR], "Vend");
  const fora = await criarUsuario([Papel.FINANCEIRO], "Fora");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL", "SECRETARIA"], donoId: vend.id });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: vend.id }));
  return { vend, fora, a, numero, contato };
}
type R = Awaited<ReturnType<typeof agendarMensagemNoAtendimento>>;
const idDe = (r: R) => { if (!r.ok) throw new Error(r.erro); return r.dado!.id; };
const status = async (r: R) => (await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: idDe(r) } })).status;

describe("agendar mensagem pelo atendimento", () => {
  it("não sai antes da hora e sai depois", async () => {
    const { vend, a, numero, contato } = await cenario();
    comoUsuario(vend);
    const quando = util(10);
    const r = await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "Lembrete", quando: quando.toISOString() });
    expect(r.ok).toBe(true);
    expect(await prisma.intencaoMensagem.findUnique({ where: { id: idDe(r) } })).toMatchObject({ atendimentoId: a.id, numeroId: numero.id, contatoId: contato.id, origem: "HUMANO", autorId: vend.id });
    await despacharFila(new Date(quando.getTime() - 60_000));
    expect(await status(r)).toBe("PENDENTE");
    await despacharFila(new Date(quando.getTime() + 60_000));
    expect(await status(r)).not.toBe("PENDENTE");
    expect(["DESPACHADA", "SIMULADA"]).toContain(await status(r));
    expect(await prisma.evento.count({ where: { tipo: "MensagemAgendada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id } })).toBe(1);
  });

  it("horário digitado é convertido no servidor, no fuso informado; fuso inválido é recusado sem agendar", async () => {
    const { vend, a } = await cenario();
    comoUsuario(vend);
    const quando = util(10);
    const local = valorCampoLocal(quando, "America/Sao_Paulo");
    const r = await agendarMensagemNoAtendimentoLocal({ atendimentoId: a.id, texto: "Lembrete", quandoLocal: local, fuso: "America/Sao_Paulo" });
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: idDe(r) } })).agendadaPara?.toISOString()).toBe(new Date(Math.floor(quando.getTime() / 60_000) * 60_000).toISOString());
    expect(await agendarMensagemNoAtendimentoLocal({ atendimentoId: a.id, texto: "Outro", quandoLocal: local, fuso: "Lua/Base" })).toEqual({ ok: false, erro: expect.stringMatching(/fuso válido/) });
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: a.id } })).toBe(1);
  });

  it("não sai depois de transferência", async () => {
    const { vend, a } = await cenario();
    comoUsuario(vend);
    const quando = util(10);
    const r = await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: quando.toISOString() });
    const t = await transferirAtendimento({ atendimentoId: a.id, destino: "SECRETARIA", destinoChave: null, contexto: "x".repeat(12) });
    expect(t.ok).toBe(true);
    await despacharFila(new Date(quando.getTime() + 60_000));
    expect(await prisma.intencaoMensagem.findUnique({ where: { id: idDe(r) } })).toMatchObject({ status: "CANCELADA", motivoFalha: "atendimento_encerrado" });
  });

  it("recusa atendimento fora do escopo", async () => {
    const { fora, a } = await cenario();
    comoUsuario(fora);
    expect(await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: util(10).toISOString() })).toEqual({ ok: false, erro: "Atendimento não encontrado." });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("reusa as validações da Fase 2: horário passado e opt-out", async () => {
    const { vend, a, contato } = await cenario();
    comoUsuario(vend);
    expect((await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: emMinutos(-5) })).ok).toBe(false);
    await prisma.contatoWhatsApp.update({ where: { id: contato.id }, data: { optOutEm: new Date() } });
    expect((await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: util(10).toISOString() })).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("recusa o horário de silêncio da escola com mensagem clara (D12, #202 C4)", async () => {
    const { vend, a } = await cenario();
    comoUsuario(vend);
    expect(await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "x", quando: util(3).toISOString() })).toEqual({
      ok: false,
      erro: "Fora da janela de envio da escola: as mensagens saem das 9h às 20h, de segunda a sexta (horário de America/Sao_Paulo). Escolha outro horário.",
    });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });
});

describe("editar mensagem agendada pelo atendimento (D11)", () => {
  const FUSO = "America/Sao_Paulo";
  async function agendada() {
    const c = await cenario();
    comoUsuario(c.vend);
    const id = idDe(await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "Texto antigo", quando: util(10).toISOString() }));
    return { ...c, id };
  }
  const editar = (c: { a: { id: string }; id: string }, extra: Partial<{ texto: string; quando: Date; chaveIdempotencia: string }> = {}) =>
    editarAgendamentoDoAtendimento({ atendimentoId: c.a.id, intencaoId: c.id, texto: extra.texto ?? "Texto novo", quandoLocal: valorCampoLocal(extra.quando ?? util(15), FUSO), fuso: FUSO, chaveIdempotencia: extra.chaveIdempotencia });
  const editados = (atendimentoId: string) => prisma.evento.findMany({ where: { tipo: "MensagemAgendadaEditada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId } });

  it("edita texto e horário: Evento MensagemAgendadaEditada, sem o texto no payload; sai com o texto novo", async () => {
    const c = await agendada();
    const quando = util(15);
    expect(await editar(c, { quando })).toEqual({ ok: true, dado: { id: c.id } });
    const m = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.id } });
    expect(m).toMatchObject({ corpoRenderizado: "Texto novo", status: "PENDENTE" });
    expect(m.agendadaPara?.toISOString()).toBe(new Date(Math.floor(quando.getTime() / 60_000) * 60_000).toISOString());
    const [evento, ...resto] = await editados(c.a.id);
    expect(resto).toHaveLength(0);
    expect(evento).toMatchObject({ autorId: c.vend.id, payload: expect.objectContaining({ operacao: "EDITAR", intencaoId: c.id, textoAlterado: true }) });
    expect(JSON.stringify(evento!.payload)).not.toContain("Texto novo");
    vi.stubEnv("WHATSAPP_LIVE", "1");
    await despacharFila(new Date(m.agendadaPara!.getTime() + 60_000));
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("DESPACHADA");
    expect(enviarMock).toHaveBeenCalledOnce();
    expect(enviarMock.mock.calls[0]![2]).toBe("Texto novo");
    const enviada = await prisma.mensagemWhatsApp.findFirst({ where: { atendimentoId: c.a.id, direcao: "SAIDA" }, orderBy: { criadoEm: "desc" } });
    expect(enviada?.corpo).toBe("Texto novo");
  });

  it("edição entre a leitura do despachante e o envio: o texto antigo não sai e vale o novo horário", async () => {
    const c = await agendada();
    vi.stubEnv("WHATSAPP_LIVE", "1");
    const antes = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.id } });
    const quando = util(15);
    const original = prisma.conversaWhatsApp.findUnique.bind(prisma.conversaWhatsApp);
    vi.spyOn(prisma.conversaWhatsApp, "findUnique").mockImplementationOnce((async (args: Parameters<typeof original>[0]) => {
      expect(await editar(c, { quando })).toEqual({ ok: true, dado: { id: c.id } });
      return original(args);
    }) as unknown as typeof prisma.conversaWhatsApp.findUnique);
    await despacharFila(new Date(antes.agendadaPara!.getTime() + 60_000));
    expect(enviarMock).not.toHaveBeenCalled();
    expect(await prisma.mensagemWhatsApp.count({ where: { atendimentoId: c.a.id, direcao: "SAIDA" } })).toBe(0);
    const depois = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.id } });
    expect(depois).toMatchObject({ status: "PENDENTE", corpoRenderizado: "Texto novo" });
    expect(depois.agendadaPara?.toISOString()).toBe(new Date(Math.floor(quando.getTime() / 60_000) * 60_000).toISOString());
  });

  it("em envio: 'A mensagem já está sendo enviada.'", async () => {
    const c = await agendada();
    await prisma.intencaoMensagem.update({ where: { id: c.id }, data: { status: "ENVIANDO" } });
    expect(await editar(c)).toEqual({ ok: false, erro: "A mensagem já está sendo enviada." });
    expect(await editados(c.a.id)).toHaveLength(0);
  });

  it("já enviada de outro autor (vendedor sem equipe): 'Mensagem não encontrada.'", async () => {
    const c = await agendada();
    const outro = await criarUsuario([Papel.VENDEDOR], "Outro");
    await prisma.intencaoMensagem.update({ where: { id: c.id }, data: { status: "DESPACHADA", autorId: outro.id } });
    const r = await editar(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/Mensagem não encontrada/);
  });

  it("já enviada: 'A mensagem já foi enviada.'", async () => {
    const c = await agendada();
    await prisma.intencaoMensagem.update({ where: { id: c.id }, data: { status: "DESPACHADA" } });
    expect(await editar(c)).toEqual({ ok: false, erro: "A mensagem já foi enviada." });
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.id } })).corpoRenderizado).toBe("Texto antigo");
    expect(await editados(c.a.id)).toHaveLength(0);
  });

  it("de outro autor (vendedor sem equipe): 'Mensagem não encontrada.'", async () => {
    const c = await agendada();
    const outro = await criarUsuario([Papel.VENDEDOR], "Outro");
    await prisma.intencaoMensagem.update({ where: { id: c.id }, data: { autorId: outro.id } });
    const r = await editar(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/Mensagem não encontrada/);
    expect(await editados(c.a.id)).toHaveLength(0);
  });

  it("sem ter assumido a conversa recusa a edição", async () => {
    const c = await agendada();
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { responsavelId: null } });
    const r = await editar(c);
    expect(r.ok).toBe(false);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.id } })).corpoRenderizado).toBe("Texto antigo");
  });

  it("mesma chave duas vezes: um Evento; mesma chave com outro texto é conflito", async () => {
    const c = await agendada();
    expect((await editar(c, { chaveIdempotencia: "editar-374" })).ok).toBe(true);
    expect((await editar(c, { chaveIdempotencia: "editar-374" })).ok).toBe(true);
    expect(await editados(c.a.id)).toHaveLength(1);
    const conflito = await editar(c, { chaveIdempotencia: "editar-374", texto: "Outro texto" });
    expect(conflito.ok).toBe(false);
    expect(await editados(c.a.id)).toHaveLength(1);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.id } })).corpoRenderizado).toBe("Texto novo");
  });

  it("texto vazio é recusado sem alterar", async () => {
    const c = await agendada();
    expect((await editar(c, { texto: "   " })).ok).toBe(false);
    expect(await editados(c.a.id)).toHaveLength(0);
  });
});

describe("perguntar antes de enviar se o contato responder (D11)", () => {
  async function agendadaComPergunta(perguntarSeResponder = true) {
    const c = await cenario();
    comoUsuario(c.vend);
    const quando = util(10);
    const id = idDe(await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "Lembrete", quando: quando.toISOString(), perguntarSeResponder }));
    return { ...c, id, quando };
  }
  const responder = (atendimentoId: string, em = new Date()) => prisma.atendimentoWhatsApp.update({ where: { id: atendimentoId }, data: { ultimoInboundEm: em } });
  const intencao = (id: string) => prisma.intencaoMensagem.findUniqueOrThrow({ where: { id } });
  async function retida() {
    const c = await agendadaComPergunta();
    await responder(c.a.id);
    await despacharFila(new Date(c.quando.getTime() + 60_000));
    expect(await intencao(c.id)).toMatchObject({ status: "ADIADA", motivoFalha: MOTIVO_AGUARDA_CONFIRMACAO });
    return c;
  }

  it("com a opção, entrada depois de agendar retém a mensagem: ADIADA aguarda_confirmacao_resposta e não envia", async () => {
    vi.stubEnv("WHATSAPP_LIVE", "1");
    const c = await agendadaComPergunta();
    expect((await intencao(c.id)).perguntarSeResponder).toBe(true);
    await responder(c.a.id);
    await despacharFila(new Date(c.quando.getTime() + 60_000));
    expect(await intencao(c.id)).toMatchObject({ status: "ADIADA", motivoFalha: MOTIVO_AGUARDA_CONFIRMACAO, despacharAposEm: null });
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it("sem a opção, sai normalmente (HUMANO não cai na lei da conversa viva)", async () => {
    vi.stubEnv("WHATSAPP_LIVE", "1");
    const c = await agendadaComPergunta(false);
    await responder(c.a.id);
    await despacharFila(new Date(c.quando.getTime() + 60_000));
    expect((await intencao(c.id)).status).toBe("DESPACHADA");
    expect(enviarMock).toHaveBeenCalledOnce();
  });

  it("entrada antes de agendar não retém", async () => {
    const c = await cenario();
    comoUsuario(c.vend);
    await responder(c.a.id, new Date(Date.now() - 60_000));
    const quando = util(10);
    const id = idDe(await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "Lembrete", quando: quando.toISOString(), perguntarSeResponder: true }));
    await despacharFila(new Date(quando.getTime() + 60_000));
    expect(["DESPACHADA", "SIMULADA"]).toContain((await intencao(id)).status);
  });

  it("agendadasDoAtendimento marca perguntaPendente depois da entrada", async () => {
    const c = await agendadaComPergunta();
    expect(await agendadasDoAtendimento(c.a.id)).toEqual([expect.objectContaining({ id: c.id, perguntaPendente: false })]);
    await responder(c.a.id);
    expect(await agendadasDoAtendimento(c.a.id)).toEqual([expect.objectContaining({ id: c.id, perguntaPendente: true })]);
  });

  it("manter agendada: confirma e sai no ciclo seguinte ao horário", async () => {
    vi.stubEnv("WHATSAPP_LIVE", "1");
    const c = await retida();
    expect(await manterAgendadaAposResposta({ atendimentoId: c.a.id, intencaoId: c.id })).toEqual({ ok: true, dado: { id: c.id } });
    const mantida = await intencao(c.id);
    expect(mantida).toMatchObject({ status: "PENDENTE", motivoFalha: null, despacharAposEm: null });
    expect(mantida.confirmadaAposRespostaEm).not.toBeNull();
    expect(await prisma.evento.count({ where: { tipo: "MensagemAgendadaMantida", agregadoTipo: "AtendimentoWhatsApp", agregadoId: c.a.id } })).toBe(1);
    expect(await agendadasDoAtendimento(c.a.id)).toEqual([expect.objectContaining({ id: c.id, perguntaPendente: false })]);
    await despacharFila(new Date(c.quando.getTime() + 120_000));
    expect((await intencao(c.id)).status).toBe("DESPACHADA");
    expect(enviarMock).toHaveBeenCalledOnce();
  });

  it("manter sem ter assumido a conversa recusa e a mensagem continua retida", async () => {
    const c = await retida();
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { responsavelId: null } });
    expect((await manterAgendadaAposResposta({ atendimentoId: c.a.id, intencaoId: c.id })).ok).toBe(false);
    expect(await intencao(c.id)).toMatchObject({ status: "ADIADA", motivoFalha: MOTIVO_AGUARDA_CONFIRMACAO });
  });

  it("enviar agora sobre a retida envia", async () => {
    vi.stubEnv("WHATSAPP_LIVE", "1");
    const c = await retida();
    expect((await enviarAgendamentoAgoraDoAtendimento({ atendimentoId: c.a.id, intencaoId: c.id })).ok).toBe(true);
    expect((await intencao(c.id)).status).toBe("PENDENTE");
    await despacharFila(new Date(Date.now() + 1_000));
    expect((await intencao(c.id)).status).toBe("DESPACHADA");
    expect(enviarMock).toHaveBeenCalledOnce();
  });

  it("cancelar envio: CANCELADA cancelada_pelo_autor", async () => {
    const c = await retida();
    expect((await cancelarAgendamentoDoAtendimento({ atendimentoId: c.a.id, intencaoId: c.id })).ok).toBe(true);
    expect(await intencao(c.id)).toMatchObject({ status: "CANCELADA", motivoFalha: "cancelada_pelo_autor" });
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it("mesma chave com perguntarSeResponder diferente: conflito", async () => {
    const c = await cenario();
    comoUsuario(c.vend);
    const quando = util(10).toISOString();
    expect((await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "x", quando, perguntarSeResponder: true, chaveIdempotencia: "agendar-373" })).ok).toBe(true);
    expect((await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "x", quando, perguntarSeResponder: false, chaveIdempotencia: "agendar-373" })).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: c.a.id } })).toBe(1);
  });
});

describe("anexo e vínculo no agendamento", () => {
  const criados: string[] = [];
  afterEach(async () => { for (const f of criados.splice(0)) await rm(f, { recursive: true, force: true }); });
  async function comOportunidade() {
    const c = await cenario();
    const lead = await prisma.oportunidade.create({ data: { nome: "Lead375", telefoneE164: c.contato.telefoneE164, vendedorDonoId: c.vend.id } });
    await prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { leadId: lead.id } });
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { leadId: lead.id } });
    criados.push(path.join(UPLOAD_DIR, "whatsapp-out", c.vend.id));
    return { ...c, lead };
  }
  async function proposta(leadId: string) {
    const dir = path.join(UPLOAD_DIR, "documentos");
    await mkdir(dir, { recursive: true });
    const nome = `${Date.now()}-${Math.round(Math.random() * 1e6)}-proposta375.pdf`;
    criados.push(path.join(dir, nome));
    await writeFile(path.join(dir, nome), Buffer.from("pdf-proposta-375"));
    return prisma.documento.create({ data: { leadId, categoria: "PROPOSTA", nome: "Proposta Lead375.pdf", url: `/api/files/documentos/${nome}` } });
  }
  const tarefa = (dados: { responsavelId: string; leadId?: string; pessoaId?: string; status?: "ABERTA" | "CONCLUIDA" }) =>
    prisma.tarefa.create({ data: { titulo: "Ligar para o lead", tipo: "LIGACAO", setor: "COMERCIAL", fusoOrigem: "America/Sao_Paulo", ...dados } });

  it("agenda com a proposta: intenção DOCUMENTO com midiaPath em whatsapp-out do autor; texto opcional", async () => {
    const c = await comOportunidade();
    comoUsuario(c.vend);
    const doc = await proposta(c.lead.id);
    const r = await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "", quando: util(10).toISOString(), documentoPropostaId: doc.id, chaveIdempotencia: "agendar-375-prop" });
    const i = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: idDe(r) } });
    expect(i).toMatchObject({ tipo: "DOCUMENTO", corpoRenderizado: "", origem: "HUMANO", autorId: c.vend.id });
    expect(midiaSaidaDoAutor(i.midiaPath!, c.vend.id)).toBe(true);
    expect((await readFile(path.join(UPLOAD_DIR, i.midiaPath!.slice("/api/files/".length)))).toString()).toBe("pdf-proposta-375");
    expect(await prisma.evento.findFirst({ where: { tipo: "MensagemAgendada", agregadoId: c.a.id } })).toMatchObject({
      agregadoTipo: "AtendimentoWhatsApp", payload: expect.objectContaining({ intencaoId: i.id, documentoPropostaId: doc.id, anexoNome: "Proposta Lead375.pdf", anexoTipo: "DOCUMENTO" }),
    });
    expect(await agendadasDoAtendimento(c.a.id)).toEqual([expect.objectContaining({ id: i.id, temAnexo: true, anexoNome: "Proposta Lead375.pdf" })]);
    const repetida = await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "", quando: util(10).toISOString(), documentoPropostaId: doc.id, chaveIdempotencia: "agendar-375-prop" });
    expect(idDe(repetida)).toBe(i.id);
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: c.a.id } })).toBe(1);
  });

  it("proposta de outra oportunidade é recusada sem copiar", async () => {
    const c = await comOportunidade();
    comoUsuario(c.vend);
    const outra = await prisma.oportunidade.create({ data: { nome: "Outra375", vendedorDonoId: c.vend.id } });
    const doc = await proposta(outra.id);
    expect(await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "x", quando: util(10).toISOString(), documentoPropostaId: doc.id })).toEqual({ ok: false, erro: "Proposta não encontrada." });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("agenda com arquivo do uploader; arquivo de outro autor é recusado", async () => {
    const c = await comOportunidade();
    comoUsuario(c.vend);
    const url = (await salvarMidiaSaida(c.vend.id, Buffer.from("png"), "image/png"))!;
    const r = await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "Foto da turma", quando: util(10).toISOString(), midiaUrl: url, anexoNome: "turma.png" });
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: idDe(r) } })).toMatchObject({ tipo: "IMAGEM", midiaPath: url, corpoRenderizado: "Foto da turma" });
    criados.push(path.join(UPLOAD_DIR, "whatsapp-out", c.fora.id));
    const alheio = (await salvarMidiaSaida(c.fora.id, Buffer.from("png"), "image/png"))!;
    expect(await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "x", quando: util(10).toISOString(), midiaUrl: alheio })).toEqual({ ok: false, erro: "Anexo inválido: envie o arquivo pelo uploader da inbox." });
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: c.a.id } })).toBe(1);
  });

  it("vínculo com a oportunidade da conversa grava leadId; de outra oportunidade é recusado", async () => {
    const c = await comOportunidade();
    comoUsuario(c.vend);
    const r = await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "Retorno", quando: util(10).toISOString(), leadId: c.lead.id });
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: idDe(r) } })).toMatchObject({ leadId: c.lead.id, tarefaId: null });
    expect(await prisma.evento.findFirst({ where: { tipo: "MensagemAgendada", agregadoId: c.a.id } })).toMatchObject({ agregadoTipo: "AtendimentoWhatsApp", payload: expect.objectContaining({ leadId: c.lead.id }) });
    const outra = await prisma.oportunidade.create({ data: { nome: "Outra375", vendedorDonoId: c.vend.id } });
    expect(await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "x", quando: util(10).toISOString(), leadId: outra.id })).toEqual({ ok: false, erro: "Oportunidade não é desta conversa." });
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: c.a.id } })).toBe(1);
  });

  it("vínculo com tarefa aberta da oportunidade grava tarefaId; tarefa concluída ou de outro contato é recusada", async () => {
    const c = await comOportunidade();
    comoUsuario(c.vend);
    const aberta = await tarefa({ responsavelId: c.vend.id, leadId: c.lead.id });
    const concluida = await tarefa({ responsavelId: c.vend.id, leadId: c.lead.id, status: "CONCLUIDA" });
    const outraOp = await prisma.oportunidade.create({ data: { nome: "Outra375", vendedorDonoId: c.vend.id } });
    const deOutro = await tarefa({ responsavelId: c.vend.id, leadId: outraOp.id });
    expect(await tarefasAbertasParaVinculo(c.a.id)).toEqual([{ id: aberta.id, titulo: "Ligar para o lead" }]);
    const r = await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "Lembrete", quando: util(10).toISOString(), tarefaId: aberta.id });
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: idDe(r) } })).toMatchObject({ tarefaId: aberta.id });
    expect(await prisma.evento.findFirst({ where: { tipo: "MensagemAgendada", agregadoId: c.a.id } })).toMatchObject({ agregadoTipo: "AtendimentoWhatsApp", payload: expect.objectContaining({ tarefaId: aberta.id }) });
    for (const t of [concluida, deOutro]) {
      expect(await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "x", quando: util(10).toISOString(), tarefaId: t.id })).toEqual({ ok: false, erro: "Tarefa não encontrada ou já concluída." });
    }
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: c.a.id } })).toBe(1);
  });

  it("sem ter assumido, anexo e vínculo não criam nada", async () => {
    const c = await comOportunidade();
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { responsavelId: null } });
    comoUsuario(c.vend);
    const doc = await proposta(c.lead.id);
    const r = await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "x", quando: util(10).toISOString(), documentoPropostaId: doc.id, leadId: c.lead.id });
    expect(r.ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("agendada com anexo sai como mídia no horário", async () => {
    const c = await comOportunidade();
    comoUsuario(c.vend);
    const doc = await proposta(c.lead.id);
    const quando = util(10);
    const r = await agendarMensagemNoAtendimento({ atendimentoId: c.a.id, texto: "Segue a proposta", quando: quando.toISOString(), documentoPropostaId: doc.id });
    vi.stubEnv("WHATSAPP_LIVE", "1");
    await despacharFila(new Date(quando.getTime() - 60_000));
    expect(enviarMock).not.toHaveBeenCalled();
    await despacharFila(new Date(quando.getTime() + 60_000));
    expect(await status(r)).toBe("DESPACHADA");
    expect(enviarMock).toHaveBeenCalledOnce();
    expect(enviarMock.mock.calls[0]![2]).toMatchObject({ tipo: "DOCUMENTO", mime: "application/pdf", legenda: "Segue a proposta" });
    expect(await prisma.mensagemWhatsApp.findFirst({ where: { atendimentoId: c.a.id, direcao: "SAIDA" } })).toMatchObject({ tipo: "DOCUMENTO", corpo: "Segue a proposta" });
  });
});
