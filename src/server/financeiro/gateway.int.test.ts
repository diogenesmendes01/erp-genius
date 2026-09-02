import { describe, it, expect, beforeEach, vi } from "vitest";
import { EtapaLead, FormaPagamento, Papel, StatusCobranca, StatusComissao, StatusMatricula, TipoCobranca } from "@prisma/client";

// Fase 2 (doc 03): gateway por driver (simulado) — geração de link + CONCILIAÇÃO
// automática (webhook) pela baixa compartilhada, incluindo o gatilho C4 (taxa quitada
// ativa matrícula com contrato OK); e fechamento MENSAL automático de comissões.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo, eventosDo } from "@/test/integracao";
import { criarMatricula, gerarLinkPagamentoGateway, marcarContratoAssinado } from "@/server/matricula/acoes";
import { processarPagamentoGateway } from "./gateway";
import { rodarFechamentoComissoes } from "./cron-financeiro";
import { baixarCobrancaTx } from "./baixa";

let admin: Awaited<ReturnType<typeof criarUsuario>>;
let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  catalogo = await seedCatalogoMinimo();
  authMock.mockResolvedValue({ user: { id: admin.id } });
});

async function seedMatriculaAguardando() {
  const lead = await prisma.lead.create({
    data: { nome: "Lead Gateway", vendedorDonoId: vendedor.id, etapa: EtapaLead.AGUARDANDO_MATRICULA },
  });
  const r = await criarMatricula({
    leadId: lead.id,
    alunoPrimeiroNome: "Rita",
    alunoSobrenome: "Solís",
    alunoGenero: "NAO_INFORMADO",
    alunoNascimento: "1995-03-03",
    alunoPaisId: catalogo.pais.id,
    alunoTipoDocumentoId: catalogo.pais.tiposDocumento[0].id,
    alunoDocumento: "1-2222-2222",
    alunoNacionalidade: "CR",
    alunoEmail: "rita@teste.cr",
    alunoTelefone: "88885555",
    alunoWhatsapp: true,
    alunoAceitaComunicacoes: true,
    alunoPaisResidencia: "CR",
    pagador: "ALUNO",
    produtoId: catalogo.produto.id,
    taxaValor: 20000,
    mensalidadeValor: 85000,
    comissaoPct: 10,
    diaVencimento: 5,
    mesesPlano: 3,
  });
  if (!r.ok) throw new Error(`criarMatricula: ${(r as { erro?: string }).erro}`);
  const taxa = await prisma.cobranca.findFirstOrThrow({
    where: { matriculaId: r.dado!.id, tipo: TipoCobranca.MATRICULA },
  });
  return { matriculaId: r.dado!.id, taxa };
}

describe("gateway simulado — link + conciliação", () => {
  it("gera link com gatewayRef e âncora da régua; o webhook baixa a cobrança", async () => {
    const { taxa } = await seedMatriculaAguardando();

    const r = await gerarLinkPagamentoGateway(taxa.id);
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    const comLink = await prisma.cobranca.findUniqueOrThrow({ where: { id: taxa.id } });
    expect(comLink.gatewayRef).toMatch(/^[0-9a-f]{48}$/);
    expect(comLink.linkPagamento).toContain(`/pagar/${comLink.gatewayRef}`);
    expect(comLink.linkEnviadoEm).not.toBeNull();

    // "Webhook": cliente pagou pelo link.
    const baixa = await processarPagamentoGateway(comLink.gatewayRef!);
    expect(baixa.quitada).toBe(true);
    const paga = await prisma.cobranca.findUniqueOrThrow({ where: { id: taxa.id } });
    expect(paga.status).toBe(StatusCobranca.PAGO);
    const evento = (await eventosDo("Cobranca", taxa.id)).find((e) => e.tipo === "PagamentoRegistrado");
    expect((evento?.payload as { via?: string }).via).toBe("gateway_simulado");
  });

  it("conciliação + contrato OK + config ligada → matrícula ativa SOZINHA (C4 ponta a ponta)", async () => {
    await prisma.configComercial.upsert({
      where: { id: "comercial" },
      create: { id: "comercial", matriculaAutomaticaAtiva: true },
      update: { matriculaAutomaticaAtiva: true },
    });
    const { matriculaId, taxa } = await seedMatriculaAguardando();
    await marcarContratoAssinado(matriculaId);
    await gerarLinkPagamentoGateway(taxa.id);
    const { gatewayRef } = await prisma.cobranca.findUniqueOrThrow({ where: { id: taxa.id } });

    const baixa = await processarPagamentoGateway(gatewayRef!);
    expect(baixa.matriculaAtivada).toBe(true);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.ATIVA,
    );
  });
});

