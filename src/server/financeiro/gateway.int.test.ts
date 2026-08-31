import { describe, it, expect, beforeEach, vi } from "vitest";
import { EtapaLead, Papel, StatusCobranca, StatusComissao, StatusMatricula, TipoCobranca } from "@prisma/client";

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
    await prisma.comissao.updateMany({
      where: { matriculaId },
      data: { status: StatusComissao.APROVADA },
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
