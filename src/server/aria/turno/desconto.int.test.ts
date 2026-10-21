import { beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { solicitarAprovacaoDesconto } from "./desconto";

beforeEach(truncarBanco);

const tx = <T>(f: (t: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>) =>
  prisma.$transaction((t) => f(t));

async function cenario() {
  const dono = await criarUsuario([Papel.VENDEDOR]);
  const op = await prisma.oportunidade.create({ data: { nome: "Maria", vendedorDonoId: dono.id } });
  const opSemDono = await prisma.oportunidade.create({ data: { nome: "Sem dono" } });
  const entrada = { oportunidadeId: op.id, tipo: "MENSALIDADE" as const, pct: 15, parcelas: 1, acaoAgenteIAId: "a1" };
  return { dono, op, opSemDono, entrada };
}

describe("solicitarAprovacaoDesconto", () => {
  it("cria_aprovacao_pendente_com_dono_como_solicitante", async () => {
    const { op, entrada } = await cenario();
    const r = await tx((t) => solicitarAprovacaoDesconto(t, entrada));
    expect(await prisma.aprovacao.findUnique({ where: { id: (r as { aprovacaoId: string }).aprovacaoId } }))
      .toMatchObject({ tipo: "DESCONTO", status: "PENDENTE", solicitanteId: op.vendedorDonoId, alvoTipo: "Lead", alvoId: op.id, payload: { ator: "ARIA", acaoAgenteIAId: "a1", tipoCobranca: "MENSALIDADE", percentual: 15, parcelas: 1 } });
  });

  it("grava_evento_no_agregado_lead_sem_autor", async () => {
    const { op, entrada } = await cenario();
    const r = (await tx((t) => solicitarAprovacaoDesconto(t, entrada))) as { aprovacaoId: string };
    const evs = (await eventosDo("Lead", op.id)).filter((e) => e.tipo === "AprovacaoSolicitada");
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ autorId: null, payload: { ator: "ARIA", acaoAgenteIAId: "a1", aprovacaoId: r.aprovacaoId, percentual: 15 } });
  });

  it("sem_dono_nao_cria", async () => {
    const { opSemDono, entrada } = await cenario();
    expect(await tx((t) => solicitarAprovacaoDesconto(t, { ...entrada, oportunidadeId: opSemDono.id }))).toEqual({ semDono: true });
    expect(await prisma.aprovacao.count()).toBe(0);
    expect(await prisma.evento.count({ where: { tipo: "AprovacaoSolicitada" } })).toBe(0);
  });
});
