import { describe, it, expect } from "vitest";
import { classificarRespostaExperimental } from "./captura";

// Regra PURA do fallback textual da confirmação da experimental (doc 27 C2 · review PR #56).
// Este é o degrau mais barato de testar e o mais caro de errar: confirmar presença MUDA o
// estado do funil — o vendedor para de ligar para quem "já confirmou". Por isso o conjunto de
// confirmação é fechado no que o template PUBLICA ("Responda SIM ... ou REAGENDAR ..."), e o
// match é EXATO (a mensagem inteira, normalizada), nunca "contém".
//
// `ok`/`si`/`confirmar`/`confirmado` saíram do conjunto (review PR #56 P2): são respostas
// genéricas de conversa — "ok" fecha qualquer assunto com o vendedor e marcava presença por
// engano. O lado do REAGENDAMENTO pode ser generoso: ele só emite um sinal para o humano.

describe("classificarRespostaExperimental", () => {
  it("keywords genéricas NÃO confirmam (conjunto conservador)", () => {
    for (const corpo of ["ok", "si", "confirmar", "confirmado"]) {
      expect(classificarRespostaExperimental(corpo), corpo).toBeNull();
    }
  });

  it("só o que o template pede confirma — com trim e caixa indiferentes", () => {
    expect(classificarRespostaExperimental("sim")).toBe("confirmada");
    expect(classificarRespostaExperimental("SIM ")).toBe("confirmada");
    expect(classificarRespostaExperimental("Confirmo")).toBe("confirmada");
  });

  it("pedido de reagendamento é reconhecido", () => {
    expect(classificarRespostaExperimental("reagendar")).toBe("reagendar");
  });

  it("frase que CONTÉM a keyword não vale (match exato, não substring)", () => {
    expect(classificarRespostaExperimental("sim, claro")).toBeNull();
  });

  it("corpo vazio/ausente (mídia, sticker) não classifica nada", () => {
    expect(classificarRespostaExperimental(null)).toBeNull();
    expect(classificarRespostaExperimental("")).toBeNull();
  });
});
