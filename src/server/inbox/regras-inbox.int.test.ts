import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, DriverWhatsApp } from "@prisma/client";

const { authMock, enviarMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Fase 4B: o despachante só envia pelo motor (META_CLOUD e BAILEYS não têm driver); o motor fica simulado.
vi.mock("@/server/whatsapp/drivers/motor", () => ({ driverMotor: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor, seedCanal } from "@/test/integracao-whatsapp";
import { atendimentoVisivel, garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { enviarMidiaInbox, enviarTextoInbox, marcarConversaTratada, registrarOptOutContato, removerOptOutContato, vincularContatoWhatsApp, editarNomeContatoWhatsApp } from "@/server/whatsapp/acoes";
import { assumirAtendimento, atribuirAtendimento, convidarParticipante, devolverParaFila, revogarParticipante, transferirAtendimento } from "@/server/whatsapp/acoes-atendimento";
import { diaUtilAs } from "@/test/janela-envio";
import { agendarMensagemNoAtendimento, cancelarAgendamentoDoAtendimento, encaminharMensagem, registrarNotaAtendimento } from "@/server/whatsapp/acoes-conversa";
import { abrirAtendimentoInstitucional, classificarMensagemWhatsApp, encerrarAtendimentoWhatsApp, listarTriagemWhatsApp, revisarFalhaEnvio } from "@/server/whatsapp/operacoes-atendimento";
import { destinatarioAtualDoAtendimento } from "@/server/whatsapp/destinatario-atual";
import { comContatoIndividual, gravarMensagemGrupo } from "@/server/whatsapp/grupos";
import { despacharFila } from "@/server/whatsapp/despachante";
import { processarMensagemNormalizada } from "@/server/whatsapp/inbound";
import { garantirContato } from "@/server/whatsapp/identidade";
import { podeLerArquivo } from "@/server/uploads/autorizacao";
import { listarAtendimentosPagina } from "./consultas-pagina";

// Aceite da Fase 3: um `it` por regra do §4.4 do levantamento (o número está no nome). Cada cenário usa
// as funções reais de produção sobre o banco; envios saem por driver simulado (nunca mensagem real).

type U = Awaited<ReturnType<typeof criarUsuario>>;
const sessao = (u: U) => ({ id: u.id, nome: u.nome, papeis: u.papeis }) as never;
const como = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
// D12: agendamento só dentro da janela de envio da escola (fábrica: 9h–20h, segunda a sexta).
const naJanela = () => diaUtilAs(10).toISOString();
const abrir = (numeroId: string, contatoId: string, extra: Parameters<typeof garantirAtendimento>[1] extends infer D ? Partial<D> : never) =>
  prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId, contatoId, finalidade: "COMERCIAL", ...extra } as never));

let vend: U, vend2: U, gerente: U, fin: U, sec: U, adm: U;

beforeEach(async () => {
  await truncarBanco();
  authMock.mockReset();
  enviarMock.mockReset().mockResolvedValue({ providerMessageId: "teste-sem-rede" });
  vi.stubEnv("WHATSAPP_LIVE", "1");
  vend = await criarUsuario([Papel.VENDEDOR], "Vend Um");
  vend2 = await criarUsuario([Papel.VENDEDOR], "Vend Dois");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  fin = await criarUsuario([Papel.FINANCEIRO], "Fin");
  sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Sec");
  adm = await criarUsuario([Papel.ADMINISTRADOR], "Adm");
});
afterEach(() => vi.unstubAllEnvs());

/** Número de vários setores com o vendedor como dono, um contato e um atendimento COMERCIAL dele. */
async function comercial(telefone = "+50688880001", setores: ("COMERCIAL" | "SECRETARIA" | "FINANCEIRO")[] = ["COMERCIAL", "SECRETARIA", "FINANCEIRO"]) {
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores, donoId: vend.id });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone } });
  const a = await abrir(numero.id, contato.id, { responsavelId: vend.id });
  return { numero, contato, a };
}

