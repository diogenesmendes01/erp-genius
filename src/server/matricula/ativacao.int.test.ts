import { describe, it, expect, beforeAll, vi } from "vitest";
import { Papel, StatusCobranca, StatusComissao, StatusMatricula, EtapaLead, TipoCobranca } from "@prisma/client";

// Prioridade 3 do docs/14 (integração): ATIVAÇÃO da matrícula — o fluxo que "distorce
// receita se errar": cronograma gerado, comissão aprovada, lead Matriculado, eventos
// gravados; e a ATOMICIDADE do fluxo criar+ativar (falha no meio → nada persiste).
// Sessão mockada devolve só o id — papéis vêm do banco de teste (papéis frescos).

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { criarEAtivarMatricula, criarMatricula, concluirMatricula } from "./acoes";
import { registrarPagamento } from "@/server/financeiro/acoes";
import { assumirMatricula, confirmarContratoMatricula } from "@/server/secretaria/acoes";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo, eventosDo } from "@/test/integracao";

let admin: Awaited<ReturnType<typeof criarUsuario>>;
let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

const TAXA = 20000;
const MENSALIDADE = 85000;
const COMISSAO_PCT = 10;
const MESES_PLANO = 3;

function inputMatricula(leadId: string | undefined, cat: typeof catalogo) {
  return {
    leadId,
    alunoPrimeiroNome: "Maria",
    alunoSobrenome: "Rojas",
    // Obrigatórios desde a resolução do schema (pós-40ea4ff) — este teste nunca tinha
    // rodado porque a suíte não parseava com os conflict markers.
    alunoGenero: "NAO_INFORMADO" as const,
    alunoNascimento: "1990-05-10",
    alunoPaisId: cat.pais.id,
    alunoTipoDocumentoId: cat.pais.tiposDocumento[0].id,
    alunoDocumento: "1-2345-6789",
    alunoNacionalidade: "CR",
    alunoEmail: "maria@teste.cr",
    alunoTelefone: "88887777",
    alunoWhatsapp: true,
    alunoAceitaComunicacoes: true,
    alunoPaisResidencia: "CR",
    pagador: "ALUNO" as const,
    produtoId: cat.produto.id,
    taxaValor: TAXA,
    mensalidadeValor: MENSALIDADE,
    diaVencimento: 5,
    cobertura: { referencia: "MES_CIVIL" as const, inicio: "2026-06-01" }, primeiroVencimento: "2026-06-05",
    mesesPlano: MESES_PLANO,
  };
}

beforeAll(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  catalogo = await seedCatalogoMinimo();
  await prisma.politicaComissao.create({ data: { paisId: catalogo.pais.id, produtoId: catalogo.produto.id, versao: 1, tipo: "PERCENTUAL", percentual: COMISSAO_PCT, moeda: "CRC", vigenteEm: new Date("2020-01-01"), criadaPorId: admin.id } });
});

