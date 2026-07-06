import { describe, it, expect, beforeAll } from "vitest";
import { Papel, StatusCobranca, StatusMatricula, TipoCobranca } from "@prisma/client";

// Prioridade 1 do docs/14 (integração), lado FINANCEIRO: a ficha financeira respeita o
// escopo row-level (doc 07) — vendedor só abre a ficha de alunos ligados a ele (comissão
// dele OU lead dele); fora do escopo retorna null (nunca dados de terceiros). Dados
// criados direto no banco de teste (sem passar pelas actions) para isolar a LEITURA.

import { obterFichaFinanceira } from "./consultas";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo } from "@/test/integracao";
import type { UsuarioSessao } from "@/server/_shared";

function sessaoDe(u: { id: string; nome: string; papeis: Papel[] }): UsuarioSessao {
  return { id: u.id, nome: u.nome, papeis: u.papeis };
}

let dono: Awaited<ReturnType<typeof criarUsuario>>;
let outro: Awaited<ReturnType<typeof criarUsuario>>;
let financeiro: Awaited<ReturnType<typeof criarUsuario>>;
let alunoId: string;

beforeAll(async () => {
  await truncarBanco();
  dono = await criarUsuario([Papel.VENDEDOR], "Vendedor Dono");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro Vendedor");
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  const cat = await seedCatalogoMinimo();

  const aluno = await prisma.aluno.create({
    data: { primeiroNome: "Carlos", paisId: cat.pais.id },
  });
  alunoId = aluno.id;
  await prisma.matricula.create({
    data: {
      alunoId: aluno.id,
      produtoId: cat.produto.id,
      paisId: cat.pais.id,
      moeda: "CRC",
      status: StatusMatricula.ATIVA,
      comissoes: {
        create: { vendedorId: dono.id, percentual: 10, valor: 2000, moeda: "CRC" },
      },
      cobrancas: {
        create: {
          tipo: TipoCobranca.MENSALIDADE,
          valorOriginal: 85000,
          valorNegociado: 85000,
          moeda: "CRC",
          vencimento: new Date(Date.now() + 7 * 86400000),
          status: StatusCobranca.PENDENTE,
        },
      },
    },
  });
});

describe("ficha financeira — escopo row-level (doc 07)", () => {
  it("vendedor com comissão no aluno ABRE a ficha", async () => {
    const ficha = await obterFichaFinanceira(alunoId, sessaoDe(dono));
    expect(ficha).not.toBeNull();
    expect(ficha!.cobrancas).toHaveLength(1);
  });

  it("vendedor SEM vínculo recebe null — nem KPIs, nem cobranças, nada", async () => {
    const ficha = await obterFichaFinanceira(alunoId, sessaoDe(outro));
    expect(ficha).toBeNull();
  });

  it("papel amplo (Financeiro) vê qualquer ficha", async () => {
    const ficha = await obterFichaFinanceira(alunoId, sessaoDe(financeiro));
    expect(ficha).not.toBeNull();
  });

  it("valores chegam como number puro (borda Decimal → number), somas por moeda corretas", async () => {
    const ficha = await obterFichaFinanceira(alunoId, sessaoDe(financeiro));
    const cobranca = ficha!.cobrancas[0];
    expect(typeof cobranca.valorNegociado).toBe("number");
    expect(cobranca.valorNegociado).toBe(85000);
    expect(ficha!.emAberto).toEqual([{ moeda: "CRC", valor: 85000 }]);
  });
});
