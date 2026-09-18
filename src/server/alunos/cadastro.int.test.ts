import { receberTx } from "@/server/financeiro/recebimentos";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { exigirSessao } from "@/server/_shared/sessao";
import { editarAluno } from "./acoes";
import { listarAlunos, obterAluno } from "./consultas";

const como = (u: { id: string; papeis: Papel[] }) => authMock.mockResolvedValue({ user: { id: u.id, papeis: u.papeis } });

async function cenario(papeis: Papel[]) {
  const cat = await seedCatalogoMinimo();
  const operador = await criarUsuario(papeis, "Operador acadêmico");
  const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({ data: {
    modalidadeId: cat.modalidade.id, nivelId: nivel.id, status: "EM_ANDAMENTO", professorId: operador.id,
    vinculosDocentes: { create: { professorId: operador.id, inicio: new Date(Date.now() - 86_400_000) } },
  } });
  const aluno = await prisma.aluno.create({ data: {
    id: "cadastro-com-sequencias-84000-85000",
    primeiroNome: "Ana", sobrenome: "Santos", paisId: cat.pais.id, documento: "DOCUMENTO_PRIVADO",
    telefoneE164: "+50688887777", email: "contato-privado@example.test", rua: "ENDERECO_PRIVADO",
    observacoes: "OBSERVACAO_ADMINISTRATIVA_PRIVADA", nascimento: new Date("2000-01-01"),
    alocacoes: { create: { turmaId: turma.id } },
    matriculas: { create: {
      produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", status: "ATIVA",
      cobrancas: { create: {
        tipo: "MENSALIDADE", moeda: "CRC", valorOriginal: 85000, valorNegociado: 85000,
        saldo: 85000, vencimento: new Date(Date.now() + 7 * 86_400_000),
      } },
    } },
  } });
  const financeiro = await criarUsuario([Papel.FINANCEIRO]);
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matricula: { alunoId: aluno.id } } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: financeiro.id, valorRecebido: 1000, forma: "DINHEIRO", dataPagamento: new Date(), comentario: "Pagamento parcial da mensalidade do cenário cadastral", chaveIdempotencia: "parcial-cadastro" }));
  como(operador);
  const entrada = { primeiroNome: "Ana", sobrenome: "Corrigido", paisId: cat.pais.id, documento: "123456789", telefone: "88889999", motivo: "Correção solicitada pelo responsável" };
  return { cat, operador, aluno, entrada };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await truncarBanco();
});

