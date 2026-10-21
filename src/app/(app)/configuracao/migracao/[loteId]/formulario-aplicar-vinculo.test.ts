import { describe, expect, it } from "vitest";
import {
  ensaioVigenteMaisRecente,
  exigeComplementoVigencia,
  montarPayloadAplicarVinculo,
  validarFormularioVinculo,
  type EnsaioVinculoExibido,
  type FormularioVinculo,
} from "./formulario-aplicar-vinculo";

const hash = "a".repeat(64);
const ensaio: EnsaioVinculoExibido = {
  id: "ensaio-atual", entradaHash: hash, contextoHash: "b".repeat(64), resultado: "PRONTO_PARA_REVISAO", vigente: true,
  criadoEm: new Date("2026-09-16T12:00:00Z"), ensaiadoPor: { nome: "Admin" },
};
const formulario: FormularioVinculo = {
  fusoReferencia: "America/Costa_Rica", inicioAlocacao: "2025-01-01", fimAlocacao: "", semanticaFim: "LIMITE_EXCLUSIVO",
  diaVencimento: "10", mesesPlano: "9", evidenciaContrato: "contrato legado", evidenciaPagamento: "comprovante legado",
  motivoComplemento: "", evidenciaComplemento: "",
  fatos: [{ tipo: "ATIVACAO", data: "2025-01-01", evidencia: "planilha de matrícula" }],
};
const origem = { alocacao: { inicio: "2025-01-01" } };

describe("formulário da aplicação de vínculo migrado", () => {
  it("oferece somente o último ensaio pronto, vigente e da fotografia", () => {
    const antigoPronto: EnsaioVinculoExibido = { ...ensaio, id: "antigo", criadoEm: new Date("2026-09-15T12:00:00Z") };
    expect(ensaioVigenteMaisRecente([ensaio, antigoPronto], hash)).toEqual(ensaio);
    expect(ensaioVigenteMaisRecente([{ ...ensaio, vigente: false }, antigoPronto], hash)).toBeNull();
    expect(ensaioVigenteMaisRecente([{ ...ensaio, resultado: "COM_PENDENCIAS" }, antigoPronto], hash)).toBeNull();
    expect(ensaioVigenteMaisRecente([{ ...ensaio, entradaHash: "c".repeat(64) }], hash)).toBeNull();
  });

  it("monta o payload com hashes do ensaio selecionado, fuso explícito e fim nulo sem inventar semântica", () => {
    expect(validarFormularioVinculo(formulario, origem, "ATIVA")).toEqual([]);
    expect(montarPayloadAplicarVinculo({ linhaId: "linha-1", entradaHash: hash, ensaio, formulario })).toEqual({
      linhaId: "linha-1", ensaioId: "ensaio-atual", entradaHash: hash, contextoHash: "b".repeat(64),
      fusoReferencia: "America/Costa_Rica", semanticaFim: "LIMITE_EXCLUSIVO", inicioAlocacao: "2025-01-01", fimAlocacao: null,
      diaVencimento: 10, mesesPlano: 9, evidenciaContrato: { referencia: "contrato legado" }, evidenciaPagamento: { referencia: "comprovante legado" },
      fatos: [{ tipo: "ATIVACAO", data: "2025-01-01", evidencia: { referencia: "planilha de matrícula" } }],
    });
  });

  it("exige complemento completo para vigência incompleta ou diferente da fotografia", () => {
    const diferente = { ...formulario, fimAlocacao: "2025-02-01" };
    expect(exigeComplementoVigencia(origem, diferente.inicioAlocacao, diferente.fimAlocacao)).toBe(true);
    expect(validarFormularioVinculo(diferente, origem, "ATIVA")).toContain("A vigência difere da fotografia; informe motivo e evidência do complemento.");
    const completo = { ...diferente, motivoComplemento: "Fonte informa encerramento comprovado", evidenciaComplemento: "ata da turma" };
    expect(validarFormularioVinculo(completo, origem, "ATIVA")).toEqual([]);
    expect(montarPayloadAplicarVinculo({ linhaId: "linha-1", entradaHash: hash, ensaio, formulario: completo }).complementoVigencia).toEqual({
      motivo: "Fonte informa encerramento comprovado", evidencia: { referencia: "ata da turma" },
    });
  });

  it("impede envio com campos explícitos ausentes, complemento parcial ou fato final incompatível", () => {
    const invalido = { ...formulario, fusoReferencia: "", semanticaFim: "" as const, diaVencimento: "32", mesesPlano: "0", evidenciaContrato: "", evidenciaPagamento: "", motivoComplemento: "motivo suficiente", fatos: [{ tipo: "PAUSA" as const, data: "", evidencia: "" }] };
    expect(validarFormularioVinculo(invalido, origem, "ATIVA")).toEqual(expect.arrayContaining([
      "Informe o fuso IANA de referência.", "Escolha a semântica do fim da vigência.", "Informe o dia de vencimento entre 1 e 31.",
      "Informe a quantidade de meses do plano.", "Informe a evidência do contrato.", "Informe a evidência do pagamento.",
      "Informe a data do fato 1.", "Informe a evidência do fato 1.", "O último fato precisa comprovar a situação de destino.",
      "Informe motivo e evidência do complemento de vigência juntos.",
    ]));
  });

  it("rejeita fuso e evidências compostos somente de espaços e exige fim para situação encerrada", () => {
    const encerrada = {
      ...formulario, fusoReferencia: " America/No_Existe ", evidenciaContrato: "   ", evidenciaPagamento: "\t",
      fatos: [{ tipo: "ENCERRAMENTO" as const, data: "2025-01-01", evidencia: "   " }],
    };
    expect(validarFormularioVinculo(encerrada, origem, "ENCERRADA")).toEqual(expect.arrayContaining([
      "Informe um fuso IANA válido.", "Informe a evidência do contrato.", "Informe a evidência do pagamento.",
      "Informe a evidência do fato 1.", "A situação encerrada exige fim de vigência comprovado.",
    ]));
  });

  it("aceita o mesmo dia somente quando ele é o último dia coberto", () => {
    const ultimoDia = { ...formulario, fimAlocacao: "2025-01-01", semanticaFim: "ULTIMO_DIA_COBERTO" as const };
    expect(validarFormularioVinculo(ultimoDia, { alocacao: { inicio: "2025-01-01", fim: "2025-01-01" } }, "ATIVA")).toEqual([]);
    const exclusivo = { ...ultimoDia, semanticaFim: "LIMITE_EXCLUSIVO" as const };
    expect(validarFormularioVinculo(exclusivo, { alocacao: { inicio: "2025-01-01", fim: "2025-01-01" } }, "ATIVA")).toContain("O limite exclusivo precisa ser posterior ao início.");
  });

  it("rejeita datas civis normalizadas silenciosamente, inclusive nos fatos", () => {
    const invalida = { ...formulario, inicioAlocacao: "2025-02-31", fatos: [{ tipo: "ATIVACAO" as const, data: "2025-02-31", evidencia: "fonte" }] };
    expect(validarFormularioVinculo(invalida, origem, "ATIVA")).toEqual(expect.arrayContaining([
      "Informe o início da vigência.", "Informe a data do fato 1.",
    ]));
  });
});
