import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "./mensagens";

const telas = (readdirSync("src/app", { recursive: true }) as string[])
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => ({ arquivo: f, conteudo: readFileSync(join("src/app", f), "utf-8") }));

describe("mensagens de resultado incerto", () => {
  it("instruem repetir a MESMA entrada, nunca revisar os dados", () => {
    for (const msg of [MSG_RESULTADO_INCERTO, MSG_DECISAO_INCERTA]) {
      expect(msg).toMatch(/mesm[ao]|sem alterar/);
      expect(msg).not.toMatch(/confira os dados/i);
    }
  });

  it("nenhuma tela convida a alterar os dados depois de um resultado não confirmado", () => {
    const proibidas = /(Resultado não confirmado|Não foi possível confirmar)[^"]*Confira (os dados )?e tente novamente/;
    const ofensores = telas.filter((t) => proibidas.test(t.conteudo)).map((t) => t.arquivo);
    expect(ofensores).toEqual([]);
  });
});