describe("cadastro acadêmico persistido — capacidade e projeção por função", () => {
  it("Secretaria consulta cadastro e financeiro individual, edita e registra autoria", async () => {
    const c = await cenario([Papel.SECRETARIA_ACADEMICA]);
    const ficha = await obterAluno(c.aluno.id, await exigirSessao());
    expect(ficha?.aluno.documento).toBe("DOCUMENTO_PRIVADO");
    expect(ficha?.aluno.telefoneE164).toBe("+50688887777");
    expect(ficha?.financeiro?.emAberto).toEqual([{ moeda: "CRC", valor: 84000 }]);
    expect((await editarAluno(c.aluno.id, c.entrada)).ok).toBe(true);
    expect(await prisma.aluno.findUnique({ where: { id: c.aluno.id } })).toMatchObject({ sobrenome: "Corrigido", documento: "123456789", telefoneE164: "+50688889999" });
    const eventos = await eventosDo("Aluno", c.aluno.id);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ tipo: "AlunoEditado", autorId: c.operador.id, payload: { motivo: c.entrada.motivo, de: { sobrenome: "Santos" }, para: { sobrenome: "Corrigido" } } });
  });

  it.each([Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO])("%s recebe contexto pedagógico e não altera cadastro por chamada direta", async (papel) => {
    const c = await cenario([papel]);
    const usuario = await exigirSessao();
    const ficha = await obterAluno(c.aluno.id, usuario);
    expect(ficha?.aluno.primeiroNome).toBe("Ana");
    expect(ficha?.financeiro).toBeNull();
    expect(ficha?.aluno.matriculas).toEqual([]);
    expect(ficha?.aluno.nascimento).toBeNull();
    expect(JSON.stringify(ficha)).not.toMatch(/DOCUMENTO_PRIVADO|50688887777|contato-privado|ENDERECO_PRIVADO|OBSERVACAO_ADMINISTRATIVA_PRIVADA/);
    // IDs podem conter esses dígitos; valores financeiros não podem aparecer como folhas.
    const conferirValores = (valor: unknown): void => {
      if (valor && typeof valor === "object") Object.values(valor).forEach(conferirValores);
      else expect([85000, 84000, "85000", "84000"]).not.toContain(valor);
    };
    conferirValores(JSON.parse(JSON.stringify(ficha)));
    expect((await listarAlunos(usuario))[0].financeiro).toBeNull();
    expect((await editarAluno(c.aluno.id, c.entrada)).ok).toBe(false);
    expect(await prisma.aluno.findUnique({ where: { id: c.aluno.id } })).toEqual(c.aluno);
    expect(await eventosDo("Aluno", c.aluno.id)).toEqual([]);
  });

  it("papéis VEN+PRO não usam vínculo de turma para liberar documento ou financeiro comercial", async () => {
    const c = await cenario([Papel.VENDEDOR, Papel.PROFESSOR]);
    const ficha = await obterAluno(c.aluno.id, await exigirSessao());
    expect(ficha).not.toBeNull();
    expect(ficha?.aluno.documento).toBeNull();
    expect(ficha?.aluno.email).toBeNull();
    expect(ficha?.financeiro).toBeNull();
    expect((await editarAluno(c.aluno.id, c.entrada)).ok).toBe(false);
  });

  it("Secretaria revogada perde escrita e projeção privada na próxima operação", async () => {
    const c = await cenario([Papel.SECRETARIA_ACADEMICA, Papel.PROFESSOR]);
    await prisma.usuario.update({ where: { id: c.operador.id }, data: { papeis: [Papel.PROFESSOR] } });
    const ficha = await obterAluno(c.aluno.id, await exigirSessao());
    expect(ficha?.aluno.documento).toBeNull();
    expect(ficha?.financeiro).toBeNull();
    expect((await editarAluno(c.aluno.id, c.entrada)).ok).toBe(false);
    expect(await eventosDo("Aluno", c.aluno.id)).toEqual([]);
  });

  it("Secretaria desativada não altera cadastro usando o cookie anterior", async () => {
    const c = await cenario([Papel.SECRETARIA_ACADEMICA]);
    await prisma.usuario.update({ where: { id: c.operador.id }, data: { ativo: false } });
    expect(await editarAluno(c.aluno.id, c.entrada)).toMatchObject({ ok: false, erro: "Não autenticado." });
    expect(await prisma.aluno.findUnique({ where: { id: c.aluno.id } })).toEqual(c.aluno);
    expect(await eventosDo("Aluno", c.aluno.id)).toEqual([]);
  });

  it("tipo de documento de outro país é rejeitado sem editar aluno nem auditoria", async () => {
    const c = await cenario([Papel.SECRETARIA_ACADEMICA]);
    const outroPais = await prisma.pais.create({ data: { nome: "Brasil", codigoISO: "BR", moedaLocal: "BRL", ddi: "+55", tiposDocumento: { create: { nome: "CPF", validador: "cpf" } } }, include: { tiposDocumento: true } });
    expect(await editarAluno(c.aluno.id, { ...c.entrada, tipoDocumentoId: outroPais.tiposDocumento[0].id })).toMatchObject({ ok: false, erro: expect.stringContaining("não pertence ao país") });
    expect(await prisma.aluno.findUnique({ where: { id: c.aluno.id } })).toEqual(c.aluno);
    expect(await eventosDo("Aluno", c.aluno.id)).toEqual([]);
  });
});
