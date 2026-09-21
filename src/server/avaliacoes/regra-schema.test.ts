import { expect, it } from "vitest";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";

it("conserva parâmetros explícitos e permite final distribuída em instrumentos", () => {
  const c = regraAvaliacaoTeste();
  const final = c.avaliacoes.pop()!;
  c.avaliacoes.push(...final.habilidades.map((h, i) => ({ ...final, codigo: `F${i}`, habilidades: [h] })));
  expect(ConteudoRegraAvaliacaoSchema.parse(c)).toEqual(c);
});

it.each(["peso", "minimo", "escala", "frequencia", "habilidades", "codigo", "final", "intermediaria", "prazo", "limite", "numero"])("recusa regra inconsistente: %s", tipo => {
  const c = regraAvaliacaoTeste();
  if (tipo === "peso") c.habilidades[0].peso = "0";
  if (tipo === "minimo") c.minimoGeral = "11";
  if (tipo === "escala") c.escala.maximo = "0";
  if (tipo === "frequencia") c.frequenciaMinimaPercentual = "100.01";
  if (tipo === "habilidades") c.habilidades[0] = c.habilidades[1];
  if (tipo === "codigo") c.avaliacoes[0].codigo = c.avaliacoes[1].codigo;
  if (tipo === "final") c.avaliacoes[1].habilidades.pop();
  if (tipo === "intermediaria") c.avaliacoes[0].etapa = "FINAL";
  if (tipo === "prazo") c.recuperacao.prazoRealizacaoMinutos = 0;
  if (tipo === "limite") c.habilidades[0].limiteRecuperacoes = -1;
  if (tipo === "numero") c.minimoGeral = "NaN";
  expect(ConteudoRegraAvaliacaoSchema.safeParse(c).success).toBe(false);
});

it("não presume parâmetro ausente nem permite condições desconhecidas", () => {
  const { recuperacao: omitido, ...c } = regraAvaliacaoTeste();
  expect(omitido).toBeDefined();
  expect(ConteudoRegraAvaliacaoSchema.safeParse(c).success).toBe(false);
  expect(ConteudoRegraAvaliacaoSchema.safeParse({ ...regraAvaliacaoTeste(), dispensarMinimo: true }).success).toBe(false);
});
