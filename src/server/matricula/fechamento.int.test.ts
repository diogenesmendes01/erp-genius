import { describe, it, expect, beforeEach, vi } from "vitest";
import { EtapaLead, Papel, StatusCobranca, StatusMatricula, TipoCobranca } from "@prisma/client";

// C4 (doc 27 §fechamento): contrato + link de pagamento como estado auditável, réguas de
// fechamento no motor comercial e MATRÍCULA AUTOMÁTICA (contrato OK + taxa PAGA → ativa,
// com turma SUGERIDA — nunca alocada — quando existe compatível com vaga).

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo, eventosDo } from "@/test/integracao";
import {
  ativarSeFechamentoCompletoTx,
  criarMatricula,
  marcarContratoAssinado,
  registrarContratoEnviado,
  registrarLinkPagamento,
} from "./acoes";
import { registrarPagamento } from "@/server/financeiro/acoes";
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
  const r = await criarMatricula({
    leadId: lead.id,
    alunoPrimeiroNome: "Paula",
    alunoSobrenome: "Mora",
    alunoGenero: "NAO_INFORMADO",
    alunoNascimento: "1992-02-02",
    alunoPaisId: catalogo.pais.id,
    alunoTipoDocumentoId: catalogo.pais.tiposDocumento[0].id,
    alunoDocumento: "1-1111-1111",
    alunoNacionalidade: "CR",
    alunoEmail: "paula@teste.cr",
    alunoTelefone: "88886666",
    alunoWhatsapp: true,
    alunoAceitaComunicacoes: true,
    alunoPaisResidencia: "CR",
    pagador: "ALUNO",
    produtoId: catalogo.produto.id,
    taxaValor: TAXA,
    mensalidadeValor: MENSALIDADE,
    comissaoPct: 10,
    diaVencimento: 5,
    mesesPlano: 3,
  });
  if (!r.ok) throw new Error(`criarMatricula falhou: ${(r as { erro?: string }).erro}`);
  const matriculaId = r.dado!.id;
  const taxa = await prisma.cobranca.findFirstOrThrow({
    where: { matriculaId, tipo: TipoCobranca.MATRICULA },
  });
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
  it("registrarContratoEnviado grava a âncora + evento; reenvio atualiza", async () => {
    const { matriculaId } = await seedMatriculaAguardando();

    const r1 = await registrarContratoEnviado(matriculaId);
    expect(r1.ok).toBe(true);
    const m1 = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
    expect(m1.contratoEnviadoEm).not.toBeNull();

    const r2 = await registrarContratoEnviado(matriculaId);
    expect(r2.ok).toBe(true);
    const m2 = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
    expect(m2.contratoEnviadoEm!.getTime()).toBeGreaterThanOrEqual(m1.contratoEnviadoEm!.getTime());
    const eventos = (await eventosDo("Matricula", matriculaId)).filter((e) => e.tipo === "ContratoEnviado");
    expect(eventos).toHaveLength(2);
    expect((eventos[1].payload as { reenvio?: boolean }).reenvio).toBe(true);
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

describe("matrícula automática (contrato OK + taxa PAGA)", () => {
  it("assinatura chega DEPOIS do pagamento → ativa na hora (cronograma + comissão + lead)", async () => {
    await ligarMatriculaAutomatica();
    const { lead, matriculaId, taxa } = await seedMatriculaAguardando();

    // 1º gatilho: taxa paga (baixa manual do financeiro) — contrato ainda pendente: NÃO ativa.
    const baixa = await registrarPagamento(taxa.id, { valorRecebido: TAXA, forma: "TRANSFERENCIA", comprovanteUrl: "uploads/comprovante-teste.pdf" });
    expect(baixa.ok, baixa.ok ? "" : `baixa falhou: ${(baixa as { erro?: string }).erro}`).toBe(true);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.AGUARDANDO,
    );

    // 2º gatilho: contrato assinado → fechamento completo → ATIVA sem clique de ativação.
    const r = await marcarContratoAssinado(matriculaId);
    expect(r.ok).toBe(true);

    const matricula = await prisma.matricula.findUniqueOrThrow({
      where: { id: matriculaId },
      include: { cobrancas: true, comissoes: true },
    });
    expect(matricula.status).toBe(StatusMatricula.ATIVA);
    expect(matricula.contratoOk).toBe(true);
    // Cronograma completo: 3 mensalidades (1ª + meses 2..3).
    expect(matricula.cobrancas.filter((c) => c.tipo === TipoCobranca.MENSALIDADE)).toHaveLength(3);
    expect(matricula.comissoes[0].status).toBe("APROVADA");
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).etapa).toBe(EtapaLead.MATRICULADO);

    const ativacao = (await eventosDo("Matricula", matriculaId)).find((e) => e.tipo === "MatriculaAtivada");
    expect((ativacao?.payload as { lastro?: string }).lastro).toBe("FECHAMENTO_AUTOMATICO");
  });

  it("pagamento chega DEPOIS da assinatura → a baixa da taxa ativa", async () => {
    await ligarMatriculaAutomatica();
    const { matriculaId, taxa } = await seedMatriculaAguardando();

    await marcarContratoAssinado(matriculaId);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.AGUARDANDO,
    );

    const baixa = await registrarPagamento(taxa.id, { valorRecebido: TAXA, forma: "TRANSFERENCIA", comprovanteUrl: "uploads/comprovante-teste.pdf" });
    expect(baixa.ok).toBe(true);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.ATIVA,
    );
  });

  it("config DESLIGADA (default) → fechamento completo NÃO ativa sozinho", async () => {
    const { matriculaId, taxa } = await seedMatriculaAguardando();
    await registrarPagamento(taxa.id, { valorRecebido: TAXA, forma: "TRANSFERENCIA", comprovanteUrl: "uploads/comprovante-teste.pdf" });
    await marcarContratoAssinado(matriculaId);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.AGUARDANDO,
    );
  });

  it("auto-alocação HÍBRIDA: ativação sugere turma compatível com vaga (evento), sem alocar", async () => {
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
    await registrarPagamento(taxa.id, { valorRecebido: TAXA, forma: "TRANSFERENCIA", comprovanteUrl: "uploads/comprovante-teste.pdf" });
    await marcarContratoAssinado(matriculaId);

    const sugestao = (await eventosDo("Matricula", matriculaId)).find((e) => e.tipo === "TurmaSugerida");
    expect((sugestao?.payload as { turmaId?: string }).turmaId).toBe(turma.id);
    // HÍBRIDA de verdade: nada foi alocado — o consultor confirma na ficha do aluno.
    expect(await prisma.alocacaoTurma.count()).toBe(0);
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
    await prisma.cobranca.update({ where: { id: taxa.id }, data: { status: StatusCobranca.PAGO } });
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

    // O DONO do lead consegue.
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    expect((await registrarContratoEnviado(matriculaId)).ok).toBe(true);
    expect((await registrarLinkPagamento(taxa.id, "https://x.exemplo/2")).ok).toBe(true);
  });
});

