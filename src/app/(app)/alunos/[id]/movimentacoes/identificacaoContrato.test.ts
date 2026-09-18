import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NovoEncerramento } from "./NovoEncerramento";
import { NovaPausa } from "./NovaPausa";
import { NovaRetomada } from "./NovaRetomada";
import { identificacaoContrato } from "./identificacaoContrato";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("identificação de contratos legados nas movimentações", () => {
  it("mantém o código aparado e usa o ID estável para legado", () => {
    expect(identificacaoContrato(" M-101 ", "matricula-legada-1")).toBe("M-101");
    const primeira = identificacaoContrato(null, "matricula-legada-1");
    const segunda = identificacaoContrato("   ", "matricula-legada-2");

    expect(primeira).toBe("ID matricula-legada-1");
    expect(segunda).toBe("ID matricula-legada-2");
    expect(primeira).not.toBe(segunda);
  });

  it("mostra opções inequívocas nos três formulários sem mudar seus IDs", () => {
    const identificacoes = ["ID matricula-legada-1", "ID matricula-legada-2"];
    const pausa = renderToStaticMarkup(createElement(NovaPausa, { alunoId: "aluno-1", hoje: "2026-09-18", contratos: [
      { id: "matricula-legada-1", identificacao: identificacoes[0], produto: { nome: "Inglês · Regular" } },
      { id: "matricula-legada-2", identificacao: identificacoes[1], produto: { nome: "Inglês · Regular" } },
    ] }));
    const retomada = renderToStaticMarkup(createElement(NovaRetomada, { alunoId: "aluno-1", hoje: "2026-09-18", contratos: [
      { id: "matricula-legada-1", identificacao: identificacoes[0], nome: "Inglês · Regular" },
      { id: "matricula-legada-2", identificacao: identificacoes[1], nome: "Inglês · Regular" },
    ] }));
    const encerramento = renderToStaticMarkup(createElement(NovoEncerramento, { alunoId: "aluno-1", hoje: "2026-09-18", contratos: [
      { id: "matricula-legada-1", nome: `${identificacoes[0]} · Inglês · Regular` },
      { id: "matricula-legada-2", nome: `${identificacoes[1]} · Inglês · Regular` },
    ] }));

    for (const identificacao of identificacoes) {
      expect(pausa).toContain(identificacao);
      expect(retomada).toContain(identificacao);
      expect(encerramento).toContain(identificacao);
    }
    expect(encerramento).toContain('name="matricula" value="matricula-legada-1"');
    expect(encerramento).toContain('name="matricula" value="matricula-legada-2"');
  });
});
