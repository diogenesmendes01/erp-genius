import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock, enviarMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
vi.mock("./drivers/evolution", () => ({ driverEvolution: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { garantirAtendimento } from "./atendimentos";
import { carregarThread } from "./consultas-inbox";
import { despacharFila } from "./despachante";
import { processarMensagemNormalizada } from "./inbound";
import { enviarTextoInbox } from "./acoes";
import { abrirAtendimentoInstitucional, classificarMensagemWhatsApp, listarOpcoesAtendimento } from "./operacoes-atendimento";

const sessao = (u: { id: string; nome: string; papeis: Papel[] }) => ({ id: u.id, nome: u.nome, papeis: u.papeis });
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

beforeEach(async () => {
  await truncarBanco();
  authMock.mockReset();
  enviarMock.mockReset().mockResolvedValue({ providerMessageId: "teste-sem-rede" });
  vi.stubEnv("WHATSAPP_LIVE", "1");
});
afterEach(() => vi.unstubAllEnvs());

async function contexto() {
  const catalogo = await seedCatalogoMinimo();
  const professor = await criarUsuario([Papel.PROFESSOR], "Docente atual");
  const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const [turmaA, turmaB] = await Promise.all([
    prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: catalogo.modalidade.id, professorId: professor.id } }),
    prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: catalogo.modalidade.id, professorId: professor.id } }),
  ]);
  await prisma.vinculoDocente.createMany({ data: [
    { turmaId: turmaA.id, professorId: professor.id, inicio: new Date(Date.now() - 60_000) },
    { turmaId: turmaB.id, professorId: professor.id, inicio: new Date(Date.now() - 60_000) },
  ] });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna", sobrenome: "Contrato", paisId: catalogo.pais.id, telefoneE164: "+50680001111" } });
  const [matriculaA, matriculaB] = await Promise.all([
    prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", codigo: "MAT-A" } }),
    prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", codigo: "MAT-B" } }),
  ]);
  await prisma.alocacaoTurma.createMany({ data: [
    { alunoId: aluno.id, turmaId: turmaA.id, matriculaId: matriculaA.id },
    { alunoId: aluno.id, turmaId: turmaB.id, matriculaId: matriculaB.id },
  ] });
  const responsavel = await prisma.responsavel.create({ data: { nome: "Responsável pedagógica", telefoneE164: "+50680002222" } });
  const pagador = await prisma.responsavel.create({ data: { nome: "Pagador sem direito acadêmico", telefoneE164: "+50680003333" } });
  await prisma.alunoResponsavel.createMany({ data: [
    { alunoId: aluno.id, responsavelId: responsavel.id, papel: "PEDAGOGICO" },
    { alunoId: aluno.id, responsavelId: pagador.id, papel: "FINANCEIRO" },
  ] });
  const autorizacaoA = await prisma.autorizacaoComunicacaoAcademica.create({ data: {
    matriculaId: matriculaA.id, responsavelId: responsavel.id, autorizadaPorId: secretaria.id, evidencia: "Autorização pedagógica do contrato A",
  } });
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999999999", rotulo: "Institucional", finalidade: "VENDAS", driver: "BAILEYS", providerRef: "PED-264" } });
  const contatoResponsavel = await prisma.contatoWhatsApp.create({ data: { telefoneE164: responsavel.telefoneE164!, responsavelId: responsavel.id, nomeExibicao: responsavel.nome } });
  return { professor, secretaria, admin, aluno, turmaA, turmaB, matriculaA, matriculaB, responsavel, pagador, autorizacaoA, numero, contatoResponsavel };
}

