import { describe, it, expect, beforeEach } from "vitest";
import { Papel, type OrigemTarefa, type StatusComissao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo } from "@/test/integracao";
import type { EscopoRelatorio } from "./escopo";
import type { FiltrosRelatorio } from "./pipeline";
import { metricasAtividades } from "./atividades";
import { desempenhoEquipe } from "./equipe";

const f: FiltrosRelatorio = { periodo: { inicio: new Date("2026-11-01T00:00:00Z"), fim: new Date("2026-12-01T00:00:00Z") } };
const tudo: EscopoRelatorio = { tipo: "TUDO" };
const em = (d: string, hhmm = "10:00") => new Date(`${d}T${hhmm}:00Z`);

let vend1: Awaited<ReturnType<typeof criarUsuario>>;
let vend2: Awaited<ReturnType<typeof criarUsuario>>;
let seq = 0;
let cat: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

beforeEach(async () => {
  await truncarBanco();
  cat = await seedCatalogoMinimo();
  vend1 = await criarUsuario([Papel.VENDEDOR], "Ana");
  vend2 = await criarUsuario([Papel.VENDEDOR], "Bia");
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Costa_Rica" } });
});

async function tarefa(o: { origem?: OrigemTarefa; concluida?: boolean; cancelada?: boolean; dia?: string; resp?: string } = {}) {
  seq += 1;
  return prisma.tarefa.create({
    data: {
      titulo: `T${seq}`, tipo: "LIGACAO", setor: "COMERCIAL", fusoOrigem: "America/Costa_Rica",
      origem: o.origem ?? "HUMANO", responsavelId: o.resp ?? vend1.id,
      criadoEm: em(o.dia ?? "2026-11-10"),
      ...(o.concluida ? { status: "CONCLUIDA", concluidaEm: em(o.dia ?? "2026-11-10", "15:00"), concluidaPorId: o.resp ?? vend1.id } : {}),
      ...(o.cancelada ? { status: "CANCELADA", canceladaEm: em(o.dia ?? "2026-11-10", "15:00") } : {}),
    },
  });
}
async function tarefas(q: { ARIA?: number; HUMANO?: number }) {
  for (let i = 0; i < (q.ARIA ?? 0); i++) await tarefa({ origem: "IA" });
  for (let i = 0; i < (q.HUMANO ?? 0); i++) await tarefa({ origem: "HUMANO" });
}
async function comissao(u: { id: string }, valor: number, moeda: string, status: StatusComissao, aprovadaEm = em("2026-11-12")) {
  seq += 1;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: `Aluno${seq}`, paisId: cat.pais.id } });
  const lead = await prisma.oportunidade.create({ data: { nome: `Opp${seq}`, vendedorDonoId: u.id, etapa: "MATRICULADO", criadoEm: em("2026-09-01") } });
  const m = await prisma.matricula.create({
    data: { alunoId: aluno.id, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda, status: "ATIVA", mesesPlano: 2, referenciaCobertura: "MES_CIVIL" },
  });
  return prisma.comissao.create({ data: { matriculaId: m.id, vendedorId: u.id, tipo: "PERCENTUAL", percentual: 10, valor, moeda, status, aprovadaEm } });
}

describe("atividades", () => {
  it("tarefas_da_aria_separadas", async () => {
    await tarefas({ ARIA: 2, HUMANO: 3 });
    expect((await metricasAtividades(f, tudo)).porOrigem).toEqual([
      { origem: "ARIA", tarefas: 2, mensagens: 0 },
      { origem: "EQUIPE", tarefas: 3, mensagens: 0 },
    ]);
  });

  it("cancelada_nao_conta_como_concluida", async () => {
    await tarefa({ concluida: true });
    await tarefa({ cancelada: true });
    const r = await metricasAtividades(f, tudo);
    expect(r.tarefasCriadas).toBe(2);
    expect(r.tarefasConcluidasPct).toBe(0.5);
    expect(r.porDia).toEqual([{ dia: "2026-11-10", criadas: 2, concluidas: 1 }]);
  });

  it("sem_tarefas_pct_nulo", async () => {
    expect((await metricasAtividades(f, tudo)).tarefasConcluidasPct).toBeNull();
  });

  it("escopo_do_vendedor_limita_tarefas", async () => {
    await tarefa({ resp: vend1.id });
    await tarefa({ resp: vend2.id });
    expect((await metricasAtividades(f, { tipo: "USUARIOS", ids: [vend1.id] })).tarefasCriadas).toBe(1);
  });
});

describe("desempenho da equipe", () => {
  it("vendedor_ve_so_a_propria_linha", async () => {
    expect((await desempenhoEquipe(f, { tipo: "USUARIOS", ids: [vend1.id] })).map((l) => l.usuarioId)).toEqual([vend1.id]);
  });

  it("administrador_ve_todos_os_ativos", async () => {
    await prisma.usuario.update({ where: { id: vend2.id }, data: { ativo: false } });
    expect((await desempenhoEquipe(f, tudo)).map((l) => l.usuarioId)).toEqual([vend1.id]);
  });

  it("comissao_por_moeda_aprovada_no_periodo", async () => {
    await comissao(vend1, 100, "BRL", "APROVADA");
    await comissao(vend1, 50, "BRL", "ESTORNADA");
    await comissao(vend1, 70, "BRL", "APROVADA", em("2026-10-20"));
    expect((await desempenhoEquipe(f, tudo)).find((l) => l.usuarioId === vend1.id)!.comissao).toEqual([{ moeda: "BRL", valor: 100 }]);
  });

  it("oportunidades_ganhas_e_tarefas", async () => {
    await prisma.oportunidade.create({ data: { nome: "L1", vendedorDonoId: vend1.id, etapa: "MATRICULADO", criadoEm: em("2026-11-05") } });
    await prisma.oportunidade.create({ data: { nome: "L2", vendedorDonoId: vend1.id, etapa: "NOVO", criadoEm: em("2026-11-06") } });
    await tarefa({ concluida: true });
    const l = (await desempenhoEquipe(f, tudo)).find((x) => x.usuarioId === vend1.id)!;
    expect(l.oportunidades).toBe(2);
    expect(l.conversao).toBe(0.5);
    expect(l.tarefasConcluidas).toBe(1);
    expect(l.meta).toEqual({ pct: null });
  });
});
