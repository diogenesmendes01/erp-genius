import { describe, expect, it } from "vitest";
import { forcarSoSugerir, motivoParaNaoAtuar, type SituacaoGuarda } from "./guardas";

const liberada: SituacaoGuarda = {
  estado: "ATIVA",
  pausadaGlobal: false,
  orcamento: "OK",
  acaoOrcamento: "SO_SUGERIR",
  conversaDeGrupo: false,
  finalidade: "COMERCIAL",
  iaPausadaEm: null,
  atendimentoEncerrado: false,
  contatoOptOut: false,
  numeroComDono: false,
  mensagemTipo: "TEXTO",
};

describe("guardas do turno", () => {
  it.each([
    [{ estado: "DESLIGADA" }, "DESLIGADA"],
    [{ pausadaGlobal: true }, "PAUSADA"],
    [{ orcamento: "ESTOURADO", acaoOrcamento: "PAUSAR" }, "ORCAMENTO"],
    [{ conversaDeGrupo: true }, "GRUPO"],
    [{ iaPausadaEm: new Date() }, "PAUSADA_NO_ATENDIMENTO"],
    [{ atendimentoEncerrado: true }, "ENCERRADO"],
    [{ contatoOptOut: true }, "OPT_OUT"],
    [{ finalidade: "FINANCEIRO" }, "OUTRO_SETOR"],
    [{ numeroComDono: true }, "LINHA_COM_DONO"],
    [{ mensagemTipo: "FIGURINHA" }, "SEM_TEXTO"],
  ])("bloqueia_%o", (parcial, motivo) =>
    expect(motivoParaNaoAtuar({ ...liberada, ...parcial } as SituacaoGuarda)).toBe(motivo),
  );

  it("shadow_e_ativa_liberam", () => {
    expect(motivoParaNaoAtuar({ ...liberada, estado: "SHADOW" })).toBeNull();
    expect(motivoParaNaoAtuar(liberada)).toBeNull();
  });

  it("finalidade_nula_nao_bloqueia", () => expect(motivoParaNaoAtuar({ ...liberada, finalidade: null })).toBeNull());

  it("grupo_vence_qualquer_outra_regra", () =>
    expect(
      motivoParaNaoAtuar({ ...liberada, estado: "DESLIGADA", conversaDeGrupo: true, finalidade: "FINANCEIRO" }),
    ).toBe("GRUPO"));

  it("orcamento_so_sugerir_nao_bloqueia_mas_forca", () => {
    const s = { ...liberada, orcamento: "ESTOURADO" as const, acaoOrcamento: "SO_SUGERIR" as const };
    expect(motivoParaNaoAtuar(s)).toBeNull();
    expect(forcarSoSugerir(s)).toBe(true);
    expect(forcarSoSugerir(liberada)).toBe(false);
    expect(forcarSoSugerir({ ...s, acaoOrcamento: "PAUSAR" })).toBe(false);
  });

  it("midia_com_legenda_possivel_passa_audio_nao", () => {
    expect(motivoParaNaoAtuar({ ...liberada, mensagemTipo: "IMAGEM" })).toBeNull();
    expect(motivoParaNaoAtuar({ ...liberada, mensagemTipo: "AUDIO" })).toBe("SEM_TEXTO");
  });
});
