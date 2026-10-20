import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { anonimizarBuscaExportacoes, CORTE_PADRAO, TIPO_EVENTO_ANONIMIZACAO } from "./anonimizar-busca-exportacoes";

// LGPD (#165, D5): o texto da busca dos DadosExportados antigos sai; o resto da trilha fica.

const ANTES = new Date("2026-09-24T18:00:00.000Z");
const DIA_25_ANTES_DO_DEPLOY = new Date("2026-09-25T13:00:00.000Z");
const DEPOIS = new Date("2026-09-27T12:00:00.000Z");

async function evento(tipo: string, criadoEm: Date, payload: object) {
  return prisma.evento.create({ data: { tipo, agregadoTipo: "Exportacao", agregadoId: `exp-${criadoEm.getTime()}-${Math.random()}`, criadoEm, payload } });
}

async function semear() {
  return {
    alunos: await evento("DadosExportados", ANTES, { conjunto: "alunos", quantidade: 3, colunas: ["Nome"], filtros: { busca: "ana.souza@email.com", status: "ATIVO" }, finalidade: "exportacao_da_listagem" }),
    leads: await evento("DadosExportados", DIA_25_ANTES_DO_DEPLOY, { conjunto: "leads", quantidade: 1, colunas: ["Nome"], filtros: { busca: "+50688887777" }, finalidade: "exportacao_da_listagem" }),
    semBusca: await evento("DadosExportados", ANTES, { conjunto: "alunos", quantidade: 9, colunas: ["Nome"], filtros: {}, finalidade: "exportacao_da_listagem" }),
    formatoNovo: await evento("DadosExportados", DIA_25_ANTES_DO_DEPLOY, { conjunto: "alunos", quantidade: 2, colunas: ["Nome"], filtros: { busca: { aplicada: true, caracteres: 5 } }, finalidade: "exportacao_da_listagem" }),
    depoisDoCorte: await evento("DadosExportados", DEPOIS, { conjunto: "leads", quantidade: 1, colunas: ["Nome"], filtros: { busca: "Maria Pereira" }, finalidade: "exportacao_da_listagem" }),
    outroTipo: await evento("FiltroSalvo", ANTES, { filtros: { busca: "Joao da Silva" } }),
  };
}

const fotografia = async () => (await prisma.evento.findMany({ orderBy: { id: "asc" }, select: { id: true, tipo: true, payload: true, criadoEm: true } }));
const payloadDe = async (id: string) => (await prisma.evento.findUniqueOrThrow({ where: { id } })).payload;