describe("backfill da matrícula automática (review PR #60)", () => {
  it("fechamento completo com a config DESLIGADA ativa no 1º tick após ligar", async () => {
    const { matriculaId, taxa } = await seedMatriculaAguardando();
    // Tudo acontece com a automação desligada — matrícula fica presa em AGUARDANDO.
    await registrarPagamento(taxa.id, { valorRecebido: TAXA, forma: "TRANSFERENCIA", comprovanteUrl: "uploads/comprovante-teste.pdf" });
    await marcarContratoAssinado(matriculaId);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.AGUARDANDO,
    );

    // Desligada: o scanner nem roda.
    const r0 = await rodarFechamentosPendentes();
    expect(r0.executou).toBe(false);

    // Liga a config → o tick seguinte ativa (idempotente: o 2º tick não encontra nada).
    await ligarMatriculaAutomatica();
    const r1 = await rodarFechamentosPendentes();
    expect(r1.ativadas).toBe(1);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe(
      StatusMatricula.ATIVA,
    );
    const r2 = await rodarFechamentosPendentes();
    expect(r2.avaliadas).toBe(0);
  });
});

describe("review PR #60 rodada 2 — fechamento", () => {
  it("ativações CONCORRENTES da mesma matrícula: claim FOR UPDATE — só uma ativa, cronograma único", async () => {
    await ligarMatriculaAutomatica();
    const { matriculaId, taxa } = await seedMatriculaAguardando();
    // Estado completo SEM disparar os gatilhos (simula dois ticks/webhooks na iminência).
    await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true } });
    await prisma.cobranca.update({ where: { id: taxa.id }, data: { status: StatusCobranca.PAGO } });

    const [a, b] = await Promise.all([
      prisma.$transaction((tx) => ativarSeFechamentoCompletoTx(tx, matriculaId, null)),
      prisma.$transaction((tx) => ativarSeFechamentoCompletoTx(tx, matriculaId, null)),
    ]);
    expect([a.ativou, b.ativou].filter(Boolean)).toHaveLength(1); // o 2º espera o lock e relê ATIVA

    const mensalidades = await prisma.cobranca.count({
      where: { matriculaId, tipo: TipoCobranca.MENSALIDADE },
    });
    expect(mensalidades).toBe(3); // mesesPlano=3 — NADA duplicado
    const ativacoes = (await eventosDo("Matricula", matriculaId)).filter((e) => e.tipo === "MatriculaAtivada");
    expect(ativacoes).toHaveLength(1);
  });

  it("cronograma tem defesa no BANCO: 2ª cobrança viva na mesma matrícula×tipo×competência é rejeitada", async () => {
    const { matriculaId } = await seedMatriculaAguardando();
    // Competência LONGE do cronograma real da matrícula (que já ocupa os meses vizinhos).
    const base = {
      matriculaId,
      tipo: TipoCobranca.MENSALIDADE,
      competencia: "2027-05",
      valorOriginal: MENSALIDADE,
      valorNegociado: MENSALIDADE,
      moeda: "CRC",
      vencimento: new Date(2027, 4, 5),
    };
    await prisma.cobranca.create({ data: { ...base, status: StatusCobranca.CANCELADA } });
    await prisma.cobranca.create({ data: { ...base, status: StatusCobranca.PENDENTE } }); // reemissão OK
    await expect(prisma.cobranca.create({ data: { ...base, status: StatusCobranca.PENDENTE } })).rejects.toThrow(); // 2ª viva não
  });

  it("matrícula SEM lead (fluxo direto): o vendedor CRIADOR fecha; outro vendedor não", async () => {
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    const r = await criarMatricula({
      alunoPrimeiroNome: "Direto",
      alunoSobrenome: "SemLead",
      alunoGenero: "NAO_INFORMADO",
      alunoNascimento: "1990-01-01",
      alunoPaisId: catalogo.pais.id,
      alunoTipoDocumentoId: catalogo.pais.tiposDocumento[0].id,
      alunoDocumento: "1-3333-3333",
      alunoNacionalidade: "CR",
      alunoEmail: "direto@teste.cr",
      alunoTelefone: "88880000",
      alunoWhatsapp: true,
      alunoAceitaComunicacoes: true,
      alunoPaisResidencia: "CR",
      pagador: "ALUNO",
      produtoId: catalogo.produto.id,
      taxaValor: TAXA,
      mensalidadeValor: MENSALIDADE,
      comissaoPct: 10,
      diaVencimento: 5,
      mesesPlano: 3,
    });
    expect(r.ok, r.ok ? "" : `criar falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    const matriculaId = r.ok ? r.dado!.id : "";

    // O dono é quem leva a comissão (o criador) — a rodada 2 apontou o "sempre negado" aqui.
    const envio = await registrarContratoEnviado(matriculaId);
    expect(envio.ok, envio.ok ? "" : `envio falhou: ${(envio as { erro?: string }).erro}`).toBe(true);

    const outro = await criarUsuario([Papel.VENDEDOR], "Outro Vendedor");
    authMock.mockResolvedValue({ user: { id: outro.id } });
    expect((await marcarContratoAssinado(matriculaId)).ok).toBe(false);
  });
});
