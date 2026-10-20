import { describe, expect, it } from "vitest";
import type { DegrauConfig, NumeroConfig, PoliticaConfig } from "@/server/whatsapp/consultas";
import { avisosAgendaAlterados, numeroAlterado, politicaAlterada, setoresAlterados } from "./alteracoes-pendentes";

// C32 da #170 (docs/42 L2519): números, política e avisos de agenda não diziam que havia alteração pendente
// nem avisavam ao sair. A base de comparação é o que veio do servidor (as props): depois de salvar, o
// router.refresh traz o valor novo e o formulário volta a coincidir com ele.

const numero = (o: Partial<NumeroConfig> = {}): NumeroConfig => ({
  id: "n1", telefoneE164: "+5511999990001", rotulo: "Secretaria", driver: "MOTOR", finalidade: "COBRANCA",
  providerRef: "n1", sessao: "CONECTADO", donoId: null, donoNome: null, ativo: true, setores: [], triagemResponsavelId: null, ...o,
});
const vazio = { telefoneE164: "", rotulo: "", finalidade: "COBRANCA" as const, donoId: "", ativo: true };
const doNumero = { id: "n1", telefoneE164: "+5511999990001", rotulo: "Secretaria", finalidade: "COBRANCA" as const, donoId: "", ativo: true };

describe("numeroAlterado", () => {
  it("sem formulário, ou aberto sem mexer (novo ou existente), não há alteração", () => {
    expect(numeroAlterado(null, [numero()])).toBe(false);
    expect(numeroAlterado(vazio, [numero()])).toBe(false);
    expect(numeroAlterado(doNumero, [numero()])).toBe(false);
  });
  it("qualquer campo diferente do salvo é alteração; número que sumiu da lista também", () => {
    expect(numeroAlterado({ ...vazio, rotulo: "Vendas" }, [])).toBe(true);
    expect(numeroAlterado({ ...doNumero, rotulo: "Outro" }, [numero()])).toBe(true);
    expect(numeroAlterado({ ...doNumero, ativo: false }, [numero()])).toBe(true);
    expect(numeroAlterado({ ...doNumero, donoId: "u1" }, [numero()])).toBe(true);
    expect(numeroAlterado(doNumero, [])).toBe(true);
  });
});

describe("setoresAlterados", () => {
  it("compara os setores (sem ordem) e a triagem com o número salvo", () => {
    const n = numero({ setores: ["COMERCIAL", "FINANCEIRO"], triagemResponsavelId: null });
    expect(setoresAlterados(["FINANCEIRO", "COMERCIAL"], "", n)).toBe(false);
    expect(setoresAlterados(["COMERCIAL"], "", n)).toBe(true);
    expect(setoresAlterados(["COMERCIAL", "FINANCEIRO"], "u1", n)).toBe(true);
  });
});

describe("avisosAgendaAlterados", () => {
  it("compara número e template com a configuração salva (null salvo = vazio na tela)", () => {
    const config = { numeroAvisosAgendaId: null, templateAvisosAgendaId: "t1" };
    expect(avisosAgendaAlterados("", "t1", config)).toBe(false);
    expect(avisosAgendaAlterados("n1", "t1", config)).toBe(true);
    expect(avisosAgendaAlterados("", "t2", config)).toBe(true);
  });
});

describe("politicaAlterada", () => {
  const degrau = (o: Partial<DegrauConfig> = {}): DegrauConfig => ({ passo: "D-7", offsetDias: -7, tipo: "lembrete", rotulo: "D-7", modo: "AUTOMATICO", ativo: true, templateId: null, ...o });
  const politica: PoliticaConfig = {
    id: "p1", nome: "Régua", estado: "SHADOW", janelaInicio: 9, janelaFim: 20, diasSemana: [1, 2, 3, 4, 5],
    tetoPorContatoDia: 1, silencioPosInboundHoras: 24, killSwitch: false, numeroRemetenteId: null, degraus: [degrau()],
  };
  const form = () => ({
    estado: "SHADOW" as const, janelaInicio: 9, janelaFim: 20, diasSemana: [1, 2, 3, 4, 5], tetoPorContatoDia: 1,
    silencioPosInboundHoras: 24, killSwitch: false, numeroRemetenteId: "", degraus: [degrau()],
  });

  it("o formulário como veio não tem alteração", () => {
    expect(politicaAlterada(form(), politica)).toBe(false);
  });
  it("campos globais e degraus contam", () => {
    expect(politicaAlterada({ ...form(), estado: "ATIVA" }, politica)).toBe(true);
    expect(politicaAlterada({ ...form(), janelaFim: 21 }, politica)).toBe(true);
    expect(politicaAlterada({ ...form(), diasSemana: [1, 2, 3] }, politica)).toBe(true);
    expect(politicaAlterada({ ...form(), numeroRemetenteId: "n1" }, politica)).toBe(true);
    expect(politicaAlterada({ ...form(), degraus: [degrau({ modo: "LOTE" })] }, politica)).toBe(true);
    expect(politicaAlterada({ ...form(), degraus: [degrau({ templateId: "t1" })] }, politica)).toBe(true);
  });
  it("o kill switch não conta: ele grava na hora, pela confirmação própria", () => {
    expect(politicaAlterada({ ...form(), killSwitch: true }, politica)).toBe(false);
  });
  it("a ordem dos dias marcados não conta", () => {
    expect(politicaAlterada({ ...form(), diasSemana: [5, 4, 3, 2, 1] }, politica)).toBe(false);
  });
  it("a ordem dos degraus não conta: o servidor relê por offsetDias e o formulário mantém a ordem de abertura (B1)", () => {
    // O admin muda o D-7 para -1 e salva: o refresh traz [D-3, D-7], o formulário continua [D-7, D-3].
    const d7 = degrau({ passo: "D-7", rotulo: "D-7", offsetDias: -1 });
    const d3 = degrau({ passo: "D-3", rotulo: "D-3", offsetDias: -3 });
    const salva: PoliticaConfig = { ...politica, degraus: [d3, d7] };
    expect(politicaAlterada({ ...form(), degraus: [d7, d3] }, salva)).toBe(false);
    // Empate de offsets: a ordem do banco não é garantida, e continua sem alteração.
    const e3 = { ...d7, offsetDias: -3 };
    expect(politicaAlterada({ ...form(), degraus: [e3, d3] }, { ...politica, degraus: [d3, e3] })).toBe(false);
  });
  it("com a ordem trocada, um degrau mudado ainda conta; degrau a mais, a menos ou trocado de passo também", () => {
    const d7 = degrau({ passo: "D-7", offsetDias: -7 });
    const d3 = degrau({ passo: "D-3", offsetDias: -3 });
    const salva: PoliticaConfig = { ...politica, degraus: [d7, d3] };
    expect(politicaAlterada({ ...form(), degraus: [{ ...d3, ativo: false }, d7] }, salva)).toBe(true);
    expect(politicaAlterada({ ...form(), degraus: [d3] }, salva)).toBe(true);
    expect(politicaAlterada({ ...form(), degraus: [d3, d7, degrau({ passo: "D0", offsetDias: 0 })] }, salva)).toBe(true);
    expect(politicaAlterada({ ...form(), degraus: [d3, degrau({ passo: "D0", offsetDias: -7 })] }, salva)).toBe(true);
  });
});
