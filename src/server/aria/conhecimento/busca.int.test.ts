import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { buscarTrechos } from "./busca";

let criadorId: string;

async function fonte(nome: string, texto: string, status: "PRONTA" | "PROCESSANDO" | "ERRO" = "PRONTA") {
  const f = await prisma.fonteConhecimento.create({
    data: { tipo: "TEXTO", nome, status, hashConteudo: `h-${nome}-${Math.random()}`, criadoPorId: criadorId },
  });
  await prisma.trechoConhecimento.create({ data: { fonteId: f.id, ordem: 0, texto } });
  return f.id;
}

beforeEach(async () => {
  await truncarBanco();
  criadorId = (await criarUsuario([])).id;
});

describe("busca nos trechos", () => {
  it("acha_com_plural_e_acento", async () => {
    const fonteId = await fonte("Horários", "As turmas noturnas começam às 19h.");
    const r = await buscarTrechos("turma noturna", [fonteId]);
    expect(r[0].texto).toContain("19h");
    expect(r[0].fonteId).toBe(fonteId);
    expect(r[0].rank).toBeGreaterThan(0);
  });

  it("so_fontes_informadas", async () => {
    await fonte("Horários", "As turmas noturnas começam às 19h.");
    expect(await buscarTrechos("turma", [])).toEqual([]);
    const outra = await fonte("Outra", "Nada a ver com isso.");
    expect(await buscarTrechos("turma", [outra])).toEqual([]);
  });

  it("ignora_fonte_arquivada_e_nao_pronta", async () => {
    const arquivada = await fonte("A", "A turma começa cedo.");
    await prisma.fonteConhecimento.update({ where: { id: arquivada }, data: { arquivadaEm: new Date() } });
    const processando = await fonte("B", "A turma começa tarde.", "PROCESSANDO");
    expect(await buscarTrechos("turma", [arquivada, processando])).toEqual([]);
  });

  it("consulta_com_aspas_e_simbolos_nao_quebra", async () => {
    const fonteId = await fonte("Horários", "As turmas noturnas.");
    expect(await buscarTrechos("'); DROP TABLE x; --", [fonteId])).toEqual([]);
    expect(await prisma.trechoConhecimento.count()).toBe(1);
  });

  it("respeita_limite_e_ordena_por_rank", async () => {
    const id = await fonte("L", "turma turma turma noturna");
    for (let i = 1; i <= 3; i++) await prisma.trechoConhecimento.create({ data: { fonteId: id, ordem: i, texto: `turma ${i}` } });
    const r = await buscarTrechos("turma", [id], 2);
    expect(r).toHaveLength(2);
    expect(r[0].rank).toBeGreaterThanOrEqual(r[1].rank);
  });
});
