import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const versao = JSON.parse(readFileSync("package.json", "utf8")).dependencies.react as string;

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return listar(caminho);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

const fontes = listar("src/components/conversa");

describe("decisão Q6: React no Inbox", () => {
  it("React 18: componentes de conversa sem API exclusiva do 19", () => {
    if (!/^[\^~]?18\./.test(versao)) return;
    for (const f of fontes) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/\buse\(|useActionState|useOptimistic|useFormStatus/);
    }
  });

  it("a decisão está registrada", () => {
    expect(readFileSync("docs/planejamento/decisao-react-inbox.md", "utf8")).toMatch(
      /Decisão: (manter 18\.3|atualizar para 19)/,
    );
  });
});
