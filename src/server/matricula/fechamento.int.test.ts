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
  criarMatricula,
  marcarContratoAssinado,
  registrarContratoEnviado,
  registrarLinkPagamento,
} from "./acoes";
import { registrarPagamento } from "@/server/financeiro/acoes";
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
