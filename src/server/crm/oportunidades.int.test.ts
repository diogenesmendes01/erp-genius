import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { moverEtapa } from "@/server/comercial/acoes";
import { moverEtapaEmLote } from "./oportunidades";

const logadoComo = (id: string) => authMock.mockResolvedValue({ user: { id } });

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outro: Awaited<ReturnType<typeof criarUsuario>>;
let opNovo: string;
let opQualificado: string;
let opMatriculada: string;
let opDeOutraCarteira: string;

beforeEach(async () => {
  await truncarBanco();
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro");
  const mk = async (nome: string, dono: string, etapa: string) =>
    (await prisma.oportunidade.create({ data: { nome, vendedorDonoId: dono, etapa } as never })).id;
  opNovo = await mk("Novo", vendedor.id, "NOVO");
  opQualificado = await mk("Qualificado", vendedor.id, "QUALIFICADO");
  opMatriculada = await mk("Matriculada", vendedor.id, "MATRICULADO");
  opDeOutraCarteira = await mk("Alheia", outro.id, "NOVO");
});

describe("moverEtapa", () => {
  it("recusa salto e etapa de evento sem gravar Evento", async () => {
    logadoComo(vendedor.id);
    const antes = await prisma.evento.count();
    expect(await moverEtapa(opNovo, "PROPOSTA")).toEqual({ ok: false, erro: "Use “Enviar proposta”." });
    expect(await moverEtapa(opMatriculada, "NOVO")).toEqual({ ok: false, erro: "Oportunidade encerrada não volta ao funil." });
    expect(await prisma.evento.count()).toBe(antes);
  });
  it("move uma etapa permitida e grava o Evento", async () => {
    logadoComo(vendedor.id);
    expect(await moverEtapa(opNovo, "EM_ATENDIMENTO")).toMatchObject({ ok: true });
    expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: opNovo } })).etapa).toBe("EM_ATENDIMENTO");
    const ev = await eventosDo("Lead", opNovo);
    expect(ev.some((e) => e.tipo === "EtapaAlterada")).toBe(true);
  });
});

describe("moverEtapaEmLote", () => {
  it("lote move as permitidas e lista as recusadas", async () => {
    logadoComo(vendedor.id);
    const r = await moverEtapaEmLote([opNovo, opQualificado, opDeOutraCarteira], "EM_ATENDIMENTO");
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.dado).toEqual({
      movidas: [opNovo, opQualificado],
      recusadas: [{ id: opDeOutraCarteira, motivo: "Oportunidade fora da sua carteira." }],
    });
  });
  it("lote acima de 50 é recusado", async () => {
    logadoComo(vendedor.id);
    expect(await moverEtapaEmLote(Array.from({ length: 51 }, (_, i) => `x${i}`), "NOVO")).toEqual({
      ok: false,
      erro: "Selecione no máximo 50 oportunidades.",
    });
  });
});
