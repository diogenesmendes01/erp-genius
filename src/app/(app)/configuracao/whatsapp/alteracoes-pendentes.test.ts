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
});
