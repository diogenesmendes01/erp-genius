import { beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { dadosHomeGerente } from "./consultas";

// KPI "Matrículas ativadas no mês" × meta do funil (Q9): são dois critérios e a Home os mantém separados.
// O número grande conta `Matricula.ativadaEm`; a meta conta a 1ª entrada em MATRICULADO (Evento) no mês da escola.

type U = Awaited<ReturnType<typeof criarUsuario>>;
let admin: U, vend: U;

async function competenciaAtual() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: await fusoDaEscola(), year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}`;
}

async function matriculadosNoFunil(n: number) {
  for (let i = 0; i < n; i++) {
    const l = await prisma.oportunidade.create({ data: { nome: `L${i}`, etapa: "MATRICULADO", vendedorDonoId: vend.id } });
    await prisma.evento.create({ data: { tipo: "EtapaAlterada", agregadoTipo: "Lead", agregadoId: l.id, criadoEm: new Date(), payload: { de: "AGUARDANDO_MATRICULA", para: "MATRICULADO" } } });
  }
}

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL], "Admin");
  vend = await criarUsuario([Papel.VENDEDOR], "Vend");
});

const sessao = (u: U) => ({ id: u.id, nome: u.nome, papeis: u.papeis });

describe("dadosHomeGerente · meta de matrículas do mês", () => {
  it("sem_meta_definida_fica_null_e_o_kpi_segue_contando_matriculas_ativadas", async () => {
    await matriculadosNoFunil(2);
    const { kpis } = await dadosHomeGerente(sessao(admin));
    expect(kpis.metaMatriculasMes).toBeNull();
    // Nenhuma Matricula ativada: o funil não contamina o número grande.
    expect(kpis.matriculasMes).toBe(0);
  });

  it("com_meta_geral_o_realizado_vem_do_funil_separado_do_kpi", async () => {
    await matriculadosNoFunil(3);
    await prisma.metaComercial.create({ data: { competencia: await competenciaAtual(), usuarioId: null, metrica: "MATRICULAS", valor: 10, criadaPorId: admin.id } });
    const { kpis } = await dadosHomeGerente(sessao(admin));
    expect(kpis.metaMatriculasMes).toEqual({ meta: 10, realizado: 3 });
    expect(kpis.matriculasMes).toBe(0);
  });

  it("sem_meta_geral_soma_as_metas_dos_vendedores", async () => {
    await matriculadosNoFunil(1);
    const vend2 = await criarUsuario([Papel.VENDEDOR], "Vend2");
    const competencia = await competenciaAtual();
    await prisma.metaComercial.create({ data: { competencia, usuarioId: vend.id, metrica: "MATRICULAS", valor: 4, criadaPorId: admin.id } });
    await prisma.metaComercial.create({ data: { competencia, usuarioId: vend2.id, metrica: "MATRICULAS", valor: 6, criadaPorId: admin.id } });
    const { kpis } = await dadosHomeGerente(sessao(admin));
    expect(kpis.metaMatriculasMes).toEqual({ meta: 10, realizado: 1 });
  });
});
