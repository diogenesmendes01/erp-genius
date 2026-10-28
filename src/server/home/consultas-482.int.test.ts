import { beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarAlunoMinimo, criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { ErroPermissao } from "@/server/_shared";
import { DIAS_SEM_MOVIMENTO, dadosHomeGerente, dadosHomeVendedor } from "./consultas";

const agora = new Date("2026-10-15T15:00:00Z");
type U = Awaited<ReturnType<typeof criarUsuario>>;
let admin: U, gerente: U, vend: U, outro: U;

const sessao = (u: U) => ({ id: u.id, nome: u.nome, papeis: u.papeis });

async function conversaComercial(responsavelId: string | null, extra: Record<string, unknown> = {}) {
  const n = await prisma.atendimentoWhatsApp.count();
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+550000482${String(n).padStart(4, "0")}` } });
  const numero = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: `+5511482${String(n).padStart(7, "0")}`, rotulo: "Vendas 482", driver: "MOTOR", finalidade: "VENDAS" },
  });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  return prisma.atendimentoWhatsApp.create({
    data: {
      conversaId: conversa.id, contextoChave: `COMERCIAL::482:${n}`, finalidade: "COMERCIAL",
      responsavelId, status: responsavelId ? "EM_ATENDIMENTO" : "ABERTO_SEM_RESPONSAVEL",
      ...extra,
    },
  });
}

beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  admin = await criarUsuario([Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL], "Admin");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vend = await criarUsuario([Papel.VENDEDOR], "Vera");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro");
  await prisma.usuario.update({ where: { id: vend.id }, data: { gerenteComercialId: gerente.id } });
});

describe("dadosHomeVendedor", () => {
  it("recusa_quem_nao_e_vendedor", async () => {
    await expect(dadosHomeVendedor(sessao(gerente), agora)).rejects.toBeInstanceOf(ErroPermissao);
  });

  it("mostra_so_a_meta_e_as_comissoes_do_proprio_vendedor", async () => {
    const catalogo = await seedCatalogoMinimo();
    const aluno = await criarAlunoMinimo();
    const matricula = await prisma.matricula.create({
      data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "RASCUNHO" },
    });
    await prisma.metaComercial.create({ data: { competencia: "2026-10", usuarioId: vend.id, metrica: "MATRICULAS", valor: 10, criadaPorId: admin.id } });
    await prisma.metaComercial.create({ data: { competencia: "2026-10", usuarioId: outro.id, metrica: "MATRICULAS", valor: 99, criadaPorId: admin.id } });
    await prisma.comissao.create({ data: { matriculaId: matricula.id, vendedorId: vend.id, percentual: 10, valor: 40, moeda: "CRC", status: "APROVADA", aprovadaEm: agora } });
    await prisma.comissao.create({ data: { matriculaId: matricula.id, vendedorId: vend.id, percentual: 10, valor: 15, moeda: "CRC", status: "PENDENTE" } });
    await prisma.comissao.create({ data: { matriculaId: matricula.id, vendedorId: outro.id, percentual: 10, valor: 80, moeda: "CRC", status: "PAGA", aprovadaEm: agora, pagaEm: agora } });
    await prisma.oportunidade.create({ data: { nome: "Aberta", vendedorDonoId: vend.id, etapa: "PROPOSTA", comissaoPrevista: 25, paisId: catalogo.pais.id } });
    await prisma.oportunidade.create({ data: { nome: "Ganha", vendedorDonoId: vend.id, etapa: "MATRICULADO", comissaoPrevista: 90, paisId: catalogo.pais.id } });
    await prisma.oportunidade.create({ data: { nome: "Do outro", vendedorDonoId: outro.id, etapa: "PROPOSTA", comissaoPrevista: 70, paisId: catalogo.pais.id } });

    const dados = await dadosHomeVendedor(sessao(vend), agora);
    expect(dados.diasRestantesMes).toBe(16);
    expect(dados.metaMes).toEqual([expect.objectContaining({ metrica: "MATRICULAS", meta: 10, faltam: 10 })]);
    expect(dados.comissoesConfirmadas).toEqual([{ moeda: "CRC", valor: 40, status: "APROVADA" }]);
    expect(dados.comissoesPendentesLiquidacao).toEqual([{ moeda: "CRC", valor: 15 }]);
    expect(dados.comissoesPipelineAberto).toEqual([{ moeda: "CRC", valor: 25 }]);
    expect(JSON.stringify(dados)).not.toContain(outro.nome);
    expect(JSON.stringify(dados)).not.toContain("99");
  });

  it("lista_retornos_tarefas_e_oportunidades_prioritarias_sem_ranking", async () => {
    const esperando = await conversaComercial(vend.id, { primeiroInboundEm: new Date("2026-10-15T10:00:00Z"), primeiraRespostaEm: null });
    await conversaComercial(vend.id, { primeiroInboundEm: new Date("2026-10-15T09:00:00Z"), primeiraRespostaEm: new Date("2026-10-15T09:30:00Z") });
    await prisma.tarefa.create({ data: { titulo: "Ligar hoje", tipo: "OUTRO", setor: "COMERCIAL", status: "ABERTA", responsavelId: vend.id, fusoOrigem: "UTC", dataCivil: "2026-10-15" } });
    await prisma.tarefa.create({ data: { titulo: "Amanhã", tipo: "OUTRO", setor: "COMERCIAL", status: "ABERTA", responsavelId: vend.id, fusoOrigem: "UTC", dataCivil: "2026-10-16" } });
    await prisma.tarefa.create({ data: { titulo: "Atrasada", tipo: "OUTRO", setor: "COMERCIAL", status: "ABERTA", responsavelId: vend.id, fusoOrigem: "UTC", dataCivil: "2026-10-14" } });
    const experimental = await prisma.oportunidade.create({
      data: { nome: "Aula de hoje", vendedorDonoId: vend.id, etapa: "EXPERIMENTAL_AGENDADA", dataExperimental: new Date("2026-10-15T18:00:00Z") },
    });
    await prisma.oportunidade.create({
      data: { nome: "Já com proposta", vendedorDonoId: vend.id, etapa: "EXPERIMENTAL_REALIZADA", dataProposta: agora },
    });
    const semProposta = await prisma.oportunidade.create({
      data: { nome: "Sem proposta", vendedorDonoId: vend.id, etapa: "EXPERIMENTAL_REALIZADA" },
    });
    const quente = await prisma.oportunidade.create({
      data: { nome: "Quente parada", vendedorDonoId: vend.id, etapa: "QUALIFICADO", temperatura: "QUENTE", criadoEm: new Date("2026-09-01T12:00:00Z") },
    });
    await prisma.oportunidade.create({
      data: { nome: "Quente recente", vendedorDonoId: vend.id, etapa: "QUALIFICADO", temperatura: "QUENTE", criadoEm: agora },
    });

    const dados = await dadosHomeVendedor(sessao(vend), agora);
    expect(dados.retornos.total).toBe(1);
    expect(dados.retornos.itens).toEqual([{ id: esperando.id, nome: expect.stringContaining("+550000482"), href: `/inbox?c=${esperando.id}` }]);
    expect(dados.tarefas.itens.map((t) => t.titulo)).toEqual(["Atrasada", "Ligar hoje"]);
    expect(dados.tarefas.itens[0].atrasada).toBe(true);
    expect(dados.tarefas.itens[0].href).toBe(`/tarefas?t=${encodeURIComponent(dados.tarefas.itens[0].id)}`);
    expect(dados.oportunidadesPrioritarias.map((o) => o.nome)).toEqual(["Aula de hoje", "Sem proposta", "Quente parada"]);
    expect(dados.oportunidadesPrioritarias.find((o) => o.id === experimental.id)?.motivo).toBe("Experimental hoje");
    expect(dados.oportunidadesPrioritarias.find((o) => o.id === semProposta.id)?.href).toBe(`/funil?o=${encodeURIComponent(semProposta.id)}`);
    expect(dados.oportunidadesPrioritarias.find((o) => o.id === quente.id)?.motivo).toBe("Quente sem interação recente");
    expect(JSON.stringify(dados)).not.toMatch(/ranking/i);
    expect(DIAS_SEM_MOVIMENTO).toBeGreaterThan(0);
  });
});

describe("dadosHomeGerente · SLA real e aprovações", () => {
  it("conta_o_sla_do_inbox_e_ignora_o_lead_novo_antigo", async () => {
    await prisma.oportunidade.create({ data: { nome: "Novo antigo", vendedorDonoId: vend.id, etapa: "NOVO", criadoEm: new Date("2026-09-01T12:00:00Z") } });
    await conversaComercial(vend.id, { primeiroInboundEm: new Date("2026-10-15T10:00:00Z"), primeiraRespostaEm: null, prazoRespostaEm: new Date("2026-10-15T14:00:00Z") });
    await conversaComercial(vend.id, { primeiroInboundEm: new Date("2026-10-15T10:00:00Z"), primeiraRespostaEm: null, prazoRespostaEm: new Date("2026-10-15T18:00:00Z") });
    await conversaComercial(outro.id, { primeiroInboundEm: new Date("2026-10-15T10:00:00Z"), primeiraRespostaEm: null, prazoRespostaEm: new Date("2026-10-15T14:00:00Z") });

    const doGerente = await dadosHomeGerente(sessao(gerente), agora);
    expect(doGerente.kpis.alertasSla).toBe(1);
    const doAdmin = await dadosHomeGerente(sessao(admin), agora);
    expect(doAdmin.kpis.alertasSla).toBe(2);
    expect(doGerente.funil.find((f) => f.etapa === "NOVO")).toMatchObject({ total: 1, paradas: 1 });
    expect(doGerente.indicadores.find((v) => v.id === vend.id)).toMatchObject({ atendimentosSlaEstourado: 1, oportunidadesParadas: 1 });
    expect(doGerente.indicadores.some((v) => v.id === outro.id)).toBe(false);
  });

  it("soma_aprovacao_de_cobranca_e_preparacao_que_exige_alcada", async () => {
    const catalogo = await seedCatalogoMinimo();
    const aluno = await criarAlunoMinimo();
    const lead = await prisma.oportunidade.create({ data: { nome: "Contratação", vendedorDonoId: vend.id, etapa: "AGUARDANDO_MATRICULA" } });
    const matricula = await prisma.matricula.create({
      data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "RASCUNHO", leadId: lead.id },
    });
    await prisma.aprovacao.create({
      data: { tipo: "DESCONTO", status: "PENDENTE", solicitanteId: vend.id, alvoTipo: "Matricula", alvoId: matricula.id, payload: { exigeDirecao: false } },
    });
    const reservaExige = await prisma.reservaAgendaParticular.create({
      data: {
        matriculaId: matricula.id, preparadorId: vend.id, expiraEm: new Date("2026-11-15T15:00:00Z"),
        motivo: "Reserva da preparação em alçada", chaveIdempotencia: "482-reserva-exige", entradaHash: "482",
        snapshot: { fusoOrigem: "UTC", encontros: [] },
      },
    });
    await prisma.preparacaoComercialMatricula.create({
      data: {
        matriculaId: matricula.id, reservaParticularId: reservaExige.id, preparadorId: vend.id, regime: "MENSALIDADE",
        taxaProposta: 80, valorServicoProposto: 100, moeda: "CRC", motivo: "Desconto",
        chaveIdempotencia: "482-prep", entradaHash: "482",
        referencias: { alcada: { componentes: [
          { resultado: "EXIGE_APROVACAO" },
          { resultado: "DENTRO_ALCADA" },
        ] } },
      },
    });
    const dentro = await prisma.matricula.create({
      data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "RASCUNHO" },
    });
    const reservaDentro = await prisma.reservaAgendaParticular.create({
      data: {
        matriculaId: dentro.id, preparadorId: vend.id, expiraEm: new Date("2026-11-15T15:00:00Z"),
        motivo: "Reserva da preparação dentro da alçada", chaveIdempotencia: "482-reserva-ok", entradaHash: "482b",
        snapshot: { fusoOrigem: "UTC", encontros: [] },
      },
    });
    await prisma.preparacaoComercialMatricula.create({
      data: {
        matriculaId: dentro.id, reservaParticularId: reservaDentro.id, preparadorId: vend.id, regime: "MENSALIDADE",
        taxaProposta: 100, valorServicoProposto: 100, moeda: "CRC", motivo: "Cheio",
        chaveIdempotencia: "482-ok", entradaHash: "482b",
        referencias: { alcada: { componentes: [{ resultado: "DENTRO_ALCADA" }, { resultado: "DENTRO_ALCADA" }] } },
      },
    });

    expect((await dadosHomeGerente(sessao(admin), agora)).kpis.aprovacoesPendentes).toBe(2);
    expect((await dadosHomeGerente(sessao(gerente), agora)).kpis.aprovacoesPendentes).toBe(2);
  });
});
