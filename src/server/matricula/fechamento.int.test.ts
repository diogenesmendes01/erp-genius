import { describe, it, expect, beforeEach, vi } from "vitest";
import { EtapaLead, Papel, FormaPagamento, StatusMatricula, TipoCobranca } from "@prisma/client";

// C4 (doc 27 §fechamento): contrato e link de pagamento são estados auditáveis e
// alimentam réguas comerciais. Eles não substituem a preparação contratual segura.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { receberTx } from "@/server/financeiro/recebimentos";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo, eventosDo } from "@/test/integracao";
import {
  ativarSeFechamentoCompletoTx,
  marcarContratoAssinado,
  registrarContratoEnviado,
  registrarLinkPagamento,
} from "./acoes";
import { rodarFechamentosPendentes } from "./cron-fechamento";
import { CADENCIA_CONTRATO, CADENCIA_LINK_PAGAMENTO, CHAVE_CONTRATO, CHAVE_LINK_PAGAMENTO } from "@/server/comercial/regua-fabrica";
import { rodarContratoSemAssinatura, rodarLinkPagamentoSemPagamento } from "@/server/whatsapp/cron-comercial";

let admin: Awaited<ReturnType<typeof criarUsuario>>;
let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

const TAXA = 20000;
const MENSALIDADE = 85000;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  catalogo = await seedCatalogoMinimo();
  authMock.mockResolvedValue({ user: { id: admin.id } });
});

async function seedMatriculaAguardando() {
  const lead = await prisma.lead.create({
    data: { nome: "Lead Fechamento", vendedorDonoId: vendedor.id, etapa: EtapaLead.AGUARDANDO_MATRICULA },
  });
  // Fixture de estado legado explícita: este arquivo verifica que o fechamento
  // não transforma taxa/contrato em aprovação de preparação. Não chama a ação
  // pública, cuja entrada exige o fluxo comercial atual.
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Paula", paisId: catalogo.pais.id } });
  const matricula = await prisma.matricula.create({
    data: { alunoId: aluno.id, leadId: lead.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: StatusMatricula.AGUARDANDO, mesesPlano: 3, diaVencimento: 5 },
  });
  const [taxa] = await Promise.all([
    prisma.cobranca.create({ data: { matriculaId: matricula.id, tipo: TipoCobranca.MATRICULA, moeda: "CRC", valorOriginal: TAXA, valorNegociado: TAXA, saldo: TAXA, vencimento: new Date("2027-01-05T12:00:00Z") } }),
    prisma.cobranca.create({ data: { matriculaId: matricula.id, tipo: TipoCobranca.MENSALIDADE, moeda: "CRC", valorOriginal: MENSALIDADE, valorNegociado: MENSALIDADE, saldo: MENSALIDADE, vencimento: new Date("2027-02-05T12:00:00Z") } }),
    prisma.comissao.create({ data: { matriculaId: matricula.id, vendedorId: vendedor.id, percentual: 10, valor: TAXA / 10, moeda: "CRC" } }),
  ]);
  const matriculaId = matricula.id;
  return { lead, matriculaId, taxa };
}

async function ligarMatriculaAutomatica(ligada = true) {
  await prisma.configComercial.upsert({
    where: { id: "comercial" },
    create: { id: "comercial", matriculaAutomaticaAtiva: ligada },
    update: { matriculaAutomaticaAtiva: ligada },
  });
}

describe("estado de fechamento (contrato + link)", () => {
  it("atalhos de envio e assinatura são recusados sem a conferência documental", async () => {
    const { matriculaId } = await seedMatriculaAguardando();

    const r1 = await registrarContratoEnviado(matriculaId);
    expect(r1.ok).toBe(false);
    const m1 = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
    expect(m1.contratoEnviadoEm).toBeNull();

    const r2 = await marcarContratoAssinado(matriculaId);
    expect(r2.ok).toBe(false);
    const eventos = (await eventosDo("Matricula", matriculaId)).filter((e) => e.tipo === "ContratoEnviado");
    expect(eventos).toHaveLength(0);
  });

  it("registrarLinkPagamento grava link + âncora + evento na cobrança", async () => {
    const { taxa } = await seedMatriculaAguardando();
    const r = await registrarLinkPagamento(taxa.id, "https://pagar.exemplo/abc");
    expect(r.ok).toBe(true);
    const depois = await prisma.cobranca.findUniqueOrThrow({ where: { id: taxa.id } });
    expect(depois.linkPagamento).toBe("https://pagar.exemplo/abc");
    expect(depois.linkEnviadoEm).not.toBeNull();
    expect((await eventosDo("Cobranca", taxa.id)).map((e) => e.tipo)).toContain("LinkPagamentoEnviado");
  });
});

