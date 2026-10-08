import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2: erro e sucesso separados na preparação (conferir e salvar
// rascunho) e na decisão do fechamento de horas — erro em role="alert", sucesso em role="status", falha
// de rede como resultado incerto e o formulário saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  decidir: vi.fn(), consultar: vi.fn(), salvar: vi.fn(), refresh: vi.fn(), push: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: m.push }) }));
vi.mock("@/server/matricula/fechamento-horas-decisao", () => ({ decidirFechamentoHoras: m.decidir }));
vi.mock("@/server/matricula/fechamento-horas-consulta", () => ({ consultarFechamentosHoras: m.consultar }));
vi.mock("@/server/matricula/fechamento-horas-rascunho", () => ({ prepararFechamentoHoras: m.salvar }));

import { DecidirFechamento } from "./DecidirFechamento";
import { PrepararFechamento } from "./PrepararFechamento";
import { formatarDataCivil } from "@/lib/data-civil";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { adiada, anuncios, contratoFeedbackSeparado, novosAnuncios } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.resetAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const rotuloDoBotao = (t: ReactNode) => texto(elementos(t).find((n) => n.type === "button")!.props.children);
/** Escolhe o valor do primeiro <select> controlado (o onChange recebe o evento nativo). */
const escolher = (t: ReactNode, valor: string) =>
  (elementos(t).find((n) => n.type === "select" && typeof n.props.onChange === "function")!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });

