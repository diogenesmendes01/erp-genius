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
import { enviarMaterialDoCatalogo } from "./acoes-conversa";
import { catalogoDoAtendimento } from "./consultas-acoes-atendimento";
import { midiaSaidaDoAutor } from "./midia";
import { ERRO_ANEXAR_MATERIAL, ERRO_MATERIAL_INDISPONIVEL } from "./catalogo-atendimento";

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

async function gravarArquivo(nome: string, conteudo = "pdf-do-catalogo") {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const arquivo = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${nome}`;
  arquivosCriados.push(path.join(UPLOAD_DIR, arquivo));
  await writeFile(path.join(UPLOAD_DIR, arquivo), Buffer.from(conteudo));
  return `/api/files/${arquivo}`;
}

type Material = { nome: string; enviavelAoLead?: boolean; arquivadaEm?: Date | null; validoAte?: Date | null; status?: "PRONTA" | "ERRO"; tipo?: "ARQUIVO" | "TEXTO"; url?: string };
async function criarMaterial(autorId: string, m: Material) {
  const url = m.url ?? await gravarArquivo(m.nome.toLowerCase().replace(/\s+/g, "-"));
  const upload = m.tipo === "TEXTO" ? null : await prisma.registroUpload.create({ data: { url, autorId, nome: m.nome, mime: "application/pdf", tamanho: 15 } });
  return prisma.fonteConhecimento.create({
    data: {
      tipo: m.tipo ?? "ARQUIVO", nome: m.nome, registroUploadId: upload?.id ?? null, status: m.status ?? "PRONTA", hashConteudo: `hash-${m.nome}`,
      enviavelAoLead: m.enviavelAoLead ?? true, arquivadaEm: m.arquivadaEm ?? null, validoAte: m.validoAte ?? null, criadoPorId: autorId,
    },
  });
}

async function cenario() {
  const vend = await criarUsuario([Papel.VENDEDOR], "Vendedor378");
  const outro = await criarUsuario([Papel.VENDEDOR], "Outro378");
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente378");
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990378", rotulo: "Comercial", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", donoId: null } });
  const lead = await prisma.oportunidade.create({ data: { nome: "Lead378", telefoneE164: "+50688880378", vendedorDonoId: vend.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id, responsavelId: vend.id }));
  const material = await criarMaterial(gerente.id, { nome: "Catálogo de cursos.pdf" });
  return { vend, outro, gerente, numero, lead, contato, a, material };
}

describe("catálogo no menu de anexos do Inbox", () => {
  it("lista só materiais ativos da Aria: ARQUIVO, enviável, pronto, não arquivado, dentro da validade e com tipo aceito", async () => {
    const { vend, gerente, a, material } = await cenario();
    const futuro = new Date(Date.now() + 86_400_000);
    const valido = await criarMaterial(gerente.id, { nome: "Apresentação.pdf", validoAte: futuro });
    await criarMaterial(gerente.id, { nome: "Vencido.pdf", validoAte: new Date(Date.now() - 60_000) });
    await criarMaterial(gerente.id, { nome: "Arquivado.pdf", arquivadaEm: new Date() });
    await criarMaterial(gerente.id, { nome: "Interno.pdf", enviavelAoLead: false });
    await criarMaterial(gerente.id, { nome: "Com erro.pdf", status: "ERRO" });
    await criarMaterial(gerente.id, { nome: "Texto solto", tipo: "TEXTO" });
    await criarMaterial(gerente.id, { nome: "Notas.md", url: await gravarArquivo("notas.md") });
    comoUsuario(vend);
    expect(await catalogoDoAtendimento(a.id)).toEqual([{ id: valido.id, nome: "Apresentação.pdf" }, { id: material.id, nome: "Catálogo de cursos.pdf" }]);
  });

  it("vendedor envia o material: DOCUMENTO copiado para whatsapp-out do autor, Evento com a marca", async () => {
    const { vend, a, material } = await cenario();
    comoUsuario(vend);
    const r = await enviarMaterialDoCatalogo({ atendimentoId: a.id, fonteId: material.id, chaveIdempotencia: "chave-cat-0001" });
    expect(r.ok).toBe(true);
    const i = await prisma.intencaoMensagem.findFirstOrThrow({ where: { atendimentoId: a.id } });
    expect(i).toMatchObject({ origem: "HUMANO", tipo: "DOCUMENTO", autorId: vend.id, corpoRenderizado: "" });
    expect(midiaSaidaDoAutor(i.midiaPath!, vend.id)).toBe(true);
    expect((await readFile(path.join(UPLOAD_DIR, i.midiaPath!.slice("/api/files/".length)))).toString()).toBe("pdf-do-catalogo");
    expect(await prisma.evento.findFirst({ where: { tipo: "CatalogoEnviadoNoAtendimento", agregadoId: a.id } })).toMatchObject({
      agregadoTipo: "AtendimentoWhatsApp", autorId: vend.id,
      payload: expect.objectContaining({ fonteId: material.id, intencaoId: i.id, chaveIdempotencia: "chave-cat-0001" }),
    });
  });

  it("mesma chave: uma intenção, um Evento e uma cópia; outro material com a mesma chave é recusado", async () => {
    const { vend, gerente, a, material } = await cenario();
    comoUsuario(vend);
    const primeira = await enviarMaterialDoCatalogo({ atendimentoId: a.id, fonteId: material.id, chaveIdempotencia: "chave-cat-0002" });
    const segunda = await enviarMaterialDoCatalogo({ atendimentoId: a.id, fonteId: material.id, chaveIdempotencia: "chave-cat-0002" });
    expect(primeira.ok).toBe(true);
    expect(segunda.ok).toBe(true);
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: a.id } })).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "CatalogoEnviadoNoAtendimento" } })).toBe(1);
    expect(await readdir(path.join(UPLOAD_DIR, "whatsapp-out", vend.id))).toHaveLength(1);
    const outro = await criarMaterial(gerente.id, { nome: "Outro.pdf" });
    const conflito = await enviarMaterialDoCatalogo({ atendimentoId: a.id, fonteId: outro.id, chaveIdempotencia: "chave-cat-0002" });
    expect(conflito.ok).toBe(false);
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId: a.id } })).toBe(1);
  });

  it("material arquivado, vencido, não enviável ou de texto: recusa sem intenção nem Evento", async () => {
    const { vend, gerente, a } = await cenario();
    const recusados = [
      await criarMaterial(gerente.id, { nome: "Arquivado.pdf", arquivadaEm: new Date() }),
      await criarMaterial(gerente.id, { nome: "Vencido.pdf", validoAte: new Date(Date.now() - 60_000) }),
      await criarMaterial(gerente.id, { nome: "Interno.pdf", enviavelAoLead: false }),
      await criarMaterial(gerente.id, { nome: "Texto", tipo: "TEXTO" }),
    ];
    comoUsuario(vend);
    for (const f of recusados) {
      expect(await enviarMaterialDoCatalogo({ atendimentoId: a.id, fonteId: f.id })).toEqual({ ok: false, erro: ERRO_MATERIAL_INDISPONIVEL });
    }
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.evento.count({ where: { tipo: "CatalogoEnviadoNoAtendimento" } })).toBe(0);
  });

  it("arquivo ausente no armazenamento: pede para conferir o arquivo, sem intenção", async () => {
    const { vend, gerente, a } = await cenario();
    const ausente = await criarMaterial(gerente.id, { nome: "Sumiu.pdf", url: "/api/files/nao-existe-378.pdf" });
    comoUsuario(vend);
    expect(await enviarMaterialDoCatalogo({ atendimentoId: a.id, fonteId: ausente.id })).toEqual({ ok: false, erro: ERRO_ANEXAR_MATERIAL });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("quem não pode enviar na conversa não lista nem envia", async () => {
    const { outro, a, material } = await cenario();
    comoUsuario(outro);
    expect(await catalogoDoAtendimento(a.id)).toEqual([]);
    expect(await enviarMaterialDoCatalogo({ atendimentoId: a.id, fonteId: material.id })).toEqual({ ok: false, erro: ERRO_MATERIAL_INDISPONIVEL });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("contato em opt-out: recusa sem intenção, sem Evento e sem cópia em whatsapp-out", async () => {
    const { vend, contato, a, material } = await cenario();
    await prisma.contatoWhatsApp.update({ where: { id: contato.id }, data: { optOutEm: new Date() } });
    comoUsuario(vend);
    const r = await enviarMaterialDoCatalogo({ atendimentoId: a.id, fonteId: material.id, chaveIdempotencia: "chave-cat-0003" });
    expect(r.ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.evento.count({ where: { tipo: "CatalogoEnviadoNoAtendimento" } })).toBe(0);
    expect(await readdir(path.join(UPLOAD_DIR, "whatsapp-out", vend.id)).catch(() => [])).toHaveLength(0);
  });

  it("conversa não comercial ou encerrada não oferece o catálogo", async () => {
    const { numero, lead, a, vend, material } = await cenario();
    const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin378");
    const contatoFin = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688882378", leadId: lead.id } });
    const cat = await seedCatalogoMinimo();
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno378", paisId: cat.pais.id } });
    const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC" } });
    const fin = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contatoFin.id, finalidade: "FINANCEIRO", leadId: lead.id, alunoId: aluno.id, matriculaId: matricula.id }));
    comoUsuario(admin);
    expect(await catalogoDoAtendimento(fin.id)).toEqual([]);
    expect(await enviarMaterialDoCatalogo({ atendimentoId: fin.id, fonteId: material.id })).toEqual({ ok: false, erro: ERRO_MATERIAL_INDISPONIVEL });
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { status: "ENCERRADO", encerradoEm: new Date() } });
    comoUsuario(vend);
    expect(await catalogoDoAtendimento(a.id)).toEqual([]);
  });
});
