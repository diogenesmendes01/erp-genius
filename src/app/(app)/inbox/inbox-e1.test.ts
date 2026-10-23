import { existsSync, readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

const raiz = "src/app/(app)/inbox";
it("componentes substituídos e cabeçalho antigo não voltam", () => {
  expect(existsSync(raiz + "/PainelFiltros.tsx")).toBe(false);
  expect(existsSync("src/components/conversa/NotaNaThread.tsx")).toBe(false);
  expect(readFileSync(raiz + "/AcoesAtendimento.tsx", "utf8")).not.toMatch(/export\s+(?:function|const)\s+AcoesAtendimento\b/);
  expect(readFileSync(raiz + "/page.tsx", "utf8")).not.toMatch(/<h1|NovoAtendimento opcoes/);
});
it("horas e contadores do Inbox usam mono com números tabulares", () => {
  for (const arquivo of ["ItemConversa.tsx", "ChipsFiltro.tsx", "ColunaConversas.tsx", "PainelContato.tsx"]) {
    expect(readFileSync(raiz + "/" + arquivo, "utf8"), arquivo).toMatch(/font-mono[^"`]*tabular-nums|tabular-nums[^"`]*font-mono/);
  }
  for (const arquivo of ["src/components/conversa/BalaoMensagem.tsx", "src/components/SeloNaoLidasInbox.tsx"]) {
    expect(readFileSync(arquivo, "utf8"), arquivo).toMatch(/font-mono[^"`]*tabular-nums|tabular-nums[^"`]*font-mono/);
  }
});
it("telas do Inbox preservam sentence case", () => {
  const arquivos = readdirSync(raiz).filter(f => f.endsWith(".tsx"));
  expect(arquivos.filter(f => /\buppercase\b/.test(readFileSync(raiz + "/" + f, "utf8")))).toEqual([]);
});
