import { describe, expect, it } from "vitest";
import { configPadrao } from "../config-schema";
import { montarSistema, type ContextoTurno } from "./contexto";

function ctx(over: Partial<ContextoTurno> = {}): ContextoTurno {
  return {
    atendimentoId: "a", conversaId: "c", numeroId: "n", contatoId: "k",
    oportunidade: { id: "o", nome: "Maria", etapa: "NOVO", vendedorDonoId: null, valorPrevisto: null, paisId: null },
    mensagens: [], precos: [], trechos: [], faq: [], respostasRapidas: [], primeiraDaAria: true, trocasSemAvanco: 0,
    ...over,
  };
}

describe("montarSistema: respostas rápidas liberadas", () => {
  it("sem_respostas_nao_ha_bloco", () => {
    expect(montarSistema(configPadrao(), ctx())).not.toContain("RESPOSTAS RAPIDAS LIBERADAS");
  });

  it("bloco_traz_atalho_e_corpo_depois_de_precos_e_fontes", () => {
    const s = montarSistema(configPadrao(), ctx({ respostasRapidas: [{ atalho: "/horario", corpo: "As aulas são de segunda a quinta." }] }));
    expect(s).toContain("RESPOSTAS RAPIDAS LIBERADAS");
    expect(s).toContain("- /horario: As aulas são de segunda a quinta.");
    expect(s.indexOf("RESPOSTAS RAPIDAS LIBERADAS")).toBeGreaterThan(s.indexOf("FONTES"));
  });

  it("variaveis_como_no_compositor_nome_da_oportunidade_e_responsavel_e_quem_fala", () => {
    const s = montarSistema(configPadrao(), ctx({ respostasRapidas: [{ atalho: "/oi", corpo: "Oi {nome}, aqui é {responsavel}. Sobre o {curso}:" }] }));
    expect(s).toContain("- /oi: Oi Maria, aqui é Aria. Sobre o {curso}:");
  });

  it("sem_oportunidade_nome_fica_cru_e_ha_orientacao_para_nao_enviar_variavel", () => {
    const s = montarSistema(configPadrao(), ctx({ oportunidade: null, respostasRapidas: [{ atalho: "/oi", corpo: "Oi {nome}!" }] }));
    expect(s).toContain("- /oi: Oi {nome}!");
    expect(s).toMatch(/nunca envie .*chaves/i);
  });

  it("orienta_manter_valores_e_condicoes", () => {
    const s = montarSistema(configPadrao(), ctx({ respostasRapidas: [{ atalho: "/preco", corpo: "A matrícula é R$ 350,00." }] }));
    expect(s).toContain("- /preco: A matrícula é R$ 350,00.");
    expect(s).toMatch(/valores e condições exatamente como estão/i);
  });

  it("corpo_sem_dados_pessoais", () => {
    const s = montarSistema(configPadrao(), ctx({ respostasRapidas: [{ atalho: "/contato", corpo: "Ligue +50688888888 ou escreva a a@b.com" }] }));
    expect(s).not.toMatch(/\+\d{10,}|@b\.com/);
  });

  it("prefixo_estavel_com_e_sem_respostas", () => {
    const a = montarSistema(configPadrao(), ctx({ respostasRapidas: [{ atalho: "/x", corpo: "y" }] }));
    const b = montarSistema(configPadrao(), ctx());
    expect(b.startsWith(a.slice(0, a.indexOf("PRECOS")))).toBe(true);
  });
});
