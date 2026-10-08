import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3 (docs/42 L2217): mudar a página de cadastros ou de turmas não remonta o formulário (a key é
// só a oferta). Aqui, o que o formulário faz com as listas novas: o cadastro e a turma escolhidos continuam
// escolhidos (e na lista) mesmo quando a página nova não os traz; e a agenda conferida para outra versão da
// oferta deixa de valer. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  preparar: vi.fn(), prepararNova: vi.fn(), push: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
    // A transição roda a função na hora (o ocupado não é o assunto aqui).
    useTransition: (() => [false, (f: () => unknown) => { void f(); }]) as unknown as typeof real.useTransition,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, refresh: vi.fn() }) }));
vi.mock("@/server/matricula/preparacao-comercial", () => ({
  prepararContratacao: m.preparar, prepararContratacaoNovaPessoa: m.prepararNova,
  consultarProfessoresParticular: vi.fn(), revisarAgendaParticularComercial: vi.fn(),
}));

import type { ReactNode } from "react";
import { PreparacaoFormulario } from "./PreparacaoFormulario";
import { AgendaParticularFormulario, type AgendaConferida } from "./AgendaParticularFormulario";
import { CampoMoeda } from "@/components/CampoMoeda";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

type Props = Parameters<typeof PreparacaoFormulario>[0];
const oferta = (versaoEntrada = 1, formaAgenda: string | null = null): Props["oferta"] => ({ id: "oferta-1", versaoEntrada, formaAgenda, produtoId: "produto", paisId: "pais", moeda: "BRL" });
const props = (pagina: number, o = oferta()): Props => ({
  leadId: "lead-1", novaPessoa: false, paises: [], oferta: o,
  candidatos: [{ id: `aluno-${pagina}`, primeiroNome: "Ana", sobrenome: `Página ${pagina}` }],
  turmas: [{ id: `turma-${pagina}`, nome: `Turma ${pagina}` }],
});
const tela = (p: Props) => m.ganchos!.renderizar(PreparacaoFormulario, p);
const select = (t: ReactNode, nome: string) => elementos(t).find((n) => n.type === "select" && n.props.name === nome)!;
const opcoes = (t: ReactNode, nome: string) => elementos(select(t, nome)).filter((n) => n.type === "option").map((n) => texto(n.props.children));
const escolher = (t: ReactNode, nome: string, valor: string) => (select(t, nome).props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });
const preencherValores = (p: Props) => {
  const [taxa] = elementos(tela(p)).filter((n) => n.type === CampoMoeda);
  (taxa.props.onChange as (v: string) => void)("100,00");
  const [, servico] = elementos(tela(p)).filter((n) => n.type === CampoMoeda);
  (servico.props.onChange as (v: string) => void)("250,00");
};
const botaoEnviar = (t: ReactNode) => elementos(t).find((n) => n.type === "button" && texto(n.props.children).includes("Preparar contratação"))!;

describe("PreparacaoFormulario — trocar de página nas listas não apaga a escolha", () => {
  it("cadastro e turma escolhidos na página 1 continuam escolhidos (e na lista) na página 2", () => {
    escolher(tela(props(1)), "aluno", "aluno-1");
    escolher(tela(props(1)), "turma", "turma-1");
    const pagina2 = tela(props(2));
    expect(select(pagina2, "aluno").props.value).toBe("aluno-1");
    expect(opcoes(pagina2, "aluno")).toEqual(["Selecione após conferir a identidade", "Ana Página 1", "Ana Página 2"]);
    expect(select(pagina2, "turma").props.value).toBe("turma-1");
    expect(opcoes(pagina2, "turma")).toEqual(["Escolha uma turma disponível", "Turma 1", "Turma 2"]);
  });

  it("envia o cadastro e a turma escolhidos antes da troca de página, com os valores digitados", async () => {
    escolher(tela(props(1)), "aluno", "aluno-1");
    escolher(tela(props(1)), "turma", "turma-1");
    preencherValores(props(2));
    m.preparar.mockResolvedValueOnce({ ok: true, dado: { matriculaId: "matricula-1" } });
    await submeter(tela(props(2)), { confirmacao: "on", regime: "MENSALIDADE", motivo: "Condições combinadas." });
    expect(m.preparar).toHaveBeenCalledWith(expect.objectContaining({ alunoId: "aluno-1", turmaId: "turma-1", taxaProposta: "100.00", valorServicoProposto: "250.00", motivo: "Condições combinadas." }));
  });

  it("agenda particular conferida para outra versão da oferta deixa de valer: o envio é bloqueado até conferir de novo", async () => {
    const particular = (v: number) => ({ ...props(1, oferta(v, "PARTICULAR_FLEXIVEL")) });
    const agenda: AgendaConferida = { ofertaId: "oferta-1", versaoOferta: 1, professorId: "prof", fusoOrigem: "America/Sao_Paulo", encontros: [], estadoHash: "h", horariosAcordadosConferidos: true };
    const filho = elementos(tela(particular(1))).find((n) => n.type === AgendaParticularFormulario)!;
    (filho.props.onChange as (a: AgendaConferida | null) => void)(agenda);
    escolher(tela(particular(1)), "aluno", "aluno-1");
    expect(botaoEnviar(tela(particular(1))).props.disabled).toBe(false);
    // A oferta mudou de versão (refresh): o formulário continua, mas a agenda conferida não vale mais.
    expect(botaoEnviar(tela(particular(2))).props.disabled).toBe(true);
    preencherValores(particular(2));
    await submeter(tela(particular(2)), { confirmacao: "on", regime: "MENSALIDADE", motivo: "Condições combinadas." });
    expect(m.preparar).not.toHaveBeenCalled();
    expect(elementos(tela(particular(2))).filter((n) => n.props.role === "alert").map((n) => texto(n.props.children))).toEqual(["Confira e confirme os horários particulares antes de preparar."]);
  });
});
