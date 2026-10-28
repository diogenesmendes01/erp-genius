import { DriverWhatsApp, Papel } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "@/lib/uploads";
const { authMock, enviarMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./drivers/motor", () => ({ driverMotor: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { garantirAtendimento } from "./atendimentos";
import { enviarPropostaNoAtendimento } from "./acoes-conversa";
import { propostasDoAtendimento } from "./consultas-acoes-atendimento";
import { midiaSaidaDoAutor } from "./midia";
import { ERRO_ANEXAR_PROPOSTA } from "./proposta-atendimento";

const DIR_DOCUMENTOS = path.join(UPLOAD_DIR, "documentos");
const arquivosCriados: string[] = [];
const autoresComSaida: string[] = [];

beforeEach(async () => {
  await truncarBanco(); authMock.mockReset();
  enviarMock.mockReset().mockResolvedValue({ providerMessageId: "teste-sem-rede" });
});
afterEach(async () => {
  for (const f of arquivosCriados.splice(0)) await rm(f, { force: true });
  for (const autor of autoresComSaida.splice(0)) await rm(path.join(UPLOAD_DIR, "whatsapp-out", autor), { recursive: true, force: true });
});
const comoUsuario = (u: { id: string }) => { authMock.mockResolvedValue({ user: { id: u.id } }); autoresComSaida.push(u.id); };

async function gravarDocumento(nome: string, conteudo = "pdf-da-proposta") {
  await mkdir(DIR_DOCUMENTOS, { recursive: true });
  const arquivo = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${nome}`;
  arquivosCriados.push(path.join(DIR_DOCUMENTOS, arquivo));
  await writeFile(path.join(DIR_DOCUMENTOS, arquivo), Buffer.from(conteudo));
  return `/api/files/documentos/${arquivo}`;
}

async function cenario() {
  const vend = await criarUsuario([Papel.VENDEDOR], "Vendedor366");
  const outro = await criarUsuario([Papel.VENDEDOR], "Outro366");
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990366", rotulo: "Comercial", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", donoId: null } });
  const lead = await prisma.oportunidade.create({ data: { nome: "Lead366", telefoneE164: "+50688880366", vendedorDonoId: vend.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id, responsavelId: vend.id }));
  const doc = await prisma.documento.create({ data: { leadId: lead.id, categoria: "PROPOSTA", nome: "Proposta Lead366.pdf", url: await gravarDocumento("proposta.pdf") } });
  return { vend, outro, numero, lead, contato, a, doc };
}

describe("anexo de proposta da oportunidade no Inbox", () => {
  it("vendedor envia a proposta da oportunidade da conversa: DOCUMENTO em whatsapp-out do autor, Evento com a marca", async () => {
    const { vend, a, doc } = await cenario();
    comoUsuario(vend);
    const r = await enviarPropostaNoAtendimento({ atendimentoId: a.id, documentoId: doc.id, chaveIdempotencia: "chave-prop-0001" });
    expect(r.ok).toBe(true);
    const i = await prisma.intencaoMensagem.findFirstOrThrow({ where: { atendimentoId: a.id } });
    expect(i).toMatchObject({ origem: "HUMANO", tipo: "DOCUMENTO", autorId: vend.id, corpoRenderizado: "" });
    expect(midiaSaidaDoAutor(i.midiaPath!, vend.id)).toBe(true);
    expect((await readFile(path.join(UPLOAD_DIR, i.midiaPath!.slice("/api/files/".length)))).toString()).toBe("pdf-da-proposta");
    expect(await prisma.evento.findFirst({ where: { tipo: "PropostaEnviadaNoAtendimento", agregadoId: a.id } })).toMatchObject({
      agregadoTipo: "AtendimentoWhatsApp", autorId: vend.id,
      payload: expect.objectContaining({ documentoId: doc.id, intencaoId: i.id, chaveIdempotencia: "chave-prop-0001" }),
    });
  });

  it("mesma chave: uma intenção e um Evento; outra proposta com a mesma chave é recusada", async () => {
    const { vend, lead, a, doc } = await cenario();
    comoUsuario(vend);
    const primeira = await enviarPropostaNoAtendimento({ atendimentoId: a.id, documentoId: doc.id, chaveIdempotencia: "chave-prop-0002" });
    const segunda = await enviarPropostaNoAtendimento({ atendimentoId: a.id, documentoId: doc.id, chaveIdempotencia: "chave-prop-0002" });
    expect(primeira.ok).toBe(true);
    expect(segunda.ok).toBe(true);
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: a.id } })).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "PropostaEnviadaNoAtendimento" } })).toBe(1);
    expect(await readdir(path.join(UPLOAD_DIR, "whatsapp-out", vend.id))).toHaveLength(1);
    const outra = await prisma.documento.create({ data: { leadId: lead.id, categoria: "PROPOSTA", nome: "Outra.pdf", url: await gravarDocumento("outra.pdf") } });
    const conflito = await enviarPropostaNoAtendimento({ atendimentoId: a.id, documentoId: outra.id, chaveIdempotencia: "chave-prop-0002" });
    expect(conflito.ok).toBe(false);
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: a.id } })).toBe(1);
  });

  it("documento de outra oportunidade, arquivado ou de outra categoria: 'Proposta não encontrada.' e nenhuma intenção", async () => {
    const { vend, a, lead } = await cenario();
    const outraOportunidade = await prisma.oportunidade.create({ data: { nome: "Outra366", telefoneE164: "+50688881366", vendedorDonoId: vend.id } });
    const deOutra = await prisma.documento.create({ data: { leadId: outraOportunidade.id, categoria: "PROPOSTA", nome: "De outra.pdf", url: await gravarDocumento("de-outra.pdf") } });
    const arquivada = await prisma.documento.create({ data: { leadId: lead.id, categoria: "PROPOSTA", nome: "Arquivada.pdf", url: await gravarDocumento("arquivada.pdf"), arquivado: true } });
    const contrato = await prisma.documento.create({ data: { leadId: lead.id, categoria: "CONTRATO", nome: "Contrato.pdf", url: await gravarDocumento("contrato.pdf") } });
    comoUsuario(vend);
    for (const d of [deOutra, arquivada, contrato]) {
      expect(await enviarPropostaNoAtendimento({ atendimentoId: a.id, documentoId: d.id })).toEqual({ ok: false, erro: "Proposta não encontrada." });
    }
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.evento.count({ where: { tipo: "PropostaEnviadaNoAtendimento" } })).toBe(0);
  });

  it("arquivo ausente ou de tipo não aceito: pede para conferir na oportunidade, sem intenção", async () => {
    const { vend, a, lead } = await cenario();
    const ausente = await prisma.documento.create({ data: { leadId: lead.id, categoria: "PROPOSTA", nome: "Sumiu.pdf", url: "/api/files/documentos/nao-existe-366.pdf" } });
    const planilha = await prisma.documento.create({ data: { leadId: lead.id, categoria: "PROPOSTA", nome: "Planilha.xlsx", url: await gravarDocumento("planilha.xlsx") } });
    comoUsuario(vend);
    for (const d of [ausente, planilha]) {
      expect(await enviarPropostaNoAtendimento({ atendimentoId: a.id, documentoId: d.id })).toEqual({ ok: false, erro: ERRO_ANEXAR_PROPOSTA });
    }
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("quem não vê a oportunidade na thread não lista nem envia", async () => {
    const { outro, a, doc } = await cenario();
    comoUsuario(outro);
    expect(await propostasDoAtendimento(a.id)).toEqual({ oportunidadeId: null, propostas: [] });
    expect(await enviarPropostaNoAtendimento({ atendimentoId: a.id, documentoId: doc.id })).toEqual({ ok: false, erro: "Proposta não encontrada." });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("contato em opt-out: recusa sem intenção, sem Evento e sem cópia em whatsapp-out", async () => {
    const { vend, contato, a, doc } = await cenario();
    await prisma.contatoWhatsApp.update({ where: { id: contato.id }, data: { optOutEm: new Date() } });
    comoUsuario(vend);
    const r = await enviarPropostaNoAtendimento({ atendimentoId: a.id, documentoId: doc.id, chaveIdempotencia: "chave-prop-0003" });
    expect(r.ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.evento.count({ where: { tipo: "PropostaEnviadaNoAtendimento" } })).toBe(0);
    expect(await readdir(path.join(UPLOAD_DIR, "whatsapp-out", vend.id)).catch(() => [])).toHaveLength(0);
  });

  it("lista: só PROPOSTA não arquivada, da mais nova para a mais antiga, até 10, sem expor a url", async () => {
    const { vend, lead, a, doc } = await cenario();
    await prisma.documento.update({ where: { id: doc.id }, data: { criadoEm: new Date("2026-01-01T00:00:00Z") } });
    const datas = Array.from({ length: 11 }, (_, i) => new Date(Date.UTC(2026, 1, i + 1)));
    for (const [i, criadoEm] of datas.entries()) {
      await prisma.documento.create({ data: { leadId: lead.id, categoria: "PROPOSTA", nome: `Versão ${i + 1}.pdf`, url: await gravarDocumento(`v${i + 1}.pdf`), criadoEm } });
    }
    await prisma.documento.create({ data: { leadId: lead.id, categoria: "PROPOSTA", nome: "Arquivada.pdf", url: await gravarDocumento("arq.pdf"), arquivado: true, criadoEm: new Date("2026-12-01T00:00:00Z") } });
    await prisma.documento.create({ data: { leadId: lead.id, categoria: "COMPROVANTE", nome: "Comprovante.pdf", url: await gravarDocumento("comp.pdf"), criadoEm: new Date("2026-12-02T00:00:00Z") } });
    comoUsuario(vend);
    const r = await propostasDoAtendimento(a.id);
    expect(r.oportunidadeId).toBe(lead.id);
    expect(r.propostas.map((p) => p.nome)).toEqual(Array.from({ length: 10 }, (_, i) => `Versão ${11 - i}.pdf`));
    expect(r.propostas[0]).toEqual({ id: expect.any(String), nome: "Versão 11.pdf", criadoEm: datas[10].toISOString() });
  });

  it("oportunidade sem proposta: devolve a oportunidade com a lista vazia; conversa não comercial não oferece", async () => {
    const { vend, a, doc, numero, lead } = await cenario();
    await prisma.documento.update({ where: { id: doc.id }, data: { arquivado: true } });
    comoUsuario(vend);
    expect(await propostasDoAtendimento(a.id)).toEqual({ oportunidadeId: lead.id, propostas: [] });
    const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin366");
    const contatoFin = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688882366", leadId: lead.id } });
    const cat = await seedCatalogoMinimo();
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno366", paisId: cat.pais.id } });
    const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC" } });
    const fin = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contatoFin.id, finalidade: "FINANCEIRO", leadId: lead.id, alunoId: aluno.id, matriculaId: matricula.id }));
    comoUsuario(admin);
    expect(await propostasDoAtendimento(fin.id)).toEqual({ oportunidadeId: null, propostas: [] });
  });
});
