import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  ESTADOS, TAMANHOS, TEMAS, caminhoNoNpm, combinacoes, nomeDaCaptura, tipoDoArquivo,
} from "../../scripts/visual/nucleo-captura.mjs";
import { exigirBancoDescartavel } from "../../scripts/visual/demo-inbox";

describe("harness visual do Inbox", () => {
  it("CLI documenta as opções sem abrir browser nem banco", () => {
    const r = spawnSync(process.execPath, ["scripts/visual/capturar-inbox.mjs", "--help"], { cwd: process.cwd(), encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("--alvo");
    expect(r.stdout).toContain("--estado");
  });
  it("gera os doze pares de captura da conversa nos três tamanhos e dois temas", () => {
    expect(TAMANHOS).toEqual({ desktop: [1440, 900], tablet: [1024, 768], celular: [390, 844] });
    expect(TEMAS).toEqual(["escuro", "claro"]);
    const pares = combinacoes({ alvos: ["app", "prototipo"], estados: ["conversa"] });
    expect(pares).toHaveLength(12);
    expect(pares.map((p) => nomeDaCaptura(p.alvo, p.tema, p.tamanho, p.estado))).toContain("prototipo-escuro-celular-conversa.png");
    expect(nomeDaCaptura("app", "claro", "desktop", "menu-mais")).toBe("app-claro-desktop-menu-mais.png");
  });

  it("respeita tamanhos por estado e não captura no protótipo um estado só do app", () => {
    expect(combinacoes({ alvos: ["app"], estados: ["celular-lista"] }).map((c) => c.tamanho)).toEqual(["celular", "celular"]);
    expect(combinacoes({ alvos: ["prototipo"], estados: ["sem-selecao"] })).toEqual([]);
    for (const [nome, estado] of Object.entries(ESTADOS)) if (estado.referencia) expect(existsSync(estado.referencia), nome).toBe(true);
  });

  it("serve recursos unpkg apenas de módulos locais e com MIME apropriado", () => {
    expect(caminhoNoNpm("https://unpkg.com/react@18.3.1/umd/react.production.min.js", "/r/node_modules")).toBe(path.join("/r/node_modules", "react/umd/react.production.min.js"));
    expect(caminhoNoNpm("https://unpkg.com/@babel/standalone@7.29.0/babel.min.js", "/r/node_modules")).toBe(path.join("/r/node_modules", "@babel/standalone/babel.min.js"));
    expect(caminhoNoNpm("https://unpkg.com/lucide-static@0.460.0/font/lucide.css", "/n")).toBe(path.join("/n", "lucide-static/font/lucide.css"));
    expect(caminhoNoNpm("https://unpkg.com/lucide-static@0.460.0/font/lucide.woff2?t=42", "/n")).toBe(path.join("/n", "lucide-static/font/lucide.woff2"));
    expect(() => caminhoNoNpm("https://unpkg.com/react@18.3.1/../../secret", "/r/node_modules")).toThrow();
    expect(() => caminhoNoNpm("https://example.com/react@18.3.1/index.js", "/r/node_modules")).toThrow();
    expect(() => caminhoNoNpm("https://unpkg.com/react@18.3.1/%2e%2e/secret", "/r/node_modules")).toThrow();
    expect(tipoDoArquivo("a.css")).toBe("text/css");
    expect(tipoDoArquivo("a.js")).toBe("application/javascript");
    expect(tipoDoArquivo("a.woff2")).toBe("font/woff2");
    expect(tipoDoArquivo("a.ttf")).toBe("font/ttf");
    expect(tipoDoArquivo("a.bin")).toBe("application/octet-stream");
  });

  it("só autoriza host e porta locais com nome EXATO da lista de perfis", () => {
    for (const banco of ["erp_genius_test", "erp_genius_test_dev_email", "erp_genius_test_dev_gravacoes", "erp_genius_test_tester", "erp_genius_test_ciint"]) {
      expect(() => exigirBancoDescartavel(`postgres://postgres:teste@localhost:54329/${banco}`)).not.toThrow();
    }
    expect(() => exigirBancoDescartavel("postgres://postgres:teste@127.0.0.1:54329/erp_genius_test_tester")).not.toThrow();
    for (const url of [
      "postgres://postgres:teste@db.prod:54329/erp_genius_test",
      "postgres://postgres:teste@localhost:5432/erp_genius_test",
      "postgres://postgres:teste@localhost:54329/erp_genius_test_not_in_list",
      "postgres://postgres:teste@localhost:54329/outro",
      "postgres://postgres:teste@localhost:54329/erp_genius_test?schema=production",
      "not-a-url",
    ]) expect(() => exigirBancoDescartavel(url), url).toThrow("banco descartável");
  });
});
