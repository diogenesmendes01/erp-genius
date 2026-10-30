import { describe, expect, it } from "vitest";
import { ErroRegra } from "@/server/_shared/sessao";
import { regraAvaliacaoTeste, regraLegadaIlegivel, regrasLegadasPortugues } from "@/test/regra-avaliacao";
import { ConteudoRegraAvaliacaoSchema, DEFAULTS_REGRA_LEGADA, lerConteudoRegra, normalizarConteudoLegado } from "./regra-schema";
import { exigirConteudoRegra, MENSAGEM_REGRA_FORMATO_ANTIGO } from "./regra-conteudo";

describe("#530 leitura tolerante de regra de avaliação", () => {
  it.each(Object.entries(regrasLegadasPortugues()))("Português %s legado é lido com defaults documentados", (_nivel, raw) => {
    expect(ConteudoRegraAvaliacaoSchema.safeParse(raw).success).toBe(false);
    const r = lerConteudoRegra(raw);
    expect(r).toMatchObject({ ok: true, legado: true });
    if (!r.ok) throw new Error("ilegível");
    expect(r.camposPreenchidos.length).toBeGreaterThan(0);
    expect(ConteudoRegraAvaliacaoSchema.parse(r.conteudo)).toEqual(r.conteudo);
  });

  it("preenche apenas campos ausentes, sem sobrescrever valores existentes", () => {
    const { A1, B2 } = regrasLegadasPortugues();
    const a1 = lerConteudoRegra(A1), b2 = lerConteudoRegra(B2);
    if (!a1.ok || !b2.ok) throw new Error("ilegível");
    expect(a1.conteudo.recuperacao).toEqual(DEFAULTS_REGRA_LEGADA.recuperacao);
    expect(a1.conteudo.segundaChamada).toEqual(DEFAULTS_REGRA_LEGADA.segundaChamada);
    expect(a1.conteudo.habilidades.every(h => h.limiteRecuperacoes === 0)).toBe(true);
    expect(a1.conteudo.avaliacoes.every(a => a.limiteSegundasChamadas === 0)).toBe(true);
    expect(a1.conteudo.titulo).toBe("Português A1");
    expect(b2.conteudo.segundaChamada).toEqual({ prazoRealizacaoMinutos: 2000, antecedenciaCancelamentoMinutos: 0 });
    expect(b2.camposPreenchidos).toEqual(["segundaChamada.antecedenciaCancelamentoMinutos"]);
  });

  it("é pura e determinística: a entrada permanece byte a byte igual", () => {
    for (const raw of [...Object.values(regrasLegadasPortugues()), regraLegadaIlegivel()]) {
      const antes = JSON.stringify(raw);
      const r1 = normalizarConteudoLegado(raw), r2 = normalizarConteudoLegado(raw);
      lerConteudoRegra(raw);
      expect(JSON.stringify(raw)).toBe(antes);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    }
  });

  it("conteúdo atual válido não é marcado como legado", () => {
    expect(lerConteudoRegra(regraAvaliacaoTeste())).toMatchObject({ ok: true, legado: false, camposPreenchidos: [] });
  });

  it("versão ilegível devolve só os caminhos, sem lançar", () => {
    const r = lerConteudoRegra(regraLegadaIlegivel());
    expect(r).toEqual({ ok: false, legado: true, caminhos: ["titulo"] });
    expect(lerConteudoRegra(null)).toMatchObject({ ok: false, legado: true });
    expect(lerConteudoRegra("texto")).toMatchObject({ ok: false, legado: true });
  });

  it("cálculo continua estrito e falha fechado com mensagem amigável", () => {
    expect(exigirConteudoRegra(regraAvaliacaoTeste())).toEqual(regraAvaliacaoTeste());
    for (const raw of [...Object.values(regrasLegadasPortugues()), regraLegadaIlegivel()]) {
      expect(() => exigirConteudoRegra(raw)).toThrow(ErroRegra);
      expect(() => exigirConteudoRegra(raw)).toThrow(MENSAGEM_REGRA_FORMATO_ANTIGO);
    }
  });
});
