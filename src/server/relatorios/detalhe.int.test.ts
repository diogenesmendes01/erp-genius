import { describe, it, expect, beforeEach } from "vitest";
import { Papel, type EtapaLead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import type { EscopoRelatorio } from "./escopo";
import type { FiltrosRelatorio } from "./pipeline";
import { detalharMetrica, lerChaveDetalhe } from "./detalhe";

const f: FiltrosRelatorio = { periodo: { inicio: new Date("2026-03-01T00:00:00Z"), fim: new Date("2026-04-30T00:00:00Z") } };
const tudo: EscopoRelatorio = { tipo: "TUDO" };
const em = (dia: number) => new Date(Date.UTC(2026, 2, dia, 12));

let vend1: Awaited<ReturnType<typeof criarUsuario>>;
let vend2: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  vend1 = await criarUsuario([Papel.VENDEDOR], "V1");
  vend2 = await criarUsuario([Papel.VENDEDOR], "V2");
});

const op = (dono: string, o: { nome?: string; etapa?: EtapaLead; dia?: number; origemCanal?: "WHATSAPP" | "INSTAGRAM" } = {}) =>
  prisma.oportunidade.create({ data: { nome: o.nome ?? "Lead", etapa: o.etapa ?? "NOVO", vendedorDonoId: dono, criadoEm: em(o.dia ?? 2), origemCanal: o.origemCanal } });
async function opsDe(dono: { id: string }, n: number) {
  await prisma.oportunidade.createMany({ data: Array.from({ length: n }, (_, i) => ({ nome: `Lead ${i}`, vendedorDonoId: dono.id, criadoEm: em(2) })) });
}
const ev = (leadId: string, tipo: string, dia: number, payload: object) =>
  prisma.evento.create({ data: { tipo, agregadoTipo: "Lead", agregadoId: leadId, criadoEm: em(dia), payload } });

describe("detalhe das métricas", () => {
  it("detalhe_respeita_escopo_e_limite", async () => {
    await opsDe(vend2, 250);
    expect((await detalharMetrica("abertas", f, { tipo: "USUARIOS", ids: [vend1.id] })).total).toBe(0);
    const r = await detalharMetrica("abertas", f, tudo);
    expect(r.itens).toHaveLength(200);
    expect(r.total).toBe(250);
    expect(r.itens[0].href).toBe(`/oportunidades/${r.itens[0].id}`);
  });

  it("chaves_ganhas_perdidas_etapa_origem_e_responsavel", async () => {
    const ganha = await op(vend1.id, { etapa: "MATRICULADO" });
    await ev(ganha.id, "EtapaAlterada", 10, { de: "PROPOSTA", para: "MATRICULADO" });
    const perdida = await op(vend1.id, { etapa: "PERDIDO" });
    await ev(perdida.id, "LeadPerdido", 11, { motivoPerda: "PRECO" });
    await op(vend2.id, { etapa: "QUALIFICADO", origemCanal: "INSTAGRAM" });
    const ids = async (c: Parameters<typeof detalharMetrica>[0]) => (await detalharMetrica(c, f, tudo)).itens.map((i) => i.id);
    expect(await ids("ganhas")).toEqual([ganha.id]);
    expect(await ids("perdidas")).toEqual([perdida.id]);
    expect(await ids("perda:PRECO")).toEqual([perdida.id]);
    expect(await ids("perda:TEMPO")).toEqual([]);
    expect(await ids("etapa:QUALIFICADO")).toHaveLength(1);
    expect(await ids("origem:INSTAGRAM")).toHaveLength(1);
    expect(await ids(`responsavel:${vend1.id}`)).toHaveLength(2);
    expect(await ids("abertas")).toHaveLength(1);
  });

  it("busca_por_nome_e_sem_dados_de_contato", async () => {
    await prisma.oportunidade.create({ data: { nome: "Ana Silva", vendedorDonoId: vend1.id, criadoEm: em(2), telefoneE164: "+5511999999999" } });
    await op(vend1.id, { nome: "Bruno" });
    const r = await detalharMetrica("abertas", { ...f, busca: "ana" }, tudo);
    expect(r.itens.map((i) => i.nome)).toEqual(["Ana Silva"]);
    expect(JSON.stringify(r)).not.toContain("999999999");
    expect((await detalharMetrica("abertas", { ...f, busca: "%" }, tudo)).total).toBe(0);
  });

  it("chave_invalida_e_rejeitada", () => {
    expect(lerChaveDetalhe("etapa:XYZ")).toBeNull();
    expect(lerChaveDetalhe("perda:PRECO")).toBe("perda:PRECO");
    expect(lerChaveDetalhe("qualquer")).toBeNull();
  });
});
