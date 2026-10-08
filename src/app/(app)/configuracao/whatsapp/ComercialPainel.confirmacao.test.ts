import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigComercialView } from "@/server/comercial/consultas";

// Saudação automática e alertas do gestor (docs/42 L2517): passar para "Ativa — envia" só abre o
// ConfirmarAcao, com o texto que sai, para quem e por qual número; salvar sem ativar continua direto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  salvar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/comercial/acoes", () => ({ salvarConfigComercial: m.salvar }));

import { ComercialPainel } from "./ComercialPainel";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { clicar, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const configBase: ConfigComercialView = {
  autoLeadAtivo: false, saudacaoEstado: "SHADOW", saudacaoTexto: "Olá! Já retornamos.", copilotoAtivo: false, copilotoQuietudeMinutos: 10,
  matriculaAutomaticaAtiva: false, gestaoEstado: "DESLIGADA", gestaoTelefoneE164: "+5511988887777", gestaoNumeroId: "v1", gestaoSlaMinutos: 30, gestaoRelatorioHora: 19,
};
let config: ConfigComercialView;
const tela = (): ReactNode => m.ganchos!.renderizar(ComercialPainel, { config, simuladas: [], numerosVendas: [{ id: "v1", rotulo: "Vendas SP" }] });
const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);
/** Os dois <select> de estado, na ordem da tela: saudação, gestão. */
const selectsDeEstado = (t: ReactNode) => elementos(t).filter((n) => n.type === "select" && ["DESLIGADA", "SHADOW", "ATIVA"].includes(String(n.props.value)));
const escolher = (indice: number, valor: string) => (selectsDeEstado(tela())[indice].props.onChange as (e: unknown) => void)({ target: { value: valor } });
const SALVAR = "Salvar configuração comercial";

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  config = { ...configBase };
  m.salvar.mockResolvedValue({ ok: true });
});

describe("ComercialPainel \u2014 ativar automações passa pela confirmação", () => {
  it("saudação de ensaio para ativa: Salvar não salva; a confirmação mostra o texto que passa a sair", async () => {
    escolher(0, "ATIVA");
    await clicar(tela(), SALVAR);
    expect(m.salvar).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe("Ativar a saudação automática?");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("enviada de verdade");
    expect(consequencia).toContain("Olá! Já retornamos.");
    expect(m.salvar).not.toHaveBeenCalled(); // renderizar a confirmação não executa a ação (R2 da #154, B8)
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.salvar).toHaveBeenCalledTimes(1); // só o confirmar executa, uma vez
    expect(m.salvar).toHaveBeenCalledTimes(1);
    expect(m.salvar.mock.calls[0][0]).toMatchObject({ saudacaoEstado: "ATIVA" });
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(doTipo(t, FeedbackAcao)[0].props.sucesso).toBe("Configuração comercial salva.");
  });

  it("alertas do gestor para ativa: a confirmação diz o número do gestor e o remetente", async () => {
    escolher(1, "ATIVA");
    await clicar(tela(), SALVAR);
    expect(m.salvar).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe("Ativar os alertas e o relatório do gestor?");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("+5511988887777");
    expect(consequencia).toContain("Vendas SP");
    expect(consequencia).not.toContain("Olá! Já retornamos.");
  });

  it("salvar sem ativar nada grava direto; já ativa não pede de novo", async () => {
    await clicar(tela(), SALVAR);
    expect(m.salvar).toHaveBeenCalledTimes(1);
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);

    m.ganchos!.reiniciar();
    config = { ...configBase, saudacaoEstado: "ATIVA" };
    await clicar(tela(), SALVAR);
    expect(m.salvar).toHaveBeenCalledTimes(2);
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
  });

  it("voltar não salva", async () => {
    escolher(0, "ATIVA");
    await clicar(tela(), SALVAR);
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
    expect(m.salvar).not.toHaveBeenCalled();
  });
});