/** Aluno com matrícula, turma do professor e atendimentos PEDAGOGICO e FINANCEIRO no mesmo contato. */
async function turma() {
  const cat = await seedCatalogoMinimo();
  const prof = await criarUsuario([Papel.PROFESSOR], "Prof");
  const outro = await criarUsuario([Papel.PROFESSOR], "Prof Outro");
  const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A1", ordem: 1 } });
  const t = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: cat.modalidade.id, professorId: prof.id } });
  await prisma.vinculoDocente.create({ data: { turmaId: t.id, professorId: prof.id, inicio: new Date(Date.now() - 1000) } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna", paisId: cat.pais.id, telefoneE164: "+50680001111", whatsapp: true, email: "privado@example.test" } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", codigo: "CT-1" } });
  await prisma.alocacaoTurma.create({ data: { turmaId: t.id, alunoId: aluno.id, matriculaId: matricula.id } });
  const { numero } = await seedCanal({ driver: DriverWhatsApp.BAILEYS, estado: "ATIVA" });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: aluno.telefoneE164!, alunoId: aluno.id, nomeExibicao: aluno.telefoneE164 } });
  const pedagogico = await abrir(numero.id, contato.id, { finalidade: "PEDAGOGICO", alunoId: aluno.id, turmaId: t.id, matriculaId: matricula.id });
  const financeiro = await abrir(numero.id, contato.id, { finalidade: "FINANCEIRO", alunoId: aluno.id, matriculaId: matricula.id, responsavelId: fin.id });
  return { prof, outro, t, aluno, matricula, numero, contato, pedagogico, financeiro };
}

