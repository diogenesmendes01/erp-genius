import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (1º lote): `criarMatricula` com chave de idempotência. Um reenvio (duplo clique, retry de rede,
// F5 no POST) com a mesma chave não cria segunda matrícula, aluno, cobrança ou Evento: devolve o mesmo
// resultado. Chave repetida com outra entrada é recusada sem gravar nada.

// Sessão: só `exigirSessao` é trocada, e os papéis continuam lidos do banco (`carregarUsuarioFresco`).
// O mock de `@/lib/auth` usado nas outras suítes não serve aqui: dois `import("@/lib/auth")` simultâneos
// (o teste de envio concorrente) escapam do vi.mock no Vitest e carregam o NextAuth real.
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  return {
    ...o,
    exigirSessao: async () => {
      const u = await o.carregarUsuarioFresco(sessao.usuarioId);
      if (!u) throw new o.ErroAutenticacao();
      return u;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { criarMatricula } from "./acoes";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo } from "@/test/integracao";

let admin: Awaited<ReturnType<typeof criarUsuario>>;
let outroAdmin: Awaited<ReturnType<typeof criarUsuario>>;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

function input(chaveIdempotencia: string | undefined, extra: Record<string, unknown> = {}) {
  return {
    alunoPrimeiroNome: "Ana",
    alunoSobrenome: "Mora",
    alunoGenero: "NAO_INFORMADO" as const,
    alunoNascimento: "1991-03-10",
    alunoPaisId: catalogo.pais.id,
    alunoTipoDocumentoId: catalogo.pais.tiposDocumento[0].id,
    alunoDocumento: "1-2345-6789",
    alunoNacionalidade: "CR",
    alunoEmail: "ana@teste.cr",
    alunoTelefone: "88887777",
    alunoWhatsapp: true,
    alunoAceitaComunicacoes: true,
    alunoPaisResidencia: "CR",
    pagador: "ALUNO" as const,
    produtoId: catalogo.produto.id,
    taxaValor: 20000,
    mensalidadeValor: 85000,
    diaVencimento: 5,
    cobertura: { referencia: "MES_CIVIL" as const, inicio: "2026-11-01" },
    primeiroVencimento: "2026-11-05",
    mesesPlano: 3,
    chaveIdempotencia,
    ...extra,
  };
}

async function contagens() {
  return {
    matriculas: await prisma.matricula.count(),
    alunos: await prisma.aluno.count(),
    cobrancas: await prisma.cobranca.count(),
    comissoes: await prisma.comissao.count(),
    eventos: await prisma.evento.count(),
    criadas: await prisma.evento.count({ where: { tipo: "MatriculaCriada" } }),
  };
}

beforeAll(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  outroAdmin = await criarUsuario([Papel.ADMINISTRADOR], "Outro admin");
  catalogo = await seedCatalogoMinimo();
  await prisma.politicaComissao.create({ data: { paisId: catalogo.pais.id, produtoId: catalogo.produto.id, versao: 1, tipo: "PERCENTUAL", percentual: 10, moeda: "CRC", vigenteEm: new Date("2020-01-01"), criadaPorId: admin.id } });
});

beforeEach(() => {
  sessao.usuarioId = admin.id;
});

describe("criarMatricula com chave de idempotência (#166)", () => {
  it("a mesma chave duas vezes cria uma matrícula e um Evento, e devolve o mesmo resultado", async () => {
    const antes = await contagens();
    const primeira = await criarMatricula(input("chave-matricula-0001"));
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    const depoisDaPrimeira = await contagens();
    expect(depoisDaPrimeira.matriculas - antes.matriculas).toBe(1);
    expect(depoisDaPrimeira.criadas - antes.criadas).toBe(1);

    const segunda = await criarMatricula(input("chave-matricula-0001"));
    expect(segunda).toEqual(primeira);
    expect(await contagens()).toEqual(depoisDaPrimeira);
    if (!primeira.ok) return;
    expect(await prisma.evento.count({ where: { tipo: "MatriculaCriada", agregadoId: primeira.dado!.id } })).toBe(1);
  });

  it("dois envios simultâneos com a mesma chave criam uma só matrícula", async () => {
    const antes = await contagens();
    const [a, b] = await Promise.all([criarMatricula(input("chave-matricula-0002")), criarMatricula(input("chave-matricula-0002"))]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    const depois = await contagens();
    expect(depois.matriculas - antes.matriculas).toBe(1);
    expect(depois.alunos - antes.alunos).toBe(1);
    expect(depois.criadas - antes.criadas).toBe(1);
  });

  it("devolve o mesmo resultado também quando a matrícula aguarda aprovação de preço", async () => {
    const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
    sessao.usuarioId = vendedor.id;
    const desconto = input("chave-matricula-0003", { taxaValor: 1000 });
    const primeira = await criarMatricula(desconto);
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    if (!primeira.ok) return;
    expect(primeira.dado?.aguardaPreco).toBe(true);
    const aprovacoes = await prisma.aprovacao.count();
    expect(await criarMatricula(desconto)).toEqual(primeira);
    expect(await prisma.aprovacao.count()).toBe(aprovacoes);
  });

  it("recusa a mesma chave com outra entrada, sem gravar nada", async () => {
    const r = await criarMatricula(input("chave-matricula-0004"));
    expect(r.ok).toBe(true);
    const antes = await contagens();
    const outra = await criarMatricula(input("chave-matricula-0004", { alunoPrimeiroNome: "Beatriz" }));
    expect(outra.ok).toBe(false);
    if (!outra.ok) expect(outra.erro).toMatch(/já foi usada/);
    expect(await contagens()).toEqual(antes);
  });

  it("chaves diferentes criam matrículas diferentes, e a chave é de cada autor", async () => {
    const antes = await contagens();
    const a = await criarMatricula(input("chave-matricula-0005"));
    const b = await criarMatricula(input("chave-matricula-0006"));
    sessao.usuarioId = outroAdmin.id;
    const c = await criarMatricula(input("chave-matricula-0005"));
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, true]);
    const ids = new Set([a, b, c].map((r) => (r.ok ? r.dado!.id : "")));
    expect(ids.size).toBe(3);
    expect((await contagens()).matriculas - antes.matriculas).toBe(3);
  });

  it("sem chave continua criando como antes", async () => {
    const antes = await contagens();
    expect((await criarMatricula(input(undefined))).ok).toBe(true);
    expect((await contagens()).matriculas - antes.matriculas).toBe(1);
  });

  it("recusa chave curta demais", async () => {
    const antes = await contagens();
    expect((await criarMatricula(input("curta"))).ok).toBe(false);
    expect(await contagens()).toEqual(antes);
  });
});
