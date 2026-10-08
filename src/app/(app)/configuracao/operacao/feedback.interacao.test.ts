import { afterEach, beforeEach, describe, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (achado Alta L2457): erro e sucesso separados nos prazos
// e nos avisos do diário — erro em role="alert", sucesso em role="status", falha de rede como resultado
// incerto e o botão saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  prazosPortal: vi.fn(), prazosEntrega: vi.fn(), avisos: vi.fn(),
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
vi.mock("@/server/portal-aluno/configuracao", () => ({ salvarPrazosPortalAluno: m.prazosPortal, salvarPrazosEntregaReposicao: m.prazosEntrega }));
vi.mock("@/server/diario/avisos-pendencias-diario", () => ({ salvarConfiguracaoAvisosDiario: m.avisos }));

import { PrazosPortalFormulario } from "./PrazosPortalFormulario";
import { PrazosEntregaReposicaoFormulario } from "./PrazosEntregaReposicaoFormulario";
import { AvisosDiarioFormulario } from "./avisos-diario/AvisosDiarioFormulario";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

/** "Salvando…" no botão e o fieldset travado: os dois sinais do ocupado destas telas. */
const ocupadoEm = (t: ReactNode) => {
  const botao = elementos(t).find((n) => n.type === "button");
  const fieldset = elementos(t).find((n) => n.type === "fieldset");
  return texto(botao?.props.children) === "Salvando…" && fieldset?.props.disabled === true;
};

describe("PrazosPortalFormulario", () => {
  const valores = { prazoSessaoPortalAlunoMinutos: 60, prazoConvitePortalAlunoMinutos: 1440, prazoRecuperacaoPortalAlunoMinutos: 30, prazoValidacaoEmailPortalAlunoMinutos: 60 };
  const tela = () => m.ganchos!.renderizar(PrazosPortalFormulario, { valores });
  contratoFeedbackSeparado({
    nome: "salvar prazos do portal", tela, action: m.prazosPortal,
    acionar: () => submeter(tela(), { prazoSessaoPortalAlunoMinutos: "60", prazoConvitePortalAlunoMinutos: "1440", prazoRecuperacaoPortalAlunoMinutos: "30", prazoValidacaoEmailPortalAlunoMinutos: "60" }),
    sucesso: "Prazos salvos para novas sessões e novos links.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => ocupadoEm(tela()),
  });
});

describe("PrazosEntregaReposicaoFormulario", () => {
  const valores = { prazoPrimeiraEntregaReposicaoMinutos: 120, prazoRespostaCorrecaoReposicaoMinutos: 60 };
  const tela = () => m.ganchos!.renderizar(PrazosEntregaReposicaoFormulario, { valores });
  contratoFeedbackSeparado({
    nome: "salvar prazos de reposição", tela, action: m.prazosEntrega,
    acionar: () => submeter(tela(), { prazoPrimeiraEntregaReposicaoMinutos: "120", prazoRespostaCorrecaoReposicaoMinutos: "60" }),
    sucesso: "Prazos salvos para novas disponibilizações e novos pedidos de correção.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => ocupadoEm(tela()),
  });
});

describe("AvisosDiarioFormulario", () => {
  const valores = { prazoRegularizacaoDiarioMinutos: 1440, intervaloLembreteDiarioMinutos: 240 };
  const tela = () => m.ganchos!.renderizar(AvisosDiarioFormulario, { valores });
  contratoFeedbackSeparado({
    nome: "salvar avisos do diário", tela, action: m.avisos,
    acionar: () => submeter(tela(), { prazoRegularizacaoDiarioMinutos: "1440", intervaloLembreteDiarioMinutos: "240" }),
    sucesso: "Avisos do diário configurados.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => ocupadoEm(tela()),
  });
});