describe("DecidirFechamento", () => {
  const tela = () => m.ganchos!.renderizar(DecidirFechamento, { alunoId: "a", matriculaId: "m", rascunhoId: "r" });
  contratoFeedbackSeparado({
    nome: "registrar decisão do fechamento", preparar: () => escolher(tela(), "REJEITAR"), tela, action: m.decidir,
    acionar: () => submeter(tela(), { motivo: "Período divergente do contrato" }),
    sucesso: "Decisão registrada. Nenhuma cobrança emitida.", incerto: MSG_DECISAO_INCERTA,
    ocupado: () => rotuloDoBotao(tela()) === "Registrando…" && elementos(tela()).find((n) => n.type === "fieldset")?.props.disabled === true,
  });

  it("envia a decisão escolhida e atualiza a tela só no sucesso", async () => {
    escolher(tela(), "APROVAR");
    m.decidir.mockResolvedValueOnce({ ok: false, erro: "Origens mudaram" });
    await submeter(tela(), { referencia: "on", motivo: "Conferido no contrato" });
    expect(m.refresh).not.toHaveBeenCalled();
    m.decidir.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), { referencia: "on", motivo: "Conferido no contrato" });
    expect(m.decidir.mock.calls[1][0]).toEqual({ alunoId: "a", matriculaId: "m", rascunhoId: "r", aprovar: true, confirmaReferenciaContratual: true, motivo: "Conferido no contrato" });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("PrepararFechamento", () => {
  const tela = () => m.ganchos!.renderizar(PrepararFechamento, { alunoId: "a", matriculaId: "m" });
  const valores = { data: "2026-10-15", fuso: "America/Sao_Paulo", vencimento: "2026-11-10", clausula: "Cláusula 7", escolha: "AGUARDAR", motivo: "Fechamento de outubro" };
  const consultaOk = { ok: true, dado: { matricula: { contratoDocumentoId: "doc" }, preparacao: { versaoAnterior: 2, periodo: { inicio: "2026-10-01", fim: "2026-10-31", fuso: "America/Sao_Paulo", vencimento: "2026-11-10" } } } };
  const previa = `Período de ${formatarDataCivil("2026-10-01")} a ${formatarDataCivil("2026-10-31")}, em America/Sao_Paulo. Vencimento: ${formatarDataCivil("2026-11-10")}. Será criada a versão 3. Confira antes de salvar.`;
  const conferir = () => { escolher(tela(), "MES_CIVIL"); return submeter(tela(), valores); };

  contratoFeedbackSeparado({
    nome: "conferir período e versão", preparar: () => escolher(tela(), "MES_CIVIL"), tela, action: m.consultar,
    acionar: () => submeter(tela(), valores), respostaOk: consultaOk,
    sucesso: previa, incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => rotuloDoBotao(tela()) === "Conferindo…" && elementos(tela()).find((n) => n.type === "fieldset")?.props.disabled === true,
  });

  it("contrato ou referência indisponível na conferência é erro em role=\"alert\"", async () => {
    const antes = anuncios(tela());
    m.consultar.mockResolvedValueOnce({ ok: true, dado: { matricula: { contratoDocumentoId: null }, preparacao: null } });
    await conferir();
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Contrato ou referência indisponível para preparação."], status: [] });
    expect(rotuloDoBotao(tela())).toBe("Conferir período e versão");
  });

  describe("salvar rascunho conferido", () => {
    beforeEach(async () => {
      m.consultar.mockResolvedValueOnce(consultaOk);
      await conferir();
      expect(rotuloDoBotao(tela())).toBe("Salvar rascunho do período conferido");
    });

    it("sucesso sai em role=\"status\", sem alerta, e abre a versão salva", async () => {
      const antes = anuncios(tela());
      m.salvar.mockResolvedValueOnce({ ok: true, dado: { id: "rascunho-1" } });
      await submeter(tela(), valores);
      expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: [], status: ["Rascunho salvo; nenhuma cobrança emitida."] });
      expect(m.push).toHaveBeenCalledWith("/matriculas/m/fechamentos-horas?aluno=a&versao=rascunho-1");
      expect(m.refresh).toHaveBeenCalledTimes(1);
    });

    it("erro do servidor sai em role=\"alert\" e volta à conferência", async () => {
      m.salvar.mockResolvedValueOnce({ ok: false, erro: "Origens mudaram; confira de novo." });
      await submeter(tela(), valores);
      expect(anuncios(tela())).toEqual({ alerta: ["Origens mudaram; confira de novo."], status: [] });
      expect(rotuloDoBotao(tela())).toBe("Conferir período e versão");
      expect(m.push).not.toHaveBeenCalled();
    });

    it("resposta sem o rascunho salvo é erro em role=\"alert\"", async () => {
      m.salvar.mockResolvedValueOnce({ ok: true });
      await submeter(tela(), valores);
      expect(anuncios(tela())).toEqual({ alerta: ["Resultado indisponível."], status: [] });
      expect(m.push).not.toHaveBeenCalled();
    });

    it("falha de rede vira resultado incerto em role=\"alert\" e o reenvio usa a mesma chave", async () => {
      m.salvar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      await submeter(tela(), valores);
      expect(anuncios(tela())).toEqual({ alerta: [MSG_RESULTADO_INCERTO], status: [] });
      expect(rotuloDoBotao(tela())).toBe("Salvar rascunho do período conferido");
      m.salvar.mockResolvedValueOnce({ ok: true, dado: { id: "rascunho-1" } });
      await submeter(tela(), valores);
      expect(m.salvar.mock.calls[1][0]).toEqual(m.salvar.mock.calls[0][0]);
      expect(m.salvar.mock.calls[0][0]).toMatchObject({ alunoId: "a", matriculaId: "m", documentoId: "doc", versaoAnterior: 2, escolha: "AGUARDAR" });
    });

    it("ocupado enquanto salva; sai do ocupado depois", async () => {
      const pendente = adiada<unknown>();
      m.salvar.mockReturnValueOnce(pendente.promessa);
      const execucao = submeter(tela(), valores);
      expect(rotuloDoBotao(tela())).toBe("Conferindo…");
      pendente.resolver({ ok: true, dado: { id: "rascunho-1" } });
      await execucao;
      expect(rotuloDoBotao(tela())).not.toBe("Conferindo…");
    });
  });
});
