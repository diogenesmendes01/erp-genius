import { beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { historicoOportunidade, obterOportunidade } from "./historico";

const sessaoDe = (u: { id: string; nome: string; papeis: Papel[] }): UsuarioSessao => ({ id: u.id, nome: u.nome, papeis: u.papeis });

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outroVendedor: Awaited<ReturnType<typeof criarUsuario>>;
let op: string;

beforeEach(async () => {
  await truncarBanco();
  vendedor = await criarUsuario([Papel.VENDEDOR], "Ana Vendedora");
  outroVendedor = await criarUsuario([Papel.VENDEDOR], "Outro");
  op = (await prisma.oportunidade.create({ data: { nome: "Maria", vendedorDonoId: vendedor.id, etapa: "PERDIDO", motivoPerda: "PRECO" } as never })).id;
  const ev = (tipo: string, payload: object, min: number) =>
    prisma.evento.create({
      data: { tipo, agregadoTipo: "Lead", agregadoId: op, autorId: vendedor.id, payload, criadoEm: new Date(Date.UTC(2026, 9, 1, 12, min)) },
    });
  await ev("LeadCriado", { origem: "manual", telefone: "+5511999990000" }, 0);
  await ev("EtapaAlterada", { de: "NOVO", para: "EM_ATENDIMENTO", origem: "manual" }, 1);
  await ev("TipoDesconhecido", { segredo: "x" }, 2);
  await ev("LeadPerdido", { motivoPerda: "PRECO", observacao: "caro demais" }, 3);
});

describe("historicoOportunidade", () => {
  it("rotula eventos e nunca expõe payload cru", async () => {
    const h = await historicoOportunidade(op, sessaoDe(vendedor));
    expect(h!.map((i) => i.rotulo)).toEqual([
      "Oportunidade criada",
      "Etapa: Novo → 1º contato",
      "Alteração registrada",
      "Perdida: Preço",
    ]);
    expect(h![0]).toMatchObject({ tipo: "LeadCriado", autor: "Ana Vendedora" });
    expect(JSON.stringify(h)).not.toMatch(/segredo|caro demais|5511999990000/);
    expect(await historicoOportunidade(op, sessaoDe(outroVendedor))).toBeNull();
  });
});

describe("obterOportunidade", () => {
  it("devolve o detalhe no escopo e null fora dele", async () => {
    const d = await obterOportunidade(op, sessaoDe(vendedor));
    expect(d).toMatchObject({ id: op, nome: "Maria", etapa: "PERDIDO", motivoPerda: "PRECO", taxaMatricula: null });
    expect(await obterOportunidade(op, sessaoDe(outroVendedor))).toBeNull();
  });
});