describe("ativação com contrato aceito — decisão de 08/09/2026", () => {
  it("recusa criação sem cobertura ou vencimento antes de persistir aluno e cobranças", async () => {
    authMock.mockResolvedValue({ user: { id: admin.id } });
    const antes = { alunos: await prisma.aluno.count(), cobrancas: await prisma.cobranca.count(), matriculas: await prisma.matricula.count() };
    for (const campo of ["cobertura", "primeiroVencimento"]) {
      const input = { ...inputMatricula(undefined, catalogo), [campo]: undefined } as unknown as Parameters<typeof criarMatricula>[0];
      expect((await criarMatricula(input)).ok).toBe(false);
    }
    expect({ alunos: await prisma.aluno.count(), cobrancas: await prisma.cobranca.count(), matriculas: await prisma.matricula.count() }).toEqual(antes);
  });
  it("criação com turma grava a matrícula exata na alocação", async () => {
    authMock.mockResolvedValue({ user: { id: admin.id } });
    const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "VINCULO-A1", ordem: 1 } });
    const turma = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: catalogo.modalidade.id, status: "ABERTA", capacidade: 10 } });
    const resultado = await criarMatricula({ ...inputMatricula(undefined, catalogo), turmaId: turma.id });
    expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
    if (!resultado.ok) throw new Error(resultado.erro);
    const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: resultado.dado!.id }, include: { alocacoes: true } });
    expect(matricula.alocacoes).toHaveLength(1);
    expect(matricula.alocacoes[0]).toMatchObject({ matriculaId: matricula.id, alunoId: matricula.alunoId, turmaId: turma.id });
  });

  it("contrato aceito e taxa confirmada geram cronograma, comissão e lead matriculado", async () => {
    const lead = await prisma.lead.create({
      data: { nome: "Lead Maria", vendedorDonoId: vendedor.id, etapa: EtapaLead.AGUARDANDO_MATRICULA },
    });

    authMock.mockResolvedValue({ user: { id: admin.id } });
    const r = await criarMatricula({ ...inputMatricula(lead.id, catalogo), diaVencimento: 31, primeiroVencimento: "2028-02-29", cobertura: { referencia: "CICLO_MATRICULA", inicio: "2028-01-31" } });
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    const matriculaId = r.ok ? r.dado!.id : "";
    const documento = await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: "Contrato aceito", url: "/api/files/contrato-aceito.pdf" } });
    await prisma.registroUpload.create({ data: { url: documento.url, nome: documento.nome, mime: "application/pdf", tamanho: 30, autorId: admin.id } });
    expect((await assumirMatricula(matriculaId)).ok).toBe(true);
    const primeiraAntes = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId, tipo: "MENSALIDADE" } });
    const aceite = await confirmarContratoMatricula(matriculaId, documento.id, [{ id: primeiraAntes.id, versao: primeiraAntes.versao }]);
    expect(aceite.ok, aceite.ok ? undefined : aceite.erro).toBe(true);
    const taxa = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId, tipo: "MATRICULA" } });
    expect((await registrarPagamento(taxa.id, { chaveIdempotencia: "ativacao-integracao-taxa", valorRecebido: TAXA, forma: "DINHEIRO", dataPagamento: "2026-06-01" })).ok).toBe(true);
    await prisma.cobranca.update({ where: { id: primeiraAntes.id }, data: { valorNegociado: MENSALIDADE + 1, versao: { increment: 1 } } });
    expect(await concluirMatricula(matriculaId)).toMatchObject({ ok: false, erro: expect.stringContaining("diferem do aceite") });
    expect(await prisma.cobranca.count({ where: { matriculaId, tipo: "MENSALIDADE" } })).toBe(1);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("AGUARDANDO");
    // Desfaz apenas a alteração artificial do teste; o aceite original continua preservado.
    await prisma.cobranca.update({ where: { id: primeiraAntes.id }, data: { valorNegociado: MENSALIDADE, versao: { increment: 1 } } });
    expect((await concluirMatricula(matriculaId)).ok).toBe(true);

    // A configuração padrão exige contrato aceito + taxa; a primeira permanece aberta.
    const matricula = await prisma.matricula.findUniqueOrThrow({
      where: { id: matriculaId },
      include: { cobrancas: true, comissoes: true },
    });
    expect(matricula.status).toBe(StatusMatricula.ATIVA);
    expect(matricula.ativadaEm).not.toBeNull();
    expect(matricula.pagamentoTaxaOk).toBe(true);
    expect(matricula.contratoDocumentoId).toBe(documento.id);

    // Cronograma: 1 taxa PAGA + MESES_PLANO mensalidades PENDENTES (1ª + meses 2..N).
    const taxas = matricula.cobrancas.filter((c) => c.tipo === TipoCobranca.MATRICULA);
    const mensalidades = matricula.cobrancas.filter((c) => c.tipo === TipoCobranca.MENSALIDADE);
    expect(taxas).toHaveLength(1);
    expect(taxas[0].status).toBe(StatusCobranca.PAGO);
    expect(Number(taxas[0].valorRecebido)).toBe(TAXA);
    expect(mensalidades).toHaveLength(MESES_PLANO);
    expect(matricula.diaVencimento).toBe(31);
    expect(mensalidades.map((m) => m.competencia).sort()).toEqual(["2028-02", "2028-03", "2028-04"]);
    for (const mensalidade of mensalidades) {
      const v = mensalidade.vencimento;
      expect(v.getDate()).toBe(new Date(v.getFullYear(), v.getMonth() + 1, 0).getDate());
      expect(mensalidade.competencia).toBe(`${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}`);
    }
    expect(mensalidades.map((m) => [m.coberturaInicio?.toISOString().slice(0, 10), m.coberturaFim?.toISOString().slice(0, 10)]).sort()).toEqual([
      ["2028-01-31", "2028-02-28"], ["2028-02-29", "2028-03-30"], ["2028-03-31", "2028-04-29"],
    ]);
    expect(mensalidades.every((m) => m.status === StatusCobranca.PENDENTE)).toBe(true);
    // Dinheiro exato no banco (Decimal): valor negociado volta idêntico.
    expect(mensalidades.every((m) => Number(m.valorNegociado) === MENSALIDADE)).toBe(true);

    // Comissão do DONO DO LEAD, aprovada na ativação, valor = % da taxa (doc 10 §3).
    expect(matricula.comissoes).toHaveLength(1);
    expect(matricula.comissoes[0].vendedorId).toBe(vendedor.id);
    expect(matricula.comissoes[0].status).toBe(StatusComissao.APROVADA);
    expect(Number(matricula.comissoes[0].valor)).toBe((TAXA * COMISSAO_PCT) / 100);

    // Lead avançou para MATRICULADO (etapa terminal).
    const leadDepois = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(leadDepois.etapa).toBe(EtapaLead.MATRICULADO);

    // Auditoria: eventos da matrícula na MESMA transação.
    const tipos = (await eventosDo("Matricula", matriculaId)).map((e) => e.tipo);
    expect(tipos).toEqual(
      expect.arrayContaining(["MatriculaCriada", "ComissaoGerada", "MatriculaAtivada", "ComissaoAprovada"]),
    );
    // Pagamento da taxa gravado no agregado Cobranca.
    const evPagamento = await eventosDo("Cobranca", taxas[0].id);
    expect(evPagamento.map((e) => e.tipo)).toContain("PagamentoRegistrado");
  });

  it("API combinada sem contrato aceito desfaz tudo mesmo com valor suficiente", async () => {
    const alunosAntes = await prisma.aluno.count();
    const matriculasAntes = await prisma.matricula.count();

    authMock.mockResolvedValue({ user: { id: admin.id } });
    const r = await criarEAtivarMatricula({
      matricula: inputMatricula(undefined, catalogo),
      ativacao: { valorRecebido: TAXA, forma: "DINHEIRO", dataPagamento: "2026-06-01" },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/contrato/i);
    expect(await prisma.aluno.count()).toBe(alunosAntes); // rollback: aluno não persistiu
    expect(await prisma.matricula.count()).toBe(matriculasAntes);
  });

  it("papel sem ativação (vendedor puro) não executa o fluxo atômico", async () => {
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    const r = await criarEAtivarMatricula({
      matricula: inputMatricula(undefined, catalogo),
      ativacao: { valorRecebido: TAXA, forma: "DINHEIRO", dataPagamento: "2026-06-01" },
    });
    expect(r.ok).toBe(false);
  });
});