describe("fechamento comercial sem bypass da preparação", () => {
  it("assinatura chega DEPOIS do pagamento → preserva AGUARDANDO até o fluxo seguro", async () => {
    await ligarMatriculaAutomatica();
    const { lead, matriculaId, taxa } = await seedMatriculaAguardando();

    // O pagamento confirmado é preparado fora deste recorte. Fechamento não pode
    // reinterpretá-lo como autorização de ativação.
    await prisma.$transaction(tx => receberTx(tx, { cobrancaId: taxa.id, autorId: admin.id, chaveIdempotencia: `teste:${taxa.id}`, valorRecebido: TAXA, forma: FormaPagamento.PIX, dataPagamento: new Date(), evidencia: "Comprovante conferido no teste" }));
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.AGUARDANDO,
    );

    // O atalho de assinatura também é recusado: não substitui preparação/aceite.
    const r = await marcarContratoAssinado(matriculaId);
    expect(r.ok).toBe(false);

    const matricula = await prisma.matricula.findUniqueOrThrow({
      where: { id: matriculaId },
      include: { cobrancas: true, comissoes: true },
    });
    expect(matricula.status).toBe(StatusMatricula.AGUARDANDO);
    expect(matricula.contratoOk).toBe(false);
    expect(matricula.cobrancas.filter((c) => c.tipo === TipoCobranca.MENSALIDADE)).toHaveLength(1);
    expect(matricula.comissoes[0].status).toBe("PENDENTE");
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe(EtapaLead.AGUARDANDO_MATRICULA);

    const ativacao = (await eventosDo("Matricula", matriculaId)).find((e) => e.tipo === "MatriculaAtivada");
    expect(ativacao).toBeUndefined();
  });

  it("pagamento chega DEPOIS da assinatura → a baixa não ativa sem preparação", async () => {
    await ligarMatriculaAutomatica();
    const { matriculaId, taxa } = await seedMatriculaAguardando();

    await marcarContratoAssinado(matriculaId);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.AGUARDANDO,
    );

    await prisma.$transaction(tx => receberTx(tx, { cobrancaId: taxa.id, autorId: admin.id, chaveIdempotencia: `teste:${taxa.id}`, valorRecebido: TAXA, forma: FormaPagamento.PIX, dataPagamento: new Date(), evidencia: "Comprovante conferido no teste" }));
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.AGUARDANDO,
    );
  });

  it("config DESLIGADA (default) → fechamento completo NÃO ativa sozinho", async () => {
    const { matriculaId, taxa } = await seedMatriculaAguardando();
    await prisma.$transaction(tx => receberTx(tx, { cobrancaId: taxa.id, autorId: admin.id, chaveIdempotencia: `teste:${taxa.id}`, valorRecebido: TAXA, forma: FormaPagamento.PIX, dataPagamento: new Date(), evidencia: "Comprovante conferido no teste" }));
    await marcarContratoAssinado(matriculaId);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.AGUARDANDO,
    );
  });

  it("fechamento não sugere nem aloca turma antes da ativação segura", async () => {
    await ligarMatriculaAutomatica();
    const nivel = await prisma.nivel.create({
      data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 },
    });
    const turma = await prisma.turma.create({
      data: {
        nome: "Salvador",
        modalidadeId: catalogo.modalidade.id,
        nivelId: nivel.id,
        status: "ABERTA",
        capacidade: 10,
      },
    });
    const { matriculaId } = await seedMatriculaAguardando();
    const taxa = await prisma.cobranca.findFirstOrThrow({
      where: { matriculaId, tipo: TipoCobranca.MATRICULA },
    });
    await prisma.$transaction(tx => receberTx(tx, { cobrancaId: taxa.id, autorId: admin.id, chaveIdempotencia: `teste:${taxa.id}`, valorRecebido: TAXA, forma: FormaPagamento.PIX, dataPagamento: new Date(), evidencia: "Comprovante conferido no teste" }));
    await marcarContratoAssinado(matriculaId);

    const sugestao = (await eventosDo("Matricula", matriculaId)).find((e) => e.tipo === "TurmaSugerida");
    expect(sugestao).toBeUndefined();
    expect(await prisma.alocacaoTurma.count()).toBe(0);
    void turma;
  });
});

