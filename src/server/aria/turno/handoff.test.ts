import { describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { lerNotaResumo, montarNotaResumo } from "./handoff";

describe("parser canonico do resumo de handoff", () => {
  it("inverte os campos canonicos e subconjuntos", () => {
    const r = { motivo: "Desconto", resumo: "Quer quinze por cento", proximoPasso: "Ligar hoje" };
    expect(lerNotaResumo(montarNotaResumo(r, ["motivo", "resumo", "proximoPasso"])!)).toEqual(r);
    expect(lerNotaResumo(montarNotaResumo(r, ["resumo"])!)).toEqual({ resumo: r.resumo });
    expect(lerNotaResumo("Próximo passo: Ligar")).toEqual({ proximoPasso: "Ligar" });
  });
  it("preserva continuacoes e linhas internas, normalizando CRLF e bordas", () => {
    expect(lerNotaResumo("Resumo:  Linha um\r\nLinha dois\r\n\r\nHorário: noite\r\nPróximo passo:  Ligar  ")).toEqual({ resumo: "Linha um\nLinha dois\n\nHorário: noite", proximoPasso: "Ligar" });
  });
  it.each(["", "\nResumo: texto", "  \nResumo: texto", "texto livre", "prefixo\nResumo: texto", "Resumo: um\nResumo: dois", "Resumo: um\nMotivo: ordem errada", "Próximo passo: um\nResumo: dois"])("recusa formato ambiguo ou nao canonico: %s", nota => expect(lerNotaResumo(nota)).toEqual({}));
  it("nao inventa limite de nota manual ou altera formatter", () => {
    const longo = "x".repeat(3000); expect(lerNotaResumo("Resumo: " + longo)).toEqual({ resumo: longo });
    expect(montarNotaResumo({ motivo: "m", resumo: "r", proximoPasso: "p" }, ["resumo", "desconhecido"])).toBe("Resumo: r");
  });
  it("explicita que rotulo posterior no conteudo e indistinguivel de separador", () => {
    const nota = montarNotaResumo({ motivo: "", resumo: "Um\nPróximo passo: Dois", proximoPasso: "" }, ["resumo"])!;
    expect(lerNotaResumo(nota)).toEqual({ resumo: "Um", proximoPasso: "Dois" });
  });
});
