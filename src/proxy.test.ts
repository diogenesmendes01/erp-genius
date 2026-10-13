import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { CABECALHO_CAMINHO } from "@/lib/destino-interno";
import { config, proxy } from "./proxy";

// O proxy só repassa ao guard o caminho pedido (docs/43 §6 item 8, /login com callbackUrl). O Next aplica os
// cabeçalhos reescritos da requisição a partir de `x-middleware-request-<nome>` na resposta do proxy.
const repassado = (r: Response) => r.headers.get(`x-middleware-request-${CABECALHO_CAMINHO}`);

describe("proxy", () => {
  it("repassa pathname e query do pedido ao guard", () => {
    const resposta = proxy(new NextRequest("http://escola.example.test/matriculas/m1?aba=contrato"));
    expect(repassado(resposta)).toBe("/matriculas/m1?aba=contrato");
  });

  it("reescreve o cabeçalho mandado pelo navegador (não passa um valor forjado adiante)", () => {
    const pedido = new NextRequest("http://escola.example.test/alunos", { headers: { [CABECALHO_CAMINHO]: "//golpe.example" } });
    expect(repassado(proxy(pedido))).toBe("/alunos");
  });

  it("não roda na API nem nos arquivos do build", () => {
    const [padrao] = config.matcher;
    const casa = (caminho: string) => new RegExp(`^${padrao}$`).test(caminho);
    expect(casa("/matriculas/m1")).toBe(true);
    expect(casa("/")).toBe(true);
    expect(casa("/api/portal-aluno/sair")).toBe(false);
    expect(casa("/_next/static/chunk.js")).toBe(false);
    expect(casa("/favicon.ico")).toBe(false);
  });
});