describe("réguas de fechamento (C4) no motor comercial", () => {
  async function seedCanalELead(leadId: string) {
    const numero = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511933334444", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "inst-c4", donoId: vendedor.id },
    });
    const contato = await prisma.contatoWhatsApp.create({
      data: { telefoneE164: "+50688887777", leadId },
    });
    await prisma.conversaWhatsApp.create({
      data: { numeroId: numero.id, contatoId: contato.id, capturadaEm: new Date(), ultimaMensagemEm: new Date() },
    });
    return numero;
  }

  async function seedPolitica(chave: string, degraus: readonly { passo: string; offsetMinutos: number; rotulo: string; toleranciaMinutos: number | null }[], numeroId: string) {
    return prisma.politicaComercial.create({
      data: {
        chave,
        nome: chave,
        estado: "SHADOW",
        modoPiloto: false, // comportamento geral — o piloto tem testes próprios (doc 32 B1)
        janelaInicio: 0,
        janelaFim: 24,
        diasSemana: [0, 1, 2, 3, 4, 5, 6],
        numeroRemetenteId: numeroId,
        degraus: {
          create: degraus.map((d) => ({
            passo: d.passo,
            offsetMinutos: d.offsetMinutos,
            rotulo: d.rotulo,
            ativo: true,
            toleranciaMinutos: d.toleranciaMinutos,
          })),
        },
      },
    });
  }

  it("contrato enviado há 3 dias sem assinatura → enfileira o +48h", async () => {
    const { lead, matriculaId } = await seedMatriculaAguardando();
    const numero = await seedCanalELead(lead.id);
    await seedPolitica(CHAVE_CONTRATO, CADENCIA_CONTRATO, numero.id);
    await prisma.matricula.update({
      where: { id: matriculaId },
      data: { contratoEnviadoEm: new Date(Date.now() - 3 * 24 * 3600_000) },
    });

    const r = await rodarContratoSemAssinatura();
    expect(r.enfileiradas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.passoComercial).toBe("+48h");
    expect(intencao.leadId).toBe(lead.id);
  });

  it("contrato ASSINADO sai da régua (stop-condition no resolver)", async () => {
    const { lead, matriculaId } = await seedMatriculaAguardando();
    const numero = await seedCanalELead(lead.id);
    await seedPolitica(CHAVE_CONTRATO, CADENCIA_CONTRATO, numero.id);
    await prisma.matricula.update({
      where: { id: matriculaId },
      data: { contratoEnviadoEm: new Date(Date.now() - 3 * 24 * 3600_000), contratoOk: true },
    });

    const r = await rodarContratoSemAssinatura();
    expect(r.leadsAvaliados).toBe(0);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("link enviado há 2 dias sem pagamento → enfileira o +24h; taxa PAGA para a régua", async () => {
    const { lead, matriculaId, taxa } = await seedMatriculaAguardando();
    const numero = await seedCanalELead(lead.id);
    await seedPolitica(CHAVE_LINK_PAGAMENTO, CADENCIA_LINK_PAGAMENTO, numero.id);
    await prisma.cobranca.update({
      where: { id: taxa.id },
      data: { linkPagamento: "https://pagar.exemplo/x", linkEnviadoEm: new Date(Date.now() - 2 * 24 * 3600_000) },
    });

    const r1 = await rodarLinkPagamentoSemPagamento();
    expect(r1.enfileiradas).toBe(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).passoComercial).toBe("+24h");

    // Taxa paga → o resolver não devolve mais o candidato.
    await prisma.$transaction(tx => receberTx(tx, { cobrancaId: taxa.id, autorId: admin.id, chaveIdempotencia: `teste:${taxa.id}`, valorRecebido: TAXA, forma: FormaPagamento.PIX, dataPagamento: new Date(), evidencia: "Comprovante conferido no teste" }));
    const r2 = await rodarLinkPagamentoSemPagamento();
    expect(r2.leadsAvaliados).toBe(0);
    void matriculaId;
  });
});


