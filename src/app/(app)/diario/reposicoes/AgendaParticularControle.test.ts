import { expect, it, vi } from "vitest";
import { criarControleAgendaParticular } from "./AgendaParticularControle";

it("mantém retry idempotente, troca chave com o payload e descarta prévia atrasada", async () => {
  const gerar = vi.fn().mockReturnValueOnce("chave-1").mockReturnValueOnce("chave-2");
  const controle = criarControleAgendaParticular(gerar);
  let resolver!: () => void; const atrasada = new Promise<void>((resolve) => { resolver = resolve; });
  const revisaoAntiga = controle.iniciarPrevia();
  controle.alterar();
  resolver(); await atrasada;
  expect(controle.previaAindaAtual(revisaoAntiga)).toBe(false);
  const primeiro = controle.chavePara('{"inicio":"10:00","motivo":"confirmado"}');
  expect(controle.chavePara('{"inicio":"10:00","motivo":"confirmado"}')).toBe(primeiro);
  expect(controle.chavePara('{"inicio":"11:00","motivo":"confirmado"}')).toBe("chave-2");
  expect(gerar).toHaveBeenCalledTimes(2);
});
