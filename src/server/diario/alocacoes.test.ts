import { describe, expect, it } from "vitest";
import { alocacaoCobreAula } from "./alocacoes";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const legado = { criadoEm: dia("2026-09-16"), encerradaEm: null, ativa: true };
const historico = { ...legado, provenienciaVinculo: "MIGRACAO", inicioVigencia: dia("2025-01-01"), fimVigencia: dia("2025-04-01"), ativa: false };
describe("vigência da alocação na chamada", () => {
  it("usa início histórico, e não o dia da importação, com fim exclusivo", () => {
    expect(alocacaoCobreAula(historico, dia("2025-01-01"))).toBe(true);
    expect(alocacaoCobreAula(historico, dia("2025-03-31"))).toBe(true);
    expect(alocacaoCobreAula(historico, dia("2025-04-01"))).toBe(false);
    expect(alocacaoCobreAula(historico, dia("2024-12-31"))).toBe(false);
  });
  it("encerramento operacional posterior à importação limita o vínculo histórico", () => {
    const encerrada = { ...historico, encerradaEm: dia("2025-03-01") };
    expect(alocacaoCobreAula(encerrada, dia("2025-02-28"))).toBe(true);
    expect(alocacaoCobreAula(encerrada, dia("2025-03-01"))).toBe(false);
  });
  it("não recupera início ausente, proveniência desconhecida ou janela inválida pelo cadastro", () => {
    expect(alocacaoCobreAula({ ...historico, inicioVigencia: null }, dia("2026-10-01"))).toBe(false);
    expect(alocacaoCobreAula({ ...historico, provenienciaVinculo: "OUTRA" }, dia("2025-02-01"))).toBe(false);
    expect(alocacaoCobreAula({ ...historico, fimVigencia: dia("2024-12-01") }, dia("2025-02-01"))).toBe(false);
  });
  it("mantém o tratamento do legado e não reabre vínculo inativo sem limite comprovado", () => {
    expect(alocacaoCobreAula(legado, dia("2026-09-15"))).toBe(false);
    expect(alocacaoCobreAula(legado, dia("2026-09-16"))).toBe(true);
    expect(alocacaoCobreAula({ ...historico, fimVigencia: null }, dia("2025-02-01"))).toBe(false);
    expect(alocacaoCobreAula({ ...historico, fimVigencia: null, ativa: true }, dia("2025-02-01"))).toBe(true);
  });
});