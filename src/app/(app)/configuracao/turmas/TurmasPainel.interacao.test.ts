import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("./TurmaFormulario", () => ({
  TurmaFormulario: () => "formulario-turma",
  destinoPrepararGrade: (turmaId: string) => `/academico/grades/nova?turmaId=${encodeURIComponent(turmaId)}`,
}));
const acoes = vi.hoisted(() => ({ abrirTurma: vi.fn(), voltarTurmaParaPlanejada: vi.fn() }));
vi.mock("@/server/turmas/acoes", () => acoes);
vi.mock("./ImportarTurmasModal", () => ({ ImportarTurmasModal: () => "importar-turmas" }));

import type { ReactNode } from "react";
import { TurmasPainel } from "./TurmasPainel";
import { TurmaFormulario } from "./TurmaFormulario";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { TurmaRow } from "./TurmasPainel";
import { clicar, criarGanchos, elementos, temBotao, texto, type No } from "@/test/tela-sem-dom";

beforeEach(() => { m.ganchos = criarGanchos(); vi.clearAllMocks(); });

const tela = () => m.ganchos!.renderizar(TurmasPainel, { turmas: [], modalidades: [], niveis: [], professores: [] });
const dialogo = (t: ReactNode): No | undefined => elementos(t).find((n) => typeof n.props.aoFechar === "function");
const formulario = (t: ReactNode): No => elementos(t).find((n) => n.type === TurmaFormulario)!;
const fecharPeloFundo = () => (dialogo(tela())!.props.aoFechar as () => void)();
const confirmacao = (t: ReactNode) => elementos(t).find((n) => n.props.role === "alert" && texto(n.props.children).includes("Descartar a turma não salva?"));

describe("TurmasPainel — o fundo não descarta uma turma preenchida", () => {
  it("formulário intocado: o fundo/Escape fecha como antes", () => {
    clicar(tela(), "Nova turma");
    expect(dialogo(tela())).toBeDefined();
    fecharPeloFundo();
    expect(dialogo(tela())).toBeUndefined();
  });

  it("formulário alterado: pede confirmação; continuar editando mantém tudo aberto", () => {
    clicar(tela(), "Nova turma");
    (formulario(tela()).props.aoMudarAlterado as (v: boolean) => void)(true);
    fecharPeloFundo();
    expect(dialogo(tela())).toBeDefined();
    expect(confirmacao(tela())).toBeDefined();
    clicar(tela(), "Continuar editando");
    expect(confirmacao(tela())).toBeUndefined();
    expect(dialogo(tela())).toBeDefined();
  });

  it("formulário alterado: descartar fecha; ao reabrir, começa sem pendência de descarte", () => {
    clicar(tela(), "Nova turma");
    (formulario(tela()).props.aoMudarAlterado as (v: boolean) => void)(true);
    fecharPeloFundo();
    clicar(tela(), "Descartar alterações");
    expect(dialogo(tela())).toBeUndefined();
    clicar(tela(), "Nova turma");
    fecharPeloFundo();
    expect(dialogo(tela())).toBeUndefined();
    expect(temBotao(tela(), "Descartar alterações")).toBe(false);
  });
});

const turma = (status: TurmaRow["status"], alocacoes = 0, reservasMatricula = 0): TurmaRow => ({
  id: `t-${status}`, codigo: "T1", nome: `Turma ${status}`, online: false, diasHorario: null, diasSemana: [], horarioInicio: null, horarioFim: null,
  dataInicio: null, dataFim: null, capacidade: 10, rolling: false, status, modalidadeId: "m", nivelId: "n",
  modalidade: { nome: "Regular" }, nivel: { codigo: "A1", idioma: { nome: "Inglês" } }, professor: null, regraAvaliacao: null,
  _count: { alocacoes, reservasMatricula },
});
const telaCom = (turmas: TurmaRow[]) => m.ganchos!.renderizar(TurmasPainel, { turmas, modalidades: [], niveis: [], professores: [] });
const botoesUi = (t: ReactNode) => elementos(t).filter((n) => n.type === Button);
const botaoUi = (t: ReactNode, rotulo: string) => botoesUi(t).find((n) => texto(n.props.children) === rotulo);
const clicarUi = (t: ReactNode, rotulo: string) => (botaoUi(t, rotulo)!.props.onClick as () => unknown)();
const alertDialog = (t: ReactNode) => elementos(t).find((n) => n.type === AlertDialog)!;
const tituloDialogo = (t: ReactNode) => texto(elementos(t).find((n) => n.type === AlertDialogTitle)?.props.children);
const alertaErro = (t: ReactNode) => elementos(t).find((n) => n.props.role === "alert");
const TODAS = [turma("PLANEJADA"), turma("ABERTA"), turma("EM_ANDAMENTO"), turma("CONCLUIDA")];
const rotulosDaTela = (t: ReactNode) => botoesUi(t).map((n) => texto(n.props.children));

