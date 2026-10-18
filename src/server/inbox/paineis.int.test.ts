import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { carregarPainel } from "./paineis";

type U = Awaited<ReturnType<typeof criarUsuario>>;
const sess = (u: U) => ({ id: u.id, nome: u.nome, papeis: u.papeis }) as never;
let seq = 0;

beforeEach(async () => { await truncarBanco(); });
afterAll(() => prisma.$disconnect());

async function contato(extra: { alunoId?: string; responsavelId?: string; telefoneE164?: string } = {}) {
  seq += 1;
  return prisma.contatoWhatsApp.create({ data: { telefoneE164: `+5068${String(seq).padStart(7, "0")}`, nomeExibicao: `Contato ${seq}`, ...extra } });
}
async function numero(finalidade: "VENDAS" | "COBRANCA", donoId?: string) {
  seq += 1;
  return prisma.numeroWhatsApp.create({ data: { telefoneE164: `+55119${String(seq).padStart(8, "0")}`, rotulo: `N${seq}`, driver: "BAILEYS", finalidade, providerRef: `ref-${seq}`, donoId: donoId ?? null } });
}
async function atendimento(numeroId: string, contatoId: string, data: { finalidade: "COMERCIAL" | "FINANCEIRO" | "SECRETARIA" | "PEDAGOGICO" } & Record<string, unknown>) {
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId, contatoId } });
  return prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: `${data.finalidade}::${seq}`, ...data } as never });
}
async function participar(atendimentoId: string, u: U, concedente: U) {
  await prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId, usuarioId: u.id, concedenteId: concedente.id, inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 3_600_000), motivo: "teste" } });
}