describe("fechamento mensal automático de comissões", () => {
  it("desligado (default) → nada; ligado → paga aprovadas 1x por mês (idempotente)", async () => {
    const { matriculaId } = await seedMatriculaAguardando();
    // Aprovada no MÊS PASSADO: o fechamento automático só paga competência fechada
    // (corte da review PR #60) — aprovadas no mês corrente têm teste próprio abaixo.
    const hoje = new Date();
    await prisma.comissao.updateMany({
      where: { matriculaId },
      data: { status: StatusComissao.APROVADA, aprovadaEm: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15) },
    });

    const r0 = await rodarFechamentoComissoes();
    expect(r0.executou).toBe(false);
    expect(r0.motivoParada).toBe("fechamento_automatico_desligado");

    await prisma.configFinanceiro.upsert({
      where: { id: "financeiro" },
      create: { id: "financeiro", fechamentoComissaoAutomatico: true },
      update: { fechamentoComissaoAutomatico: true },
    });

    const r1 = await rodarFechamentoComissoes();
    expect(r1.executou).toBe(true);
    expect(r1.pagas).toBe(1);
    expect(await prisma.comissao.count({ where: { status: StatusComissao.PAGA } })).toBe(1);

    const r2 = await rodarFechamentoComissoes();
    expect(r2.executou).toBe(false);
    expect(r2.motivoParada).toBe("ja_fechado_no_mes");
  });
});


describe("review PR #60 — financeiro", () => {
  it("corte de competência: comissão aprovada NO mês corrente NÃO entra no fechamento automático", async () => {
    const { matriculaId } = await seedMatriculaAguardando();
    await prisma.configFinanceiro.upsert({
      where: { id: "financeiro" },
      create: { id: "financeiro", fechamentoComissaoAutomatico: true },
      update: { fechamentoComissaoAutomatico: true },
    });
    // Aprovada AGORA (mês corrente): fica para o próximo ciclo.
    await prisma.comissao.updateMany({
      where: { matriculaId },
      data: { status: StatusComissao.APROVADA, aprovadaEm: new Date() },
    });
    const r1 = await rodarFechamentoComissoes(new Date());
    expect(r1.executou).toBe(true);
    expect(r1.pagas).toBe(0);
    expect(await prisma.comissao.count({ where: { status: StatusComissao.APROVADA } })).toBe(1);

    // No mês seguinte, a mesma comissão (agora do "mês anterior") entra.
    const mesQueVem = new Date();
    mesQueVem.setMonth(mesQueVem.getMonth() + 1, 2);
    const r2 = await rodarFechamentoComissoes(mesQueVem);
    expect(r2.pagas).toBe(1);
  });

  it("baixas PARCIAIS CONCORRENTES acumulam a soma (lock de linha — nada se perde)", async () => {
    const { taxa } = await seedMatriculaAguardando(); // taxa de 20000
    // Direto no miolo compartilhado (onde o FOR UPDATE vive): duas transações reais em
    // paralelo — sem o lock, ambas leriam recebido=0 e a 2ª sobrescreveria a 1ª (6000).
    const parcial = (valor: number) =>
      prisma.$transaction((tx) =>
        baixarCobrancaTx(tx, admin.id, taxa.id, {
          valorRecebido: valor,
          forma: FormaPagamento.TRANSFERENCIA,
          comprovanteUrl: "uploads/comprovante-teste.pdf",
          via: "manual",
        }),
      );

    const [a, b] = await Promise.all([parcial(6000), parcial(6000)]);
    expect(a.recebidoTotal + b.recebidoTotal).toBe(6000 + 12000); // 1ª vê 6000, 2ª vê 12000

    const depois = await prisma.cobranca.findUniqueOrThrow({ where: { id: taxa.id } });
    expect(Number(depois.valorRecebido)).toBe(12000); // 6000 + 6000 — sem sobrescrita
    expect(depois.status).toBe(StatusCobranca.PENDENTE); // ainda não quitou os 20000
  });
});

describe("review PR #60 rodada 2 — financeiro", () => {
  it("re-gerar o link REUSA o gatewayRef ativo — o link já enviado segue conciliável", async () => {
    const { taxa } = await seedMatriculaAguardando();
    const r1 = await gerarLinkPagamentoGateway(taxa.id);
    expect(r1.ok).toBe(true);
    const antes = await prisma.cobranca.findUniqueOrThrow({ where: { id: taxa.id } });

    const r2 = await gerarLinkPagamentoGateway(taxa.id);
    expect(r2.ok).toBe(true);
    const depois = await prisma.cobranca.findUniqueOrThrow({ where: { id: taxa.id } });
    // A referência NÃO muda: quem recebeu o 1º link ainda paga e o webhook concilia.
    expect(depois.gatewayRef).toBe(antes.gatewayRef);
    expect(depois.linkPagamento).toBe(antes.linkPagamento);

    const baixa = await processarPagamentoGateway(depois.gatewayRef!);
    expect(baixa.quitada).toBe(true);
  });

  it("dois ticks SIMULTÂNEOS do fechamento mensal pagam UMA vez (advisory lock por mês)", async () => {
    const { matriculaId } = await seedMatriculaAguardando();
    await prisma.configFinanceiro.upsert({
      where: { id: "financeiro" },
      create: { id: "financeiro", fechamentoComissaoAutomatico: true },
      update: { fechamentoComissaoAutomatico: true },
    });
    const hoje = new Date();
    await prisma.comissao.updateMany({
      where: { matriculaId },
      data: { status: StatusComissao.APROVADA, aprovadaEm: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15) },
    });

    const [a, b] = await Promise.all([rodarFechamentoComissoes(), rodarFechamentoComissoes()]);
    expect([a.executou, b.executou].filter(Boolean)).toHaveLength(1); // um fecha, o outro desiste
    expect(await prisma.comissao.count({ where: { status: StatusComissao.PAGA } })).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "FechamentoComissoesMensal" } })).toBe(1);
  });
});