describe("§4.4 — regras do Inbox", () => {
  it("01 acesso vem do atendimento, nunca do número", async () => {
    const { numero, a } = await comercial();
    // O financeiro e a secretaria atendem o mesmo número (setores FINANCEIRO e SECRETARIA), mas não têm vínculo com o assunto COMERCIAL.
    expect(await atendimentoVisivel(sessao(fin), a.id)).toBeNull();
    expect(await atendimentoVisivel(sessao(sec), a.id)).toBeNull();
    expect((await listarAtendimentosPagina(sessao(fin), {}, null)).itens).toHaveLength(0);
    expect(numero.id).toBeTruthy();
    expect(await atendimentoVisivel(sessao(vend), a.id)).not.toBeNull();
  });

  it("02 carteira comercial atual (vendedor, cobertura vigente, equipe)", async () => {
    const numero = await criarNumeroSetor({ telefoneE164: "+5511999990002", setores: ["COMERCIAL"], finalidade: "COBRANCA" });
    const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688888888", vendedorDonoId: vend.id } });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
    const a = await abrir(numero.id, contato.id, { leadId: lead.id });
    expect(await atendimentoVisivel(sessao(vend), a.id)).not.toBeNull();
    expect(await atendimentoVisivel(sessao(vend2), a.id)).toBeNull();
    await prisma.coberturaCarteira.create({ data: { titularId: vend.id, substitutoId: vend2.id, concedenteId: gerente.id,
      inicio: new Date(Date.now() - 1000), fim: new Date(Date.now() + 60_000), motivo: "Férias do titular" } });
    expect(await atendimentoVisivel(sessao(vend2), a.id)).not.toBeNull();
    // A carteira é a de agora: ao trocar o dono do lead, o antigo perde o acesso.
    await prisma.oportunidade.update({ where: { id: lead.id }, data: { vendedorDonoId: vend2.id } });
    await prisma.coberturaCarteira.deleteMany();
    expect(await atendimentoVisivel(sessao(vend), a.id)).toBeNull();
    expect(await atendimentoVisivel(sessao(vend2), a.id)).not.toBeNull();
  });

  it("03 linha comercial: dono e gerente veem toda a linha; a cobertura não dá acesso; o painel do lead segue a carteira", async () => {
    await prisma.usuario.update({ where: { id: vend.id }, data: { gerenteComercialId: gerente.id } });
    const linha = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511988880000", rotulo: "Vendas A", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "linha-a", donoId: vend.id } });
    const alheio = await prisma.oportunidade.create({ data: { nome: "Lead do outro", telefoneE164: "+50670001111", vendedorDonoId: vend2.id } });
    await prisma.contatoWhatsApp.create({ data: { telefoneE164: alheio.telefoneE164!, leadId: alheio.id } });
    await processarMensagemNormalizada({ numeroProviderRef: "linha-a", contatoWaId: "50670001111", nomeExibicao: "Alheio", providerMessageId: "R3-1", corpo: "Oi", tipo: "TEXTO", driver: DriverWhatsApp.BAILEYS, fromMe: false, quando: new Date() });
    const a = await prisma.atendimentoWhatsApp.findFirstOrThrow({ where: { conversa: { numeroId: linha.id } } });
    expect(await atendimentoVisivel(sessao(vend), a.id)).not.toBeNull();
    expect(await atendimentoVisivel(sessao(gerente), a.id)).not.toBeNull();
    // Cobertura de carteira não entrega a linha do titular (o lead é de vend2, então vend2 vê pelo lead, mas um substituto de vend não ganha a linha).
    const substituto = await criarUsuario([Papel.VENDEDOR], "Substituto");
    await prisma.coberturaCarteira.create({ data: { titularId: vend.id, substitutoId: substituto.id, concedenteId: gerente.id,
      inicio: new Date(Date.now() - 1000), fim: new Date(Date.now() + 60_000), motivo: "Férias do titular" } });
    expect(await atendimentoVisivel(sessao(substituto), a.id)).toBeNull();
    // O dono da linha vê a conversa, mas o painel do lead segue a carteira (do vend2).
    const { carregarThread } = await import("@/server/whatsapp/consultas");
    expect((await carregarThread(sessao(vend), a.id))?.lead).toBeNull();
    expect((await carregarThread(sessao(vend2), a.id))?.lead?.id).toBe(alheio.id);
  });

  it("04 professor só vê pedagógico aberto de turma atual", async () => {
    const c = await turma();
    expect(await atendimentoVisivel(sessao(c.prof), c.pedagogico.id)).not.toBeNull();
    expect(await atendimentoVisivel(sessao(c.prof), c.financeiro.id)).toBeNull();
    await prisma.turma.update({ where: { id: c.t.id }, data: { professorId: c.outro.id } });
    await prisma.vinculoDocente.updateMany({ data: { fim: new Date(Date.now() - 500) } });
    expect(await atendimentoVisivel(sessao(c.prof), c.pedagogico.id)).toBeNull();
    expect(await atendimentoVisivel(sessao(c.outro), c.pedagogico.id)).toBeNull();
  });

  it("05 pedagógico esconde telefone, número e perfil, e não permite editar nome nem vincular", async () => {
    const c = await turma();
    await prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { nomePerfil: "Perfil Privado" } });
    const lista = JSON.stringify(await listarAtendimentosPagina(sessao(c.prof), {}, null));
    expect(lista).toContain(c.pedagogico.id);
    for (const segredo of [c.aluno.telefoneE164!, c.aluno.email!, "Perfil Privado", "+5511999990000", "Cobrança (teste)"]) expect(lista).not.toContain(segredo);
    como(c.prof);
    expect((await editarNomeContatoWhatsApp({ contatoId: c.contato.id, nome: "Novo nome", atendimentoId: c.pedagogico.id } as never)).ok).toBe(false);
    expect((await vincularContatoWhatsApp({ contatoId: c.contato.id, alvo: { tipo: "aluno", id: c.aluno.id }, atendimentoId: c.pedagogico.id } as never)).ok).toBe(false);
  });

  it("06 responsável legal fora do comercial", async () => {
    const numero = await criarNumeroSetor({ telefoneE164: "+5511999990003", setores: ["COMERCIAL", "SECRETARIA"], donoId: vend.id });
    const resp = await prisma.responsavel.create({ data: { nome: "Mãe Zenaide", telefoneE164: "+50688880077" } });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: resp.telefoneE164!, responsavelId: resp.id } });
    const comercialA = await abrir(numero.id, contato.id, { responsavelId: vend.id });
    const secretariaA = await abrir(numero.id, contato.id, { finalidade: "SECRETARIA", responsavelId: sec.id });
    const doVendedor = await listarAtendimentosPagina(sessao(vend), {}, null);
    expect(doVendedor.itens.map((i) => i.id)).toContain(comercialA.id);
    expect(JSON.stringify(doVendedor)).not.toContain("Zenaide");
    expect((await listarAtendimentosPagina(sessao(vend), { busca: "Zenaide" }, null)).itens).toHaveLength(0);
    const daSecretaria = await listarAtendimentosPagina(sessao(sec), {}, null);
    expect(daSecretaria.itens.find((i) => i.id === secretariaA.id)?.contatoNome).toBe("Mãe Zenaide");
  });

  it("07 telefone só no servidor: o cliente manda ids e o destino vem do cadastro", async () => {
    const c = await turma();
    como(fin);
    const aberta = await abrirAtendimentoInstitucional({ numeroId: c.numero.id, destinoChave: `FINANCEIRO:${c.matricula.id}`, telefone: "+5599000000000" } as never);
    expect(aberta.ok).toBe(true);
    expect(await prisma.contatoWhatsApp.count({ where: { telefoneE164: "+5599000000000" } })).toBe(0);
    const r = await enviarTextoInbox({ conversaId: c.financeiro.id, texto: "Boleto disponível", telefone: "+5599000000000" } as never);
    expect(r.ok).toBe(true);
    const i = await prisma.intencaoMensagem.findFirstOrThrow({ where: { atendimentoId: c.financeiro.id } });
    expect(i.contatoId).toBe(c.contato.id);
    expect(JSON.stringify(i)).not.toContain("+5599000000000");
  });

  it("08 destinatário atual antes do envio", async () => {
    const c = await turma();
    como(fin);
    const a = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.financeiro.id }, include: { conversa: { include: { contato: true } } } });
    expect(await destinatarioAtualDoAtendimento(comContatoIndividual(a))).toBe(true);
    await prisma.aluno.update({ where: { id: c.aluno.id }, data: { telefoneE164: "+50688880777" } });
    expect(await destinatarioAtualDoAtendimento(comContatoIndividual(a))).toBe(false);
    expect((await enviarTextoInbox({ conversaId: c.financeiro.id, texto: "Não deve ir ao número antigo" })).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it("09 FINANCEIRO por matrícula; contexto FIN e PEDAG imutável na transferência", async () => {
    const { a } = await comercial();
    como(vend);
    // Sem matrícula escolhida não há atendimento financeiro, e a origem não é encerrada.
    const semMatricula = await transferirAtendimento({ atendimentoId: a.id, destino: "FINANCEIRO", destinoChave: null, contexto: "Cliente pediu segunda via" });
    expect(semMatricula.ok).toBe(false);
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } })).encerradoEm).toBeNull();
    // O contexto de um atendimento FIN ou PEDAG nunca muda.
    const c = await turma();
    await expect(prisma.atendimentoWhatsApp.update({ where: { id: c.financeiro.id }, data: { finalidade: "SECRETARIA" } })).rejects.toThrow();
    await expect(prisma.atendimentoWhatsApp.update({ where: { id: c.financeiro.id }, data: { matriculaId: null } })).rejects.toThrow();
    await expect(prisma.atendimentoWhatsApp.update({ where: { id: c.pedagogico.id }, data: { turmaId: null } })).rejects.toThrow();
  });

  it("10 opt-out bloqueia envio, agendamento e encaminhamento; remoção só do ADM com evidência", async () => {
    const { numero, contato, a } = await comercial();
    const outro = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880002" } });
    const origem = await abrir(numero.id, outro.id, { responsavelId: vend.id });
    const m = await prisma.mensagemWhatsApp.create({ data: { numeroId: numero.id, conversaId: origem.conversaId, atendimentoId: origem.id, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "Olá" } });
    como(vend);
    expect((await registrarOptOutContato(contato.id)).ok).toBe(true);
    expect((await enviarTextoInbox({ conversaId: a.id, texto: "oi" })).ok).toBe(false);
    expect((await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "depois", quando: naJanela() })).ok).toBe(false);
    expect((await encaminharMensagem({ mensagemId: m.id, destinoAtendimentoIds: [a.id] })).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    // Pendente que já estava na fila também não sai.
    await prisma.contatoWhatsApp.update({ where: { id: contato.id }, data: { optOutEm: null } });
    await prisma.intencaoMensagem.create({ data: { numeroId: numero.id, contatoId: contato.id, atendimentoId: a.id, origem: "HUMANO", autorId: vend.id, corpoRenderizado: "na fila" } });
    await prisma.contatoWhatsApp.update({ where: { id: contato.id }, data: { optOutEm: new Date() } });
    await despacharFila();
    expect(enviarMock).not.toHaveBeenCalled();
    // Remoção: vendedor não, administrador só com evidência de 12+ caracteres.
    expect((await removerOptOutContato(contato.id, "Autorização por telefone registrada")).ok).toBe(false);
    como(adm);
    expect((await removerOptOutContato(contato.id, "curta")).ok).toBe(false);
    expect((await removerOptOutContato(contato.id, "Autorização por telefone registrada")).ok).toBe(true);
    expect((await eventosDo("ContatoWhatsApp", contato.id)).map((e) => e.tipo)).toContain("OptOutRemovido");
  });

  it("11 envio = intenção HUMANO + despachante único", async () => {
    const { numero, a } = await comercial();
    await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { driver: "MOTOR" } }); // o despachante só envia pelo motor (Fase 4B)
    como(vend);
    const r = await enviarTextoInbox({ conversaId: a.id, texto: "Olá! Podemos falar?" });
    expect(r.ok && r.dado!.status).toBe("DESPACHADA");
    const i = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(i).toMatchObject({ origem: "HUMANO", autorId: vend.id, atendimentoId: a.id, cobrancaId: null });
    expect(enviarMock).toHaveBeenCalledOnce();
    // O kill switch congela a automação, nunca o humano.
    const { politica } = await seedCanal({ estado: "ATIVA", janela: [0, 24] });
    await prisma.politicaRegua.update({ where: { id: politica.id }, data: { killSwitch: true } });
    expect((await enviarTextoInbox({ conversaId: a.id, texto: "Resposta humana com kill switch" })).ok).toBe(true);
  });

  it("12 silêncio pós-inbound e tratar, com alçada FIN ou SEC", async () => {
    const c = await turma();
    await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { driver: "MOTOR" } }); // a automação só sai pelo motor (Fase 4B, D38)
    await prisma.conversaWhatsApp.update({ where: { id: c.financeiro.conversaId }, data: { ultimoInboundEm: new Date(Date.now() - 3600_000) } });
    await prisma.intencaoMensagem.create({ data: { numeroId: c.numero.id, contatoId: c.contato.id, atendimentoId: c.financeiro.id, origem: "CRON", corpoRenderizado: "degrau" } });
    expect((await despacharFila()).adiadas).toBe(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).motivoFalha).toBe("silencio_pos_inbound");
    como(vend);
    expect((await marcarConversaTratada({ conversaId: c.financeiro.id, motivo: "retomar_regua" })).ok).toBe(false);
    como(fin);
    expect((await marcarConversaTratada({ conversaId: c.financeiro.id, motivo: "retomar_regua" })).ok).toBe(true);
    expect((await eventosDo("ContatoWhatsApp", c.contato.id)).map((e) => e.tipo)).toContain("ReguaRetomada");
  });

  it("13 conversa viva cancela automação (não em grupo)", async () => {
    const { numero } = await seedCanal({ driver: DriverWhatsApp.BAILEYS, estado: "ATIVA", janela: [0, 24] });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777" } });
    const cron = await prisma.intencaoMensagem.create({ data: { numeroId: numero.id, contatoId: contato.id, origem: "CRON", corpoRenderizado: "lembrete", criadaEm: new Date(Date.now() - 60_000) } });
    // Mensagem de grupo do mesmo telefone não conta como conversa viva.
    await prisma.$transaction((tx) => gravarMensagemGrupo(tx, { numeroId: numero.id, grupoJid: "120363000000000001@g.us", nomeGrupo: "Turma A",
      participanteJid: "50688887777@s.whatsapp.net", participanteE164: "+50688887777", participanteNome: null, providerMessageId: "g-1", tipo: "TEXTO", corpo: "Bom dia", quando: new Date(), driver: DriverWhatsApp.BAILEYS }));
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: cron.id } })).status).toBe("PENDENTE");
    await processarMensagemNormalizada({ numeroProviderRef: numero.providerRef, contatoWaId: "50688887777", providerMessageId: "R13-1", corpo: "Oi, tudo bem?", tipo: "TEXTO", driver: DriverWhatsApp.BAILEYS, fromMe: false, quando: new Date() });
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: cron.id } })).toMatchObject({ status: "CANCELADA", motivoFalha: "conversa_viva" });
  });

  it("14 contato único por telefone; vincular exige o mesmo telefone e nunca sobrescreve", async () => {
    const c = await turma();
    const [x, y] = await prisma.$transaction(async (tx) => [await garantirContato(tx, { telefoneE164: "+50699990000" }), await garantirContato(tx, { telefoneE164: "+50699990000" })]);
    expect(x.id).toBe(y.id);
    expect(await prisma.contatoWhatsApp.count({ where: { telefoneE164: "+50699990000" } })).toBe(1);
    await expect(prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50699990000" } })).rejects.toThrow();
    // Vínculo de lead: telefone diferente é recusado e o vínculo existente não é trocado.
    const { numero } = await comercial("+50688880009");
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880010" } });
    const a = await abrir(numero.id, contato.id, { responsavelId: vend.id });
    const alvo = await prisma.oportunidade.create({ data: { nome: "Outro telefone", telefoneE164: "+50688880099", vendedorDonoId: vend.id } });
    como(vend);
    expect((await vincularContatoWhatsApp({ contatoId: contato.id, alvo: { tipo: "lead", id: alvo.id }, atendimentoId: a.id })).ok).toBe(false);
    const igual = await prisma.oportunidade.create({ data: { nome: "Mesmo telefone", telefoneE164: "+50688880010", vendedorDonoId: vend.id } });
    expect((await vincularContatoWhatsApp({ contatoId: contato.id, alvo: { tipo: "lead", id: igual.id }, atendimentoId: a.id })).ok).toBe(true);
    const outroIgual = await prisma.oportunidade.create({ data: { nome: "Duplicado", telefoneE164: "+50688880010", vendedorDonoId: vend.id } });
    expect((await vincularContatoWhatsApp({ contatoId: contato.id, alvo: { tipo: "lead", id: outroIgual.id }, atendimentoId: a.id })).ok).toBe(false);
    expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: contato.id } })).leadId).toBe(igual.id);
    expect(c.contato.id).toBeTruthy();
  });

  it("15 ambíguo vai para a triagem do número", async () => {
    const recepcao = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Recepção");
    const numero = await criarNumeroSetor({ telefoneE164: "+5511900000101", setores: ["COMERCIAL", "SECRETARIA"], finalidade: "COBRANCA", triagemResponsavelId: recepcao.id });
    await processarMensagemNormalizada({ numeroProviderRef: numero.providerRef, contatoWaId: "50688889999", providerMessageId: "R15-1", corpo: "Quero informações", tipo: "TEXTO", driver: DriverWhatsApp.MOTOR, fromMe: false, quando: new Date() });
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    expect(m.atendimentoId).toBeNull();
    como(recepcao);
    expect((await listarTriagemWhatsApp()).map((t) => t.id)).toEqual([m.id]);
    como(vend);
    await expect(listarTriagemWhatsApp()).rejects.toThrow();
    // A classificação é auditada.
    const contato = await prisma.contatoWhatsApp.findFirstOrThrow();
    const a = await abrir(numero.id, contato.id, { finalidade: "SECRETARIA" });
    como(recepcao);
    expect((await classificarMensagemWhatsApp({ mensagemId: m.id, atendimentoId: a.id, motivo: "Pedido de informação geral" })).ok).toBe(true);
    expect((await eventosDo("AtendimentoWhatsApp", a.id)).map((e) => e.tipo)).toContain("MensagemClassificada");
  });

  it("16 revisão de envio incerto só com decisão e evidência", async () => {
    const { numero, contato, a } = await comercial();
    const i = await prisma.intencaoMensagem.create({ data: { numeroId: numero.id, contatoId: contato.id, atendimentoId: a.id, origem: "HUMANO", autorId: vend.id,
      corpoRenderizado: "talvez enviada", status: "FALHOU", motivoFalha: "resultado_incerto" } });
    como(vend);
    expect((await revisarFalhaEnvio({ id: i.id, decisao: "CANCELAR", evidencia: "Conferido no provedor" })).ok).toBe(false);
    como(adm);
    expect((await revisarFalhaEnvio({ id: i.id, decisao: "CANCELAR", evidencia: "curta" })).ok).toBe(false);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("FALHOU");
    expect((await revisarFalhaEnvio({ id: i.id, decisao: "CANCELAR", evidencia: "Conferido no provedor: não enviada" })).ok).toBe(true);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("CANCELADA");
    expect((await eventosDo("AtendimentoWhatsApp", a.id)).map((e) => e.tipo)).toContain("FalhaWhatsAppRevisada");
    expect((await revisarFalhaEnvio({ id: i.id, decisao: "CANCELAR", evidencia: "Conferido no provedor: não enviada" })).ok).toBe(false);
  });

  it("17 encerramento por alçada cancela a fila", async () => {
    const { numero, contato, a } = await comercial();
    const i = await prisma.intencaoMensagem.create({ data: { numeroId: numero.id, contatoId: contato.id, atendimentoId: a.id, origem: "HUMANO", autorId: vend.id, corpoRenderizado: "oi" } });
    como(fin);
    expect((await encerrarAtendimentoWhatsApp(a.id)).ok).toBe(false);
    como(gerente);
    expect((await encerrarAtendimentoWhatsApp(a.id)).ok).toBe(true);
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).toMatchObject({ status: "CANCELADA", motivoFalha: "atendimento_encerrado" });
    expect((await eventosDo("AtendimentoWhatsApp", a.id)).map((e) => e.tipo)).toContain("AtendimentoEncerrado");
  });

  // Lacuna: o brief pede também "upload no visível", mas não existe upload por atendimento (upload/route.ts é por lead/matrícula).
  it("18 mídia: envio só de arquivo do próprio autor e download no escopo", async () => {
    const { numero, a } = await comercial();
    como(vend);
    expect((await enviarMidiaInbox({ conversaId: a.id, url: "/api/files/999-comprovante.jpg" })).ok).toBe(false);
    expect((await enviarMidiaInbox({ conversaId: a.id, url: `/api/files/whatsapp-out/${vend2.id}/foto.jpg` })).ok).toBe(false);
    expect((await enviarMidiaInbox({ conversaId: a.id, url: `/api/files/whatsapp-out/${vend.id}/../${vend2.id}/foto.jpg` })).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect((await enviarMidiaInbox({ conversaId: a.id, url: `/api/files/whatsapp-out/${vend.id}/foto.jpg` })).ok).toBe(true);
    // Download: a mídia recebida só é lida por quem enxerga o atendimento.
    await prisma.mensagemWhatsApp.create({ data: { numeroId: numero.id, conversaId: a.conversaId, atendimentoId: a.id, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, tipo: "IMAGEM", midiaPath: "/api/files/whatsapp/entrada-18.jpg" } });
    expect(await podeLerArquivo({ id: vend.id, papeis: vend.papeis }, ["whatsapp", "entrada-18.jpg"])).toBe(true);
    expect(await podeLerArquivo({ id: fin.id, papeis: fin.papeis }, ["whatsapp", "entrada-18.jpg"])).toBe(false);
    expect(await podeLerArquivo({ id: vend2.id, papeis: vend2.papeis }, ["whatsapp", "entrada-18.jpg"])).toBe(false);
  });

  it("19 não lida nunca fica inalcançável", async () => {
    const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990000", rotulo: "Sec", driver: DriverWhatsApp.BAILEYS, finalidade: "COBRANCA" } });
    const nova = async (tel: string, em: Date, naoLidas: number) => {
      const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: tel } });
      const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
      return prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: "SECRETARIA::", finalidade: "SECRETARIA", ultimaMensagemEm: em, naoLidas } });
    };
    const antiga = await nova("+50670000001", new Date("2020-01-01T00:00:00Z"), 2);
    for (let i = 0; i < 60; i++) await nova(`+5068000${String(i).padStart(4, "0")}`, new Date(Date.now() - i * 1000), 0);
    const primeira = await listarAtendimentosPagina(sessao(adm), {}, null);
    expect(primeira.itens.map((i) => i.id)).not.toContain(antiga.id);
    const filtrada = await listarAtendimentosPagina(sessao(adm), { naoLidas: true }, null);
    expect(filtrada.itens.map((i) => i.id)).toEqual([antiga.id]);
  });

  it("20 nota interna nunca vira mensagem", async () => {
    const { a } = await comercial();
    como(vend);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Cliente ligou" })).ok).toBe(true);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
    expect(enviarMock).not.toHaveBeenCalled();
    expect(await prisma.evento.count({ where: { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id } })).toBe(1);
  });

  it("21 Evento em cada ação nova", async () => {
    const { numero, contato, a } = await comercial();
    const destinoMsg = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880055" } });
    const b = await abrir(numero.id, destinoMsg.id, { responsavelId: vend.id });
    const m = await prisma.mensagemWhatsApp.create({ data: { numeroId: numero.id, conversaId: a.conversaId, atendimentoId: a.id, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "Olá" } });
    // Fila do setor SECRETARIA: assumir, devolver, atribuir.
    const filaSec = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880066" } });
    const s = await abrir(numero.id, filaSec.id, { finalidade: "SECRETARIA" });
    como(sec); expect((await assumirAtendimento(s.id)).ok).toBe(true);
    expect((await devolverParaFila(s.id)).ok).toBe(true);
    como(adm); expect((await atribuirAtendimento({ atendimentoId: s.id, usuarioId: sec.id })).ok).toBe(true);
    // Vendedor: nota, convite/revogação, agendar/cancelar, encaminhar, transferir.
    como(vend);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Anotação" })).ok).toBe(true);
    const conv = await convidarParticipante({ atendimentoId: a.id, usuarioId: fin.id, podeEnviar: false, fim: emDias(2), motivo: "Dúvida sobre boleto" });
    expect(conv.ok).toBe(true);
    if (conv.ok) expect((await revogarParticipante(conv.dado!.participanteId)).ok).toBe(true);
    const ag = await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "Lembrete", quando: naJanela() });
    expect(ag.ok).toBe(true);
    if (ag.ok) expect((await cancelarAgendamentoDoAtendimento({ atendimentoId: a.id, intencaoId: ag.dado!.id })).ok).toBe(true);
    expect((await encaminharMensagem({ mensagemId: m.id, destinoAtendimentoIds: [b.id] })).ok).toBe(true);
    expect((await transferirAtendimento({ atendimentoId: a.id, destino: "SECRETARIA", destinoChave: null, contexto: "Pediu histórico escolar" })).ok).toBe(true);
    const tiposGravados = (await prisma.evento.findMany({ select: { tipo: true } })).map((e) => e.tipo);
    for (const t of ["AtendimentoAssumido", "AtendimentoAtribuido", "AtendimentoDevolvido", "AtendimentoTransferido", "AtendimentoEncerrado", "ParticipanteConvidado", "ParticipanteRevogado", "NotaInterna", "MensagemAgendada", "MensagemAgendadaCancelada", "MensagemEncaminhada"])
      expect(tiposGravados, t).toContain(t);
    expect(contato.id).toBeTruthy();
  });
});
