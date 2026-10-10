import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { medir } from "../../scripts/medicao-ux/metricas.mjs";
import { rotuloEmVolta, semComentarios, tagDeFuso } from "../../scripts/medicao-ux/fuso.mjs";

// Medição de fuso e instante (docs/43 §6 item 6): os números novos do metricas.mjs ("campos de fuso fora do
// CampoFuso" e "instantes crus na tela") sobre uma árvore-fixture. O critério é o mesmo da trava
// src/app/fuso-instante.test.ts, que confere a igualdade na árvore real.
describe("metricas.medir: fuso e instante", () => {
  const raiz = mkdtempSync(join(tmpdir(), "medicao-fuso-"));
  afterAll(() => rmSync(raiz, { recursive: true, force: true }));
  const escrever = (rel: string, texto: string) => {
    const p = join(raiz, ...rel.split("/"));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, texto);
  };
  escrever("tailwind.config.ts", `export default { theme: { extend: { colors: { gray: { 200: "a" } } } } };`);
  escrever("src/components/CampoFuso.tsx", `export function CampoFuso({ id }) { return <><input id={id} list={l} /><datalist id={l}>{todosOsFusos().map((f) => <option key={f} value={f} />)}</datalist></>; }`);
  escrever("src/app/(app)/x/Livre.tsx", `<label>Fuso dos horários<input name="fusoOrigem" required /></label><datalist id="fusos-x"><option value="UTC" /></datalist><input name="fuso" type="hidden" value={f} />`);
  escrever("src/app/(app)/x/Migrado.tsx", `<label>Fuso dos horários<CampoFuso name="fusoOrigem" padrao={f} className="x" /></label>`);
  escrever("src/app/(app)/x/Instantes.tsx", "<p>Em {c.criadaEm.toISOString()} (UTC).</p><p>{formatar(c.criadaEm.toISOString())}</p><li key={`${c.id.toISOString()}-1`} />");
  escrever("src/app/(app)/x/Livre.test.tsx", `<input name="fuso" />`);

  const { n, secoes } = medir(raiz);
  it("campo e lista de fuso fora do CampoFuso; o hidden, o CampoFuso e os testes ficam fora", () => {
    expect([n.camposFusoFora, n.listasFusoFora]).toEqual([1, 1]);
    expect(secoes["7.6"].find((i) => i.nome === "campos de fuso fora do CampoFuso (critério da trava fuso-instante)")?.valor).toBe(1);
  });
  it("instante cru só quando impresso: formatado e key não contam", () => {
    expect(n.instantesCrus).toBe(1);
  });
  it("auxiliares: comentário vira espaço (mesma posição), rótulo em volta e tag de fuso", () => {
    const comentario = '/* <input name="fuso" /> */';
    expect(semComentarios(`a ${comentario} b`)).toBe(`a ${" ".repeat(comentario.length)} b`);
    const fonte = `<Campo rotulo="Fuso horário">{(c) => <input {...c} />}</Campo><label>Início<input /></label>`;
    expect(rotuloEmVolta(fonte, fonte.indexOf("<input"))).toBe("Fuso horário");
    expect(rotuloEmVolta(fonte, fonte.lastIndexOf("<input"))).toBe("Início");
    expect(rotuloEmVolta("<input />", 0)).toBeNull();
    expect(tagDeFuso('<input name="fuso" />')).toBe(true);
    expect(tagDeFuso('<input name="fuso" type="hidden" />')).toBe(false);
    expect(tagDeFuso('<input defaultValue={ed.fusoOrigem ?? ""} />')).toBe(true);
    expect(tagDeFuso("<input defaultValue={campoData(e.inicio, e.fusoOrigem)} />")).toBe(false);
  });
});
