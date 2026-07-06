import { describe, it, expect, beforeAll, vi } from "vitest";
import { Papel, StatusCobranca, StatusComissao, StatusMatricula, EtapaLead, TipoCobranca } from "@prisma/client";

// Prioridade 3 do docs/14 (integração): ATIVAÇÃO da matrícula — o fluxo que "distorce
// receita se errar": cronograma gerado, comissão aprovada, lead Matriculado, eventos
// gravados; e a ATOMICIDADE do fluxo criar+ativar (falha no meio → nada persiste).
// Sessão mockada devolve só o id — papéis vêm do banco de teste (papéis frescos).

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { criarEAtivarMatricula } from "./acoes";
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
    comissaoPct: COMISSAO_PCT,
    diaVencimento: 5,
    mesesPlano: MESES_PLANO,
  };
}

beforeAll(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  catalogo = await seedCatalogoMinimo();
});

describe("criar + ativar matrícula (fluxo atômico)", () => {
  it("ativa com taxa quitada: cronograma, comissão aprovada, lead Matriculado, eventos", async () => {
    const lead = await prisma.lead.create({
      data: { nome: "Lead Maria", vendedorDonoId: vendedor.id, etapa: EtapaLead.AGUARDANDO_MATRICULA },
    });

    authMock.mockResolvedValue({ user: { id: admin.id } });
    const r = await criarEAtivarMatricula({
      matricula: inputMatricula(lead.id, catalogo),
      ativacao: { valorRecebido: TAXA, forma: "TRANSFERENCIA" },
    });
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    const matriculaId = r.ok ? r.dado!.id : "";

    // Matrícula ATIVA com o gatilho registrado (decisão P7 adaptada: lastro = taxa quitada).
    const matricula = await prisma.matricula.findUniqueOrThrow({
      where: { id: matriculaId },
      include: { cobrancas: true, comissoes: true },
    });
    expect(matricula.status).toBe(StatusMatricula.ATIVA);
    expect(matricula.ativadaEm).not.toBeNull();
    expect(matricula.pagamentoTaxaOk).toBe(true);

    // Cronograma: 1 taxa PAGA + MESES_PLANO mensalidades PENDENTES (1ª + meses 2..N).
    const taxas = matricula.cobrancas.filter((c) => c.tipo === TipoCobranca.MATRICULA);
    const mensalidades = matricula.cobrancas.filter((c) => c.tipo === TipoCobranca.MENSALIDADE);
    expect(taxas).toHaveLength(1);
    expect(taxas[0].status).toBe(StatusCobranca.PAGO);
    expect(Number(taxas[0].valorRecebido)).toBe(TAXA);
    expect(mensalidades).toHaveLength(MESES_PLANO);
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

  it("ATOMICIDADE: valor insuficiente para a taxa desfaz TUDO (nem aluno fica)", async () => {
    const alunosAntes = await prisma.aluno.count();
    const matriculasAntes = await prisma.matricula.count();

    authMock.mockResolvedValue({ user: { id: admin.id } });
    const r = await criarEAtivarMatricula({
      matricula: inputMatricula(undefined, catalogo),
      ativacao: { valorRecebido: TAXA - 1, forma: "TRANSFERENCIA" }, // não cobre a taxa
    });

    expect(r.ok).toBe(false);
    expect(await prisma.aluno.count()).toBe(alunosAntes); // rollback: aluno não persistiu
    expect(await prisma.matricula.count()).toBe(matriculasAntes);
  });

  it("papel sem ativação (vendedor puro) não executa o fluxo atômico", async () => {
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    const r = await criarEAtivarMatricula({
      matricula: inputMatricula(undefined, catalogo),
      ativacao: { valorRecebido: TAXA, forma: "TRANSFERENCIA" },
    });
    expect(r.ok).toBe(false);
  });
});
