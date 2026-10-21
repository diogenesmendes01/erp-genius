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
  it("traz os campos editados no painel e os documentos ativos, sem OUTRO para o vendedor (B1 da R1 do #216)", async () => {
    await prisma.oportunidade.update({
      where: { id: op },
      data: { segmento: "KIDS", origemConjunto: "Conjunto A", origemPalavra: "ingles", planoPrevisto: "Regular A1", comissaoPrevista: 100, dataProposta: new Date("2026-10-27T15:00:00Z") },
    });
    await prisma.documento.createMany({
      data: [
        { leadId: op, categoria: "PROPOSTA", nome: "proposta.pdf", url: "/api/files/a.pdf" },
        { leadId: op, categoria: "OUTRO", nome: "outro.pdf", url: "/api/files/b.pdf" },
        { leadId: op, categoria: "PROPOSTA", nome: "velha.pdf", url: "/api/files/c.pdf", arquivado: true },
      ],
    });
    const d = await obterOportunidade(op, sessaoDe(vendedor));
    expect(d).toMatchObject({
      segmento: "KIDS", origemConjunto: "Conjunto A", origemPalavra: "ingles", planoPrevisto: "Regular A1",
      comissaoPrevista: "100.00", dataProposta: new Date("2026-10-27T15:00:00Z"),
    });
    expect(d!.documentos.map((x) => x.nome)).toEqual(["proposta.pdf"]);
    const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
    expect((await obterOportunidade(op, sessaoDe(admin)))!.documentos.map((x) => x.nome).sort()).toEqual(["outro.pdf", "proposta.pdf"]);
  });
});
