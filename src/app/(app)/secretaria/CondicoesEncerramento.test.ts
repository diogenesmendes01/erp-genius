import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/matricula/condicoes-encerramento", () => ({
  prepararCondicoesEncerramento: vi.fn(),
  decidirCondicoesEncerramento: vi.fn(),
}));

import { CondicoesEncerramento } from "./CondicoesEncerramento";

const regras = {
  diaEncerramento: "EXCLUIR",
  metodoDesconto: "ANTES_DO_PROPORCIONAL",
  condicoesDescontos: "Condição contratual conferida.",
  multa: { tipo: "SEM_PREVISAO", motivo: "Não há multa prevista." },
};

const comum = {
  matriculaId: "matricula-1",
  codigo: "MAT-246",
  autorId: "secretaria-1",
  administrador: true,
  cobrancas: [{ id: "cobranca-1", codigo: "MEN-001", tipo: "MENSALIDADE" }],
};
const renderizar = (props: Parameters<typeof CondicoesEncerramento>[0]) => renderToStaticMarkup(createElement(CondicoesEncerramento, props));

describe("Condições de encerramento", () => {
  it("preserva a fonte documental confirmada", () => {
    const html = renderizar({ ...comum, documentoId: "documento-1", fontesOriginaisEnviados: [], versoes: [
      { id: "versao-1", versao: 1, status: "APROVADA", regras, motivo: "Transcrição do contrato.", motivoDecisao: "Conferência independente.", preparadorId: "outra-secretaria", documento: { nome: "Contrato confirmado", url: "/api/files/contrato.pdf" }, artefatoContratual: null, processoAssinatura: null, preparador: { nome: "Secretaria" }, decisor: { nome: "Administração" } },
    ] });

    expect(html).toContain("Contrato confirmado: Contrato confirmado");
    expect(html).toContain('href="/api/files/contrato.pdf"');
    expect(html).toContain("Fonte: contrato confirmado da matrícula.");
  });

  it("oferece somente original com envio confirmado à matrícula em preparação", () => {
    const html = renderizar({ ...comum, documentoId: null, fontesOriginaisEnviados: [{ processoAssinaturaId: "processo-enviado", artefatoContratualId: "artefato-1" }], versoes: [] });

    expect(html).toContain("Original enviado com confirmação externa");
    expect(html).toContain('value="processo-enviado"');
    expect(html).toContain("Regra de acerto por desistência antes da ativação");
    expect(html).toContain("Selecione a regra Q165");
    expect(html).not.toContain("Confirme o contrato antes");
  });

  it("preserva o acerto já aprovado após cancelamento da fonte", () => {
    const html = renderizar({ ...comum, documentoId: null, fontesOriginaisEnviados: [], versoes: [
      { id: "versao-cancelada", versao: 2, status: "APROVADA", regras: { ...regras, acertoDesistenciaPreparacao: { tipo: "VALOR_FIXO", valor: "80", clausulaId: "7.2", condicoesAplicacao: { momento: "ANTES_ATIVACAO", unidade: "POR_COBRANCA", alcance: { tipo: "COBRANCAS_IDENTIFICADAS", cobrancaIds: ["cobranca-1"] } } } }, motivo: "Condição do original enviado.", motivoDecisao: "Conferência independente.", preparadorId: "outra-secretaria", documento: null, artefatoContratual: { id: "artefato-1" }, processoAssinatura: { id: "processo-cancelado", estado: "CANCELADO", envioConfirmado: true, conclusaoRegistrada: false }, preparador: { nome: "Secretaria" }, decisor: { nome: "Administração" } },
    ] });

    expect(html).toContain("Original enviado foi cancelado; a versão aprovada permanece como evidência do acerto.");
    expect(html).toContain("Acerto Q165 antes da ativação: 80,00 fixo; cláusula 7.2; alcance cobranças: MEN-001 (Mensalidade).");
  });
});
