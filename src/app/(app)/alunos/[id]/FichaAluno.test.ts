import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusAluno, TipoMovimentacao } from "@prisma/client";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/alunos/acoes", () => ({ pausarAluno: vi.fn(), encerrarAluno: vi.fn(), editarAluno: vi.fn() }));

import { FichaAluno, type AlunoFicha } from "./FichaAluno";

function aluno(proximoVencimento: AlunoFicha["financeiro"] extends infer Financeiro
  ? Financeiro extends { proximoVencimento: infer Vencimento } ? Vencimento : never
  : never): AlunoFicha {
  return {
    id: "aluno", codigo: "A-1", nome: "Ana Silva", primeiroNome: "Ana", sobrenome: "Silva", nomePreferido: null,
    status: StatusAluno.ATIVO, pais: "Costa Rica", paisId: "pais", nascimento: "2012-03-02T12:00:00.000Z",
    genero: null, tipoDocumentoId: null, documento: null, documentoValido: false, documentoPaisEmissor: null,
    nacionalidade: null, segundaNacionalidade: null, telefone: null, email: null, whatsapp: false,
    aceitaComunicacoes: false, paisResidencia: null, cep: null, rua: null, numero: null, complemento: null,
    bairro: null, cidade: null, regiao: null, escolaridade: null, idiomaNativo: null, fuso: null,
    observacoes: null, turmasAtuais: [],
    financeiro: { atrasado: false, emAberto: [{ moeda: "CRC", valor: 80 }], proximoVencimento },
    movimentacoes: [{
      id: "movimento", tipo: TipoMovimentacao.PAUSA, matriculaId: "matricula", matriculaCodigo: "M-1",
      motivo: "Pedido do responsável", observacao: null, criadoEm: "2026-01-01T02:30:00.000Z", usuario: "Secretaria",
    }],
  };
}

it("mostra o vencimento civil confirmado e a movimentação no fuso pessoal", () => {
  const html = renderToStaticMarkup(createElement(FichaAluno, {
    aluno: aluno({ estado: "CONFIRMADO", dataCivil: "2099-10-05", fuso: "Pacific/Kiritimati", origem: "EMISSAO_ENTRADA" }),
    paises: [], preferenciaFusoExibicao: "America/Costa_Rica",
  }));

  expect(html).toContain("próximo venc. 2099-10-05");
  expect(html).toContain("31/12/2025, 20:30 (horário exibido em America/Costa_Rica; origem UTC)");
  expect(html).toContain("2012-03-02");
});

it("mantém vencimento sem fonte em conferência e recorre a UTC para movimentações", () => {
  const html = renderToStaticMarkup(createElement(FichaAluno, {
    aluno: aluno({ estado: "A_CONFERIR", motivo: "Memória imutável ausente" }),
    paises: [], preferenciaFusoExibicao: null,
  }));

  expect(html).toContain("próximo venc. a conferir");
  expect(html).toContain("01/01/2026, 02:30 (horário exibido em UTC; origem UTC)");
});