describe("titularidade do fechamento (review PR #60)", () => {
  it("VENDEDOR de outra carteira não opera contrato/link; o dono opera", async () => {
    const outro = await criarUsuario([Papel.VENDEDOR], "Outro Vendedor");
    const { matriculaId, taxa } = await seedMatriculaAguardando(); // lead do `vendedor`

    authMock.mockResolvedValue({ user: { id: outro.id } });
    expect((await registrarContratoEnviado(matriculaId)).ok).toBe(false);
    expect((await marcarContratoAssinado(matriculaId)).ok).toBe(false);
    expect((await registrarLinkPagamento(taxa.id, "https://x.exemplo/1")).ok).toBe(false);
    const intocada = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
    expect(intocada.contratoOk).toBe(false);
    expect(intocada.contratoEnviadoEm).toBeNull();

    // Mesmo o dono não pode burlar a conferência documental.
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    expect((await registrarContratoEnviado(matriculaId)).ok).toBe(false);
    expect((await registrarLinkPagamento(taxa.id, "https://x.exemplo/2")).ok).toBe(true);
  });
});

describe("backfill da matrícula automática", () => {
  it("flag ligada informa bloqueio explícito e não ativa fora do fluxo seguro", async () => {
    const { matriculaId, taxa } = await seedMatriculaAguardando();
    // Tudo acontece com a automação desligada — matrícula fica presa em AGUARDANDO.
    await prisma.$transaction(tx => receberTx(tx, { cobrancaId: taxa.id, autorId: admin.id, chaveIdempotencia: `teste:${taxa.id}`, valorRecebido: TAXA, forma: FormaPagamento.PIX, dataPagamento: new Date(), evidencia: "Comprovante conferido no teste" }));
    await marcarContratoAssinado(matriculaId);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.AGUARDANDO,
    );

    // Desligada: o scanner nem roda.
    const r0 = await rodarFechamentosPendentes();
    expect(r0.executou).toBe(false);

    // Ligar a flag não autoriza o cron a pular a preparação.
    await ligarMatriculaAutomatica();
    const r1 = await rodarFechamentosPendentes();
    expect(r1).toMatchObject({ executou: false, motivoParada: "matricula_automatica_aguarda_fluxo_seguro", avaliadas: 0, ativadas: 0 });
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.AGUARDANDO,
    );
    const r2 = await rodarFechamentosPendentes();
    expect(r2.motivoParada).toBe("matricula_automatica_aguarda_fluxo_seguro");
  });
});

describe("review PR #60 rodada 2 — fechamento", () => {
  it("ativações automáticas concorrentes não contornam o fluxo seguro", async () => {
    await ligarMatriculaAutomatica();
    const { matriculaId, taxa } = await seedMatriculaAguardando();
    // Estado completo SEM disparar os gatilhos (simula dois ticks/webhooks na iminência).
    await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true } });
    await prisma.$transaction(tx => receberTx(tx, { cobrancaId: taxa.id, autorId: admin.id, chaveIdempotencia: `teste:${taxa.id}`, valorRecebido: TAXA, forma: FormaPagamento.PIX, dataPagamento: new Date(), evidencia: "Comprovante conferido no teste" }));

    const [a, b] = await Promise.all([
      prisma.$transaction((tx) => ativarSeFechamentoCompletoTx(tx, matriculaId, null)),
      prisma.$transaction((tx) => ativarSeFechamentoCompletoTx(tx, matriculaId, null)),
    ]);
    expect([a.ativou, b.ativou].filter(Boolean)).toHaveLength(0);

    const mensalidades = await prisma.cobranca.count({
      where: { matriculaId, tipo: TipoCobranca.MENSALIDADE },
    });
    expect(mensalidades).toBe(1); // sem cronograma fora da ativação segura
    const ativacoes = (await eventosDo("Matricula", matriculaId)).filter((e) => e.tipo === "MatriculaAtivada");
    expect(ativacoes).toHaveLength(0);
  });


  it("matrícula sem lead não libera o atalho documental", async () => {
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Direto", paisId: catalogo.pais.id } });
    const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: StatusMatricula.AGUARDANDO } });
    const matriculaId = matricula.id;

    const envio = await registrarContratoEnviado(matriculaId);
    expect(envio.ok).toBe(false);

    const outro = await criarUsuario([Papel.VENDEDOR], "Outro Vendedor");
    authMock.mockResolvedValue({ user: { id: outro.id } });
    expect((await marcarContratoAssinado(matriculaId)).ok).toBe(false);
  });
});