describe("TurmasPainel — abrir turma e voltar para planejada (#539)", () => {
  it("Abrir turma aparece só na linha PLANEJADA; Voltar só na ABERTA sem ocupação", () => {
    const t = telaCom(TODAS);
    expect(rotulosDaTela(t).filter((r) => r === "Abrir turma")).toHaveLength(1);
    expect(rotulosDaTela(t).filter((r) => r === "Voltar para planejada")).toHaveLength(1);
    expect(rotulosDaTela(telaCom([turma("ABERTA"), turma("EM_ANDAMENTO"), turma("CONCLUIDA")]))).not.toContain("Abrir turma");
    expect(botaoUi(telaCom([turma("PLANEJADA")]), "Abrir turma")!.props).toMatchObject({ variante: "fantasma", tamanho: "sm" });
  });

  it.each([[1, 0], [0, 1]])("Voltar fica oculto com ocupação (alocações=%i, reservas=%i)", (alocacoes, reservas) => {
    expect(rotulosDaTela(telaCom([turma("ABERTA", alocacoes, reservas)]))).not.toContain("Voltar para planejada");
  });

  it("abre o AlertDialog com o texto de confirmação; Cancelar fecha sem chamar a ação", () => {
    expect(alertDialog(telaCom([turma("PLANEJADA")])).props.open).toBe(false);
    clicarUi(telaCom([turma("PLANEJADA")]), "Abrir turma");
    const t = telaCom([turma("PLANEJADA")]);
    expect(alertDialog(t).props.open).toBe(true);
    expect(tituloDialogo(t)).toBe("Abrir turma para matrícula?");
    expect(texto(elementos(t).find((n) => n.type === AlertDialogDescription)?.props.children)).toBe("A turma passará a aparecer em Nova matrícula enquanto houver vaga.");
    clicarUi(t, "Cancelar");
    expect(alertDialog(telaCom([turma("PLANEJADA")])).props.open).toBe(false);
    expect(acoes.abrirTurma).not.toHaveBeenCalled();
  });

  it("confirmar chama abrirTurma uma vez com o id e fecha no sucesso", async () => {
    acoes.abrirTurma.mockResolvedValue({ ok: true });
    clicarUi(telaCom([turma("PLANEJADA")]), "Abrir turma");
    const t = telaCom([turma("PLANEJADA")]);
    const confirmar = botoesUi(t).filter((n) => texto(n.props.children) === "Abrir turma")[0]!;
    await (confirmar.props.onClick as () => Promise<void>)();
    expect(acoes.abrirTurma).toHaveBeenCalledTimes(1);
    expect(acoes.abrirTurma).toHaveBeenCalledWith("t-PLANEJADA");
    expect(alertDialog(telaCom([turma("PLANEJADA")])).props.open).toBe(false);
  });

  it("erro do servidor aparece no diálogo, que continua aberto", async () => {
    acoes.voltarTurmaParaPlanejada.mockResolvedValue({ ok: false, erro: "Turma com matrícula ou reserva não pode voltar para planejada." });
    clicarUi(telaCom([turma("ABERTA")]), "Voltar para planejada");
    const t = telaCom([turma("ABERTA")]);
    expect(tituloDialogo(t)).toBe("Voltar turma para planejada?");
    await (botoesUi(t).filter((n) => texto(n.props.children) === "Voltar para planejada")[0]!.props.onClick as () => Promise<void>)();
    expect(acoes.voltarTurmaParaPlanejada).toHaveBeenCalledWith("t-ABERTA");
    const depois = telaCom([turma("ABERTA")]);
    expect(alertDialog(depois).props.open).toBe(true);
    expect(texto(alertaErro(depois)?.props.children)).toBe("Turma com matrícula ou reserva não pode voltar para planejada.");
  });

  it("enquanto pendente, botões ficam desabilitados e fechar pelo fundo é ignorado", async () => {
    let resolver!: (v: unknown) => void;
    acoes.abrirTurma.mockReturnValue(new Promise((r) => { resolver = r; }));
    clicarUi(telaCom([turma("PLANEJADA")]), "Abrir turma");
    const t = telaCom([turma("PLANEJADA")]);
    const andamento = (botoesUi(t).filter((n) => texto(n.props.children) === "Abrir turma")[0]!.props.onClick as () => Promise<void>)();
    const pendente = telaCom([turma("PLANEJADA")]);
    expect(botaoUi(pendente, "Cancelar")!.props.disabled).toBe(true);
    expect(botaoUi(pendente, "Salvando...")!.props.disabled).toBe(true);
    (alertDialog(pendente).props.onOpenChange as (a: boolean) => void)(false);
    expect(alertDialog(telaCom([turma("PLANEJADA")])).props.open).toBe(true);
    resolver({ ok: true });
    await andamento;
    expect(acoes.abrirTurma).toHaveBeenCalledTimes(1);
  });
});