describe("anonimizarBuscaExportacoes (LGPD, #165 D5)", () => {
  beforeEach(async () => { await truncarBanco(); });

  it("simulação só conta: não altera nenhuma linha e não grava evento", async () => {
    await semear();
    const antes = await fotografia();
    const r = await anonimizarBuscaExportacoes(prisma, { aplicar: false });
    expect(r).toEqual({ modo: "simulacao", corte: CORTE_PADRAO.toISOString(), candidatos: 2, afetados: 0, lotes: 0, intervalo: { de: ANTES.toISOString(), ate: DIA_25_ANTES_DO_DEPLOY.toISOString() }, eventoId: null });
    expect(await fotografia()).toEqual(antes);
    expect(await prisma.evento.count({ where: { tipo: TIPO_EVENTO_ANONIMIZACAO } })).toBe(0);
  });

  it("aplicação troca só a busca em texto das linhas antes do corte, no formato da #119, em lotes", async () => {
    const s = await semear();
    const r = await anonimizarBuscaExportacoes(prisma, { aplicar: true, lote: 1 });
    expect(r).toMatchObject({ modo: "aplicacao", candidatos: 2, afetados: 2, lotes: 2, intervalo: { de: ANTES.toISOString(), ate: DIA_25_ANTES_DO_DEPLOY.toISOString() } });

    // O resto do payload fica igual; a busca vira { aplicada, caracteres } sem chave extra.
    expect(await payloadDe(s.alunos.id)).toEqual({ conjunto: "alunos", quantidade: 3, colunas: ["Nome"], filtros: { busca: { aplicada: true, caracteres: "ana.souza@email.com".length }, status: "ATIVO" }, finalidade: "exportacao_da_listagem" });
    expect(await payloadDe(s.leads.id)).toEqual({ conjunto: "leads", quantidade: 1, colunas: ["Nome"], filtros: { busca: { aplicada: true, caracteres: "+50688887777".length } }, finalidade: "exportacao_da_listagem" });

    // Fora do critério: sem busca, já no formato novo, depois do corte e outro tipo de evento.
    for (const e of [s.semBusca, s.formatoNovo, s.depoisDoCorte, s.outroTipo]) expect(await payloadDe(e.id)).toEqual(e.payload);

    const texto = JSON.stringify(await prisma.evento.findMany({ where: { criadoEm: { lt: CORTE_PADRAO }, tipo: "DadosExportados" } }));
    expect(texto).not.toContain("ana.souza");
    expect(texto).not.toContain("88887777");
  });

  it("o corte é respeitado: com --corte anterior ao dia 25, a linha do dia 25 fica", async () => {
    const s = await semear();
    const r = await anonimizarBuscaExportacoes(prisma, { aplicar: true, corte: new Date("2026-09-25T03:00:00.000Z") });
    expect(r.afetados).toBe(1);
    expect(await payloadDe(s.leads.id)).toEqual(s.leads.payload);
    expect((await payloadDe(s.alunos.id)) as { filtros: object }).toMatchObject({ filtros: { busca: { aplicada: true } } });
  });

  it("idempotente: a segunda execução não muda nenhuma linha", async () => {
    await semear();
    await anonimizarBuscaExportacoes(prisma, { aplicar: true });
    const depoisDaPrimeira = (await fotografia()).filter((e) => e.tipo !== TIPO_EVENTO_ANONIMIZACAO);
    const r = await anonimizarBuscaExportacoes(prisma, { aplicar: true });
    expect(r).toMatchObject({ candidatos: 0, afetados: 0, lotes: 0, intervalo: { de: null, ate: null } });
    expect((await fotografia()).filter((e) => e.tipo !== TIPO_EVENTO_ANONIMIZACAO)).toEqual(depoisDaPrimeira);
    expect((await anonimizarBuscaExportacoes(prisma, { aplicar: false })).candidatos).toBe(0);
  });

  it("grava um evento de auditoria por execução, com contagem e intervalo e sem dado pessoal", async () => {
    await semear();
    const r = await anonimizarBuscaExportacoes(prisma, { aplicar: true });
    const eventos = await prisma.evento.findMany({ where: { tipo: TIPO_EVENTO_ANONIMIZACAO } });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ id: r.eventoId, agregadoTipo: "Exportacao", autorId: null });
    expect(eventos[0].payload).toEqual({
      motivo: "lgpd_minimizacao_busca_exportacao", decisao: "D5 (#165)", eventoAlvo: "DadosExportados", campo: "payload.filtros.busca",
      corte: CORTE_PADRAO.toISOString(), candidatos: 2, afetados: 2, lotes: 1,
      intervalo: { de: ANTES.toISOString(), ate: DIA_25_ANTES_DO_DEPLOY.toISOString() }, concluida: true,
    });
    const texto = JSON.stringify(eventos[0]);
    for (const pessoal of ["ana.souza", "88887777", "Maria", "Joao"]) expect(texto).not.toContain(pessoal);

    // A reexecução também fica registrada, com zero linhas.
    const r2 = await anonimizarBuscaExportacoes(prisma, { aplicar: true });
    expect(await prisma.evento.count({ where: { tipo: TIPO_EVENTO_ANONIMIZACAO } })).toBe(2);
    expect(await payloadDe(r2.eventoId!)).toMatchObject({ candidatos: 0, afetados: 0, lotes: 0, intervalo: { de: null, ate: null }, concluida: true });
  });
});