describe("Q145: atendimento pedagógico usa matrícula e autorização explícitas", () => {
  it("expõe o aluno direto e cada responsável autorizado por contrato, sem escolher o primeiro vínculo", async () => {
    const c = await contexto();
    entrar(c.professor.id);
    const opcoes = await listarOpcoesAtendimento();
    const guardianA = opcoes.destinos.find((d) => d.autorizacaoComunicacaoAcademicaId === c.autorizacaoA.id);
    expect(guardianA).toMatchObject({ finalidade: "PEDAGOGICO", matriculaId: c.matriculaA.id, turmaId: c.turmaA.id, disponivel: true });
    expect(guardianA?.nome).toContain("MAT-A");
    expect(JSON.stringify(opcoes)).not.toContain(c.responsavel.telefoneE164!);
    expect(JSON.stringify(opcoes)).not.toContain(c.pagador.nome);
    expect(opcoes.destinos.some((d) => d.chave.endsWith(`${c.matriculaA.id}:ALUNO`) && d.disponivel)).toBe(true);
    expect(opcoes.destinos.some((d) => d.chave.endsWith(`${c.matriculaB.id}:PENDENTE`) && d.disponivel === false)).toBe(true);

    const abriu = await abrirAtendimentoInstitucional({ numeroId: c.numero.id, destinoChave: guardianA!.chave });
    expect(abriu.ok).toBe(true);
    const atendimentoId = abriu.ok ? abriu.dado?.id : null;
    if (!atendimentoId) throw new Error(abriu.ok ? "Abertura sem identificador." : abriu.erro);
    const atendimento = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atendimentoId } });
    expect(atendimento.matriculaId).toBe(c.matriculaA.id);
    expect(atendimento.autorizacaoComunicacaoAcademicaId).toBe(c.autorizacaoA.id);
    expect(atendimento.contextoChave).toContain(c.autorizacaoA.id);

    const direto = opcoes.destinos.find((d) => d.chave.endsWith(`${c.matriculaA.id}:ALUNO`))!;
    const abriuDireto = await abrirAtendimentoInstitucional({ numeroId: c.numero.id, destinoChave: direto.chave });
    expect(abriuDireto.ok).toBe(true);
    const atendimentoDiretoId = abriuDireto.ok ? abriuDireto.dado?.id : null;
    if (!atendimentoDiretoId) throw new Error(abriuDireto.ok ? "Abertura direta sem identificador." : abriuDireto.erro);
    const atendimentoDireto = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atendimentoDiretoId }, include: { conversa: { include: { contato: true } } } });
    expect(atendimentoDireto.autorizacaoComunicacaoAcademicaId).toBeNull();
    expect(atendimentoDireto.conversa.contato.alunoId).toBe(c.aluno.id);

    const forjada = await abrirAtendimentoInstitucional({ numeroId: c.numero.id,
      destinoChave: `PEDAGOGICO:${c.aluno.id}:${c.turmaB.id}:${c.matriculaB.id}:AUT:${c.autorizacaoA.id}` });
    expect(forjada.ok).toBe(false);
  });

  it("bloqueia novo envio, inbound e classificação após revogação; uma nova autorização abre outro histórico", async () => {
    const c = await contexto();
    entrar(c.professor.id);
    const opcaoA = (await listarOpcoesAtendimento()).destinos.find((d) => d.autorizacaoComunicacaoAcademicaId === c.autorizacaoA.id)!;
    const abriu = await abrirAtendimentoInstitucional({ numeroId: c.numero.id, destinoChave: opcaoA.chave });
    expect(abriu.ok).toBe(true);
    const atendimentoAId = abriu.ok ? abriu.dado?.id : null;
    if (!atendimentoAId) throw new Error(abriu.ok ? "Abertura sem identificador." : abriu.erro);
    const atendimentoA = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atendimentoAId } });
    const pendente = await prisma.intencaoMensagem.create({ data: { numeroId: c.numero.id, contatoId: c.contatoResponsavel.id, atendimentoId: atendimentoA.id, origem: "HUMANO", autorId: c.professor.id, corpoRenderizado: "Mensagem preparada antes da revogação" } });
    await prisma.autorizacaoComunicacaoAcademica.update({ where: { id: c.autorizacaoA.id }, data: { revogadaEm: new Date(), revogadaPorId: c.secretaria.id, motivoRevogacao: "Responsável revogou o contato" } });

    expect((await enviarTextoInbox({ conversaId: atendimentoA.id, texto: "Novo envio após revogação" })).ok).toBe(false);
    await despacharFila();
    expect(enviarMock).not.toHaveBeenCalled();
    const pendenteCancelada = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: pendente.id } });
    expect(pendenteCancelada).toMatchObject({ status: "CANCELADA", motivoFalha: "atendimento_sem_acesso" });
    expect((await carregarThread(sessao(c.professor), atendimentoA.id))?.podeEnviar).toBe(false);

    await processarMensagemNormalizada({ numeroProviderRef: c.numero.providerRef, contatoWaId: c.responsavel.telefoneE164!.replace(/\D/g, ""), providerMessageId: "inbound-revogado", corpo: "Mensagem após revogação", tipo: "TEXTO", driver: "BAILEYS", fromMe: false, quando: new Date() });
    const inbound = await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { numeroId_providerMessageId: { numeroId: c.numero.id, providerMessageId: "inbound-revogado" } } });
    expect(inbound.atendimentoId).toBeNull();
    entrar(c.admin.id);
    expect((await classificarMensagemWhatsApp({ mensagemId: inbound.id, atendimentoId: atendimentoA.id, motivo: "Tentativa de classificar atendimento revogado" })).ok).toBe(false);

    const autorizacaoB = await prisma.autorizacaoComunicacaoAcademica.create({ data: { matriculaId: c.matriculaA.id, responsavelId: c.responsavel.id, autorizadaPorId: c.secretaria.id, evidencia: "Nova autorização após a revogação" } });
    entrar(c.professor.id);
    const opcaoB = (await listarOpcoesAtendimento()).destinos.find((d) => d.autorizacaoComunicacaoAcademicaId === autorizacaoB.id)!;
    const reabriu = await abrirAtendimentoInstitucional({ numeroId: c.numero.id, destinoChave: opcaoB.chave });
    expect(reabriu.ok).toBe(true);
    const atendimentoBId = reabriu.ok ? reabriu.dado?.id : null;
    if (!atendimentoBId) throw new Error(reabriu.ok ? "Reabertura sem identificador." : reabriu.erro);
    expect(atendimentoBId).not.toBe(atendimentoA.id);
    const atendimentoB = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atendimentoBId } });
    expect(atendimentoB.autorizacaoComunicacaoAcademicaId).toBe(autorizacaoB.id);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: pendente.id } })).status).toBe("CANCELADA");
  });

  it("impede SQL forjado, envelope cruzado e futura autorização em fuso não UTC; histórico terminal permanece auditável", async () => {
    const c = await contexto();
    const atendimento = await prisma.$transaction((tx) => garantirAtendimento(tx, {
      numeroId: c.numero.id, contatoId: c.contatoResponsavel.id, finalidade: "PEDAGOGICO", alunoId: c.aluno.id, turmaId: c.turmaA.id,
      matriculaId: c.matriculaA.id, autorizacaoComunicacaoAcademicaId: c.autorizacaoA.id,
    }));
    const contatoForjado = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50680004444", nomeExibicao: "Contato cruzado" } });
    await expect(prisma.intencaoMensagem.create({ data: { numeroId: c.numero.id, contatoId: contatoForjado.id, atendimentoId: atendimento.id, origem: "CRON", corpoRenderizado: "Envelope de outro contato" } })).rejects.toThrow("número e contato");

    const intencao = await prisma.intencaoMensagem.create({ data: { numeroId: c.numero.id, contatoId: c.contatoResponsavel.id, atendimentoId: atendimento.id, origem: "CRON", corpoRenderizado: "Histórico que pode receber resultado" } });
    await prisma.autorizacaoComunicacaoAcademica.update({ where: { id: c.autorizacaoA.id }, data: { revogadaEm: new Date(), revogadaPorId: c.secretaria.id, motivoRevogacao: "Revogada antes do claim" } });
    await expect(prisma.intencaoMensagem.update({ where: { id: intencao.id }, data: { atendimentoId: null } })).rejects.toThrow("não pode trocar atendimento ou envelope");
    await expect(prisma.intencaoMensagem.update({ where: { id: intencao.id }, data: { numeroId: "numero-inexistente" } })).rejects.toThrow("não pode trocar atendimento ou envelope");
    await expect(prisma.intencaoMensagem.update({ where: { id: intencao.id }, data: { status: "FALHOU", motivoFalha: "resultado_incerto_antes_da_revogacao" } })).resolves.toBeTruthy();

    const futura = await prisma.autorizacaoComunicacaoAcademica.create({ data: { matriculaId: c.matriculaB.id, responsavelId: c.responsavel.id, autorizadaPorId: c.secretaria.id, evidencia: "Autorização futura não aplicável", vigenteEm: new Date(Date.now() + 3_600_000) } });
    await expect(prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('TimeZone', 'America/Sao_Paulo', true)`;
      return garantirAtendimento(tx, { numeroId: c.numero.id, contatoId: c.contatoResponsavel.id, finalidade: "PEDAGOGICO", alunoId: c.aluno.id, turmaId: c.turmaB.id,
        matriculaId: c.matriculaB.id, autorizacaoComunicacaoAcademicaId: futura.id });
    })).rejects.toThrow("autorização vigente");
  });

  it("serializa a abertura contra a revogação e nunca cria envio no intervalo", async () => {
    const c = await contexto();
    let sinalizarAbertura!: () => void;
    let liberarAbertura!: () => void;
    const aberturaPronta = new Promise<void>((resolve) => { sinalizarAbertura = resolve; });
    const liberar = new Promise<void>((resolve) => { liberarAbertura = resolve; });
    const abertura = prisma.$transaction(async (tx) => {
      const atendimento = await garantirAtendimento(tx, {
        numeroId: c.numero.id, contatoId: c.contatoResponsavel.id, finalidade: "PEDAGOGICO", alunoId: c.aluno.id, turmaId: c.turmaA.id,
        matriculaId: c.matriculaA.id, autorizacaoComunicacaoAcademicaId: c.autorizacaoA.id,
      });
      sinalizarAbertura();
      await liberar;
      return atendimento.id;
    });
    await aberturaPronta;
    let revogacaoConcluida = false;
    const revogacao = prisma.autorizacaoComunicacaoAcademica.update({ where: { id: c.autorizacaoA.id }, data: {
      revogadaEm: new Date(), revogadaPorId: c.secretaria.id, motivoRevogacao: "Revogação concorrente à abertura",
    } }).then(() => { revogacaoConcluida = true; });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(revogacaoConcluida).toBe(false);
    liberarAbertura();
    const atendimentoId = await abertura;
    await revogacao;
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atendimentoId } })).autorizacaoComunicacaoAcademicaId).toBe(c.autorizacaoA.id);
    entrar(c.professor.id);
    expect((await enviarTextoInbox({ conversaId: atendimentoId, texto: "Envio após a revogação concorrente" })).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count({ where: { atendimentoId } })).toBe(0);
  });
});