describe("painel lateral por setor", () => {
  it("comercial: oportunidade só para quem vê pela carteira (regra 3, LC-L02)", async () => {
    const dono = await criarUsuario([Papel.VENDEDOR], "Dono do lead");
    const donoDaLinhaSemCarteira = await criarUsuario([Papel.VENDEDOR], "Dono da linha");
    const op = await prisma.oportunidade.create({ data: { nome: "Maria Silva", etapa: "PROPOSTA", vendedorDonoId: dono.id, valorPrevisto: 1500 } });
    const linha = await numero("VENDAS", donoDaLinhaSemCarteira.id);
    const a = await atendimento(linha.id, (await contato()).id, { finalidade: "COMERCIAL", leadId: op.id });
    expect(await carregarPainel(sess(dono), a.id)).toMatchObject({ setor: "COMERCIAL", oportunidade: { id: op.id, titulo: "Maria Silva", etapa: "PROPOSTA", valor: "1500.00" } });
    expect(await carregarPainel(sess(donoDaLinhaSemCarteira), a.id)).toMatchObject({ setor: "COMERCIAL", oportunidade: null, pessoaId: null });
  });

  it("responsável legal não aparece no comercial (regra 6)", async () => {
    const dono = await criarUsuario([Papel.VENDEDOR]);
    const comum = await prisma.pessoa.create({ data: { nome: "Lead comum" } });
    const legal = await prisma.pessoa.create({ data: { nome: "Mãe do aluno" } });
    await prisma.responsavel.create({ data: { nome: "Mãe do aluno", pessoaId: legal.id } });
    const linha = await numero("VENDAS", dono.id);
    const opA = await prisma.oportunidade.create({ data: { nome: "A", vendedorDonoId: dono.id, pessoaId: comum.id } });
    const opB = await prisma.oportunidade.create({ data: { nome: "B", vendedorDonoId: dono.id, pessoaId: legal.id } });
    const a = await atendimento(linha.id, (await contato()).id, { finalidade: "COMERCIAL", leadId: opA.id });
    const b = await atendimento(linha.id, (await contato()).id, { finalidade: "COMERCIAL", leadId: opB.id });
    expect(await carregarPainel(sess(dono), a.id)).toMatchObject({ pessoaId: comum.id });
    expect(await carregarPainel(sess(dono), b.id)).toMatchObject({ oportunidade: { id: opB.id }, pessoaId: null });
  });

  it("financeiro: cobranças só para FIN/SEC; fora do escopo é null", async () => {
    const canal = await seedCanal();
    const base = await seedCobranca({ vencimento: new Date("2026-10-10T12:00:00Z") });
    const ct = await contato({ alunoId: base.aluno.id });
    const fin = await criarUsuario([Papel.FINANCEIRO]);
    await prisma.pagadorPreparacaoMatricula.create({ data: {
      matriculaId: base.matricula.id, preparadorId: fin.id, versao: 1, tipo: "ALUNO", dados: { alunoId: base.aluno.id },
      motivo: "Pagador aluno identificado para o contrato", chaveIdempotencia: "pag-p32", entradaHash: "pag-p32" } });
    await prisma.contatoWhatsApp.update({ where: { id: ct.id }, data: { telefoneE164: base.aluno.telefoneE164! } });
    const aFin = await atendimento(canal.numero.id, ct.id, { finalidade: "FINANCEIRO", alunoId: base.aluno.id, matriculaId: base.matricula.id });
    const vendedorParticipante = await criarUsuario([Papel.VENDEDOR]);
    await participar(aFin.id, vendedorParticipante, fin);
    const painel = await carregarPainel(sess(fin), aFin.id);
    expect(painel).toMatchObject({ setor: "FINANCEIRO", matriculaCodigo: base.matricula.codigo });
    expect((painel as { cobrancas: { id: string }[] }).cobrancas.map((c) => c.id)).toEqual([base.cobranca.id]);
    expect(await carregarPainel(sess(vendedorParticipante), aFin.id)).toMatchObject({ setor: "FINANCEIRO", matriculaCodigo: null, cobrancas: [] });
    expect(await carregarPainel(sess(await criarUsuario([Papel.VENDEDOR])), aFin.id)).toBeNull();
  });

  it("secretaria: documentos pendentes da matrícula", async () => {
    const cat = await seedCatalogoMinimo();
    const sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA]);
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", paisId: cat.pais.id } });
    const m = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", codigo: "MAT-S" } });
    const n = await numero("COBRANCA");
    const a = await atendimento(n.id, (await contato()).id, { finalidade: "SECRETARIA", alunoId: aluno.id, matriculaId: m.id, responsavelId: sec.id });
    expect(await carregarPainel(sess(sec), a.id)).toEqual({ setor: "SECRETARIA", matriculaCodigo: "MAT-S", documentosPendentes: 2, aria: { pausada: false, motivo: null, sugestoes: [] }, acoes: expect.objectContaining({ podeVincular: true, cobranca: null }) });
    await prisma.documento.create({ data: { matriculaId: m.id, categoria: "CONTRATO", nome: "c", url: "u" } });
    await prisma.documento.create({ data: { matriculaId: m.id, categoria: "COMPROVANTE", nome: "x", url: "u", arquivado: true } });
    expect(await carregarPainel(sess(sec), a.id)).toMatchObject({ documentosPendentes: 1 });
    const vendedorConvidado = await criarUsuario([Papel.VENDEDOR]);
    await participar(a.id, vendedorConvidado, sec);
    expect(await carregarPainel(sess(vendedorConvidado), a.id)).toEqual({ setor: "SECRETARIA", matriculaCodigo: null, documentosPendentes: null, aria: { pausada: false, motivo: null, sugestoes: [] }, acoes: expect.objectContaining({ podeCriarLead: false, cobranca: null }) });
  });

  it("professor no pedagógico vê turma e frequência; sem telefone", async () => {
    const cat = await seedCatalogoMinimo();
    const prof = await criarUsuario([Papel.PROFESSOR]);
    const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A1", ordem: 1 } });
    const turma = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: cat.modalidade.id, professorId: prof.id, nome: "Turma Salvador" } });
    await prisma.vinculoDocente.create({ data: { turmaId: turma.id, professorId: prof.id, inicio: new Date(Date.now() - 60_000) } });
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno", paisId: cat.pais.id, telefoneE164: "+50680001111", whatsapp: true } });
    const m = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC" } });
    await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turma.id, matriculaId: m.id } });
    for (const [i, presente] of [true, true, true, false, null].entries()) {
      const aula = await prisma.aulaDiario.create({ data: { turmaId: turma.id, professorId: prof.id, ocorridaEm: new Date(Date.now() - (i + 1) * 86_400_000), conteudo: "x" } });
      await prisma.registroAulaAluno.create({ data: { aulaId: aula.id, alunoId: aluno.id, nomeAluno: "Aluno", presente, matriculaId: m.id } });
    }
    const n = await numero("VENDAS");
    const a = await atendimento(n.id, (await contato({ alunoId: aluno.id, telefoneE164: "+50680001111" })).id, { finalidade: "PEDAGOGICO", alunoId: aluno.id, matriculaId: m.id, turmaId: turma.id });
    const painel = await carregarPainel(sess(prof), a.id);
    expect(painel).toEqual({ setor: "PEDAGOGICO", turma: "Turma Salvador", frequenciaPct: 75,
      aria: { pausada: false, motivo: null, sugestoes: [] }, acoes: expect.objectContaining({ nomeSalvo: null, nomePerfil: null, podeCriarLead: false, podeVincular: false, podeEditarNome: false, cobranca: null }) });
    expect(JSON.stringify(painel)).not.toMatch(/\+\d{6,}/);
    const vendedorConvidado = await criarUsuario([Papel.VENDEDOR]);
    await participar(a.id, vendedorConvidado, prof);
    expect(await carregarPainel(sess(vendedorConvidado), a.id)).toEqual({ setor: "PEDAGOGICO", turma: null, frequenciaPct: null,
      aria: { pausada: false, motivo: null, sugestoes: [] }, acoes: expect.objectContaining({ podeVincular: false, podeEditarNome: false }) });
  });
  // C2 da R1 do #217 (decisão do dono): as ações do Inbox antigo voltam no painel, com as mesmas regras de carregarThread.
  describe("ações de cadastro e cobrança (as do Inbox antigo)", () => {
    it("linha comercial sem oportunidade: vendedor cria; com oportunidade visível, o id vem para o link do funil", async () => {
      const dono = await criarUsuario([Papel.VENDEDOR], "Dono");
      const linha = await numero("VENDAS", dono.id);
      const a = await atendimento(linha.id, (await contato()).id, { finalidade: "COMERCIAL" });
      const sem = await carregarPainel(sess(dono), a.id);
      expect(sem?.acoes).toMatchObject({ podeCriarLead: true, podeVincular: true, podeEditarNome: true, leadId: null, cobranca: null, fonteNome: "contato" });
      expect(JSON.stringify(sem)).not.toMatch(/\+\d{6,}/);
      const op = await prisma.oportunidade.create({ data: { nome: "Maria", vendedorDonoId: dono.id } });
      await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { leadId: op.id } });
      expect((await carregarPainel(sess(dono), a.id))?.acoes).toMatchObject({ podeCriarLead: false, leadId: op.id, contatoNome: "Maria", fonteNome: "lead" });
      await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { leadId: null, encerradoEm: new Date(), status: "ENCERRADO" } });
      expect((await carregarPainel(sess(dono), a.id))?.acoes?.podeCriarLead).toBe(false);
    });

    it("oportunidade de outra carteira não vai para o painel de quem só vê pela linha (LC-L02)", async () => {
      const dono = await criarUsuario([Papel.VENDEDOR]);
      const donoDaLinha = await criarUsuario([Papel.VENDEDOR]);
      const op = await prisma.oportunidade.create({ data: { nome: "Outra carteira", vendedorDonoId: dono.id } });
      const linha = await numero("VENDAS", donoDaLinha.id);
      const a = await atendimento(linha.id, (await contato()).id, { finalidade: "COMERCIAL", leadId: op.id });
      expect((await carregarPainel(sess(donoDaLinha), a.id))?.acoes).toMatchObject({ leadId: null, podeCriarLead: false });
    });

    it("financeiro: cobrança ativa e silêncio só para FIN/SEC; editar nome exige ver todos os atendimentos do contato", async () => {
      const canal = await seedCanal();
      const base = await seedCobranca({ vencimento: new Date("2026-10-10T12:00:00Z") });
      const ct = await contato({ alunoId: base.aluno.id });
      const fin = await criarUsuario([Papel.FINANCEIRO]);
      await prisma.pagadorPreparacaoMatricula.create({ data: {
        matriculaId: base.matricula.id, preparadorId: fin.id, versao: 1, tipo: "ALUNO", dados: { alunoId: base.aluno.id },
        motivo: "Pagador aluno identificado para o contrato", chaveIdempotencia: "pag-c2", entradaHash: "pag-c2" } });
      await prisma.contatoWhatsApp.update({ where: { id: ct.id }, data: { telefoneE164: base.aluno.telefoneE164! } });
      const aFin = await atendimento(canal.numero.id, ct.id, { finalidade: "FINANCEIRO", alunoId: base.aluno.id, matriculaId: base.matricula.id, ultimoInboundEm: new Date() });
      const acoes = (await carregarPainel(sess(fin), aFin.id))?.acoes;
      expect(acoes?.cobranca?.ativa?.id).toBe(base.cobranca.id);
      expect(acoes?.cobranca?.silencio.ativo).toBe(true);
      expect(acoes).toMatchObject({ podeVincular: false, podeEditarNome: true, alunoId: base.aluno.id });
      const vendedorParticipante = await criarUsuario([Papel.VENDEDOR]);
      await participar(aFin.id, vendedorParticipante, fin);
      expect((await carregarPainel(sess(vendedorParticipante), aFin.id))?.acoes).toMatchObject({ cobranca: null, podeVincular: true });
      expect((await carregarPainel(sess(vendedorParticipante), aFin.id))?.acoes?.podeEditarNome).toBe(true);
      // Com outro atendimento do contato fora do escopo do vendedor, ele não edita o nome salvo.
      const outroNumero = await numero("COBRANCA");
      await atendimento(outroNumero.id, ct.id, { finalidade: "SECRETARIA" });
      expect((await carregarPainel(sess(vendedorParticipante), aFin.id))?.acoes?.podeEditarNome).toBe(false);
    });
  });
});
