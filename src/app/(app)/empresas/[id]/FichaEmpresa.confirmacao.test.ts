import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Pagar e cancelar fatura B2B (docs/42 L2281): os dois botões da linha só abrem o ConfirmarAcao, que
// repete fatura, competência, cobranças e total; só a confirmação chama a action. Inativar a empresa (fatia B,
// issue #169) também passa pela confirmação; reativar continua direto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  pagar: vi.fn(), cancelar: vi.fn(), situacao: vi.fn(), refresh: vi.fn(),
  b2bAtiva: true,
}));
// As confirmações de pagar e cancelar só existem com a cobrança de empresas ligada (D9): estes testes a religam.
vi.mock("@/lib/funcionalidades", async (original) => ({
  ...(await original<typeof import("@/lib/funcionalidades")>()),
  get COBRANCA_B2B_ATIVA() { return m.b2bAtiva; },
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => m.ganchos!.useRef(i)) as unknown as typeof real.useRef,
    useId: (() => m.ganchos!.useId()) as typeof real.useId,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/empresas/acoes", () => ({ pagarFaturaB2B: m.pagar, cancelarFaturaB2B: m.cancelar, definirSituacaoEmpresa: m.situacao }));

import { FichaEmpresa } from "./FichaEmpresa";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { clicar, criarGanchos, elementos, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";
import { MSG_COBRANCA_B2B_DESLIGADA } from "@/lib/funcionalidades";

const propsBase = {
  empresa: {
    id: "emp-1", codigo: "EMP-1", nome: "Acme", paisId: null, documento: null, contatoNome: null, contatoEmail: null,
    contatoTelefone: null, diaVencimento: 10, observacoes: null, ativo: true,
  },
  colaboradores: [],
  faturas: [{ id: "fat-1", codigo: "FAT-0031", competencia: "2026-09", moeda: "BRL", valorTotal: 8400, status: "FECHADA", vencimento: "2026-10-10T00:00:00.000Z", pagoEm: null, cobrancas: 14 }],
  produtos: [], competencias: [], podePagar: true,
};
let props = { ...propsBase };
const tela = (): ReactNode => m.ganchos!.renderizar(FichaEmpresa, props);
const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);
const sucessoDasFaturas = (t: ReactNode) => doTipo(t, FeedbackAcao)[0].props.sucesso;

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.pagar.mockResolvedValue({ ok: true, dado: { baixadas: 14 } });
  m.cancelar.mockResolvedValue({ ok: true });
  m.situacao.mockResolvedValue({ ok: true });
  props = { ...propsBase, empresa: { ...propsBase.empresa } };
  m.b2bAtiva = true;
});
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };

describe("FichaEmpresa \u2014 pagar fatura passa pela confirmação", () => {
  it("clicar não paga; a confirmação diz quantas cobranças e quanto; só confirmar paga", async () => {
    clicar(tela(), "Registrar pagamento");
    expect(m.pagar).not.toHaveBeenCalled();
    const confirmacoes = doTipo(tela(), ConfirmarAcao);
    expect(confirmacoes).toHaveLength(1);
    const [c] = confirmacoes;
    expect(c.props.titulo).toBe("Registrar o pagamento da fatura FAT-0031?");
    expect(c.props.confirmacao).toBe("pagamento da fatura");
    const resumo = (c.props.children as No[])[0];
    const consequencia = (texto((resumo.type as (p: unknown) => ReactNode)(resumo.props)) + texto((c.props.children as No[])[1])).replace(/\s+/g, " ");
    expect(consequencia).toContain("FAT-0031");
    expect(consequencia).toContain("14 cobranças");
    expect(consequencia).toContain("R$");
    expect(consequencia).toContain("As 14 cobranças da fatura são baixadas em lote");
    expect(consequencia).toContain("Não há desfazer pela tela.");
    expect(m.pagar).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.pagar).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    expect(m.pagar).toHaveBeenCalledWith("fat-1");
    expect(m.cancelar).not.toHaveBeenCalled();
    // O anúncio usa o que o SERVIDOR baixou (R1 da #154, B7), não a contagem da linha (14).
    (c.props.aoConcluir as (d: { baixadas: number } | undefined) => void)({ baixadas: 13 });
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(sucessoDasFaturas(t)).toBe("Fatura paga \u2014 13 cobranças baixadas em lote.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("FichaEmpresa \u2014 cancelar fatura passa pela confirmação", () => {
  it("o botão diz o que cancela; clicar não cancela; só confirmar cancela", async () => {
    clicar(tela(), "Cancelar fatura");
    expect(m.cancelar).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe("Cancelar a fatura FAT-0031?");
    expect(c.props.confirmacao).toBe("cancelamento da fatura");
    expect(texto((c.props.children as No[])[1]).replace(/\s+/g, " ")).toContain("as 14 cobranças voltam a ficar soltas");
    expect(m.cancelar).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.cancelar).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    expect(m.cancelar).toHaveBeenCalledWith("fat-1");
    expect(m.pagar).not.toHaveBeenCalled();
  });

  it("voltar não cancela", () => {
    clicar(tela(), "Cancelar fatura");
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
    expect(m.cancelar).not.toHaveBeenCalled();
  });
});

describe("FichaEmpresa — inativar a empresa passa pela confirmação", () => {
  it("clicar não inativa; a confirmação diz o que muda e o que fica; só confirmar inativa, uma vez", async () => {
    clicar(tela(), "Inativar empresa");
    expect(m.situacao).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe("Inativar a empresa Acme?");
    expect(c.props.confirmacao).toBe("inativação da empresa");
    expect(c.props.idempotente).toBe(true);
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Acme (EMP-1) passa a inativa.");
    expect(consequencia).toContain("Os 0 contratos individuais vinculados continuam como estão, e a fatura em aberto também: nada é cancelado nem baixado.");
    expect(consequencia).toContain("Reativar empresa");
    expect(m.situacao).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.situacao).toHaveBeenCalledTimes(1);
    expect(m.situacao).toHaveBeenCalledWith("emp-1", false);
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(doTipo(t, FeedbackAcao).map((n: No) => n.props.sucesso)).toContain("Empresa inativada.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("voltar não inativa", () => {
    clicar(tela(), "Inativar empresa");
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
    expect(m.situacao).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo, que continua aberto", async () => {
    clicar(tela(), "Inativar empresa");
    m.situacao.mockResolvedValueOnce({ ok: false, erro: "Empresa não encontrada." });
    expect(await confirmarNoDialogo(doTipo(tela(), ConfirmarAcao)[0], usar)).toEqual({ erro: "Empresa não encontrada.", confirmarDisponivel: true });
    m.situacao.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(doTipo(tela(), ConfirmarAcao)[0], usar)).erro).toBe(MSG_RESULTADO_INCERTO);
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("reativar continua direto, com o estado-alvo explícito", async () => {
    props = { ...propsBase, empresa: { ...propsBase.empresa, ativo: false } };
    await clicar(tela(), "Reativar empresa");
    expect(m.situacao).toHaveBeenCalledWith("emp-1", true);
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
  });
});

describe("FichaEmpresa — vencimento da fatura é data civil (C52 da #170)", () => {
  it("mostra o dia gravado, mesmo num navegador em UTC−3", () => {
    // O vencimento chega como ISO à meia-noite UTC; com toLocaleDateString, em São Paulo, 10/10 virava 09/10.
    const anterior = process.env.TZ;
    process.env.TZ = "America/Sao_Paulo";
    try {
      const t = texto(tela());
      expect(t).toContain("10/10/2026");
      expect(t).not.toContain("09/10/2026");
    } finally {
      if (anterior === undefined) delete process.env.TZ;
      else process.env.TZ = anterior;
    }
  });
});

describe("FichaEmpresa — cobrança de empresas desligada (D9)", () => {
  it("as faturas antigas continuam listadas, sem registrar pagamento, e um aviso diz por quê", () => {
    m.b2bAtiva = false;
    const t = tela();
    const tudo = texto(t);
    expect(tudo).toContain("FAT-0031"); // a fatura histórica segue para consulta
    expect(tudo).not.toContain("Registrar pagamento");
    expect(tudo).toContain(MSG_COBRANCA_B2B_DESLIGADA);
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(m.pagar).not.toHaveBeenCalled();
  });

  it("cancelar a fatura fechada continua, pela confirmação (R1 do #251, B1)", async () => {
    m.b2bAtiva = false;
    clicar(tela(), "Cancelar fatura");
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe("Cancelar a fatura FAT-0031?");
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.cancelar).toHaveBeenCalledWith("fat-1");
  });

  it("inativar e reativar a empresa não dependem da cobrança de empresas", () => {
    m.b2bAtiva = false;
    expect(texto(tela())).toContain("Inativar empresa");
  });

  it("religada, as ações voltam", () => {
    m.b2bAtiva = true;
    const tudo = texto(tela());
    expect(tudo).toContain("Registrar pagamento");
    expect(tudo).toContain("Cancelar fatura");
    expect(tudo).not.toContain(MSG_COBRANCA_B2B_DESLIGADA);
  });
});
