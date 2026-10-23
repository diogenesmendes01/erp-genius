import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LinhaCampo } from "./LinhaCampo";
it("linha52 com ícone, valor quebrável, rótulo e marcaIA acessível", () => {
 const h = renderToStaticMarkup(createElement(LinhaCampo, { icone: "☎", valor: "+5500000000301", rotulo: "WhatsApp", ia: true }));
 for (const t of ["min-h-[52px]", "text-[14.5px]", "text-[12.5px]", "[overflow-wrap:anywhere]", "WhatsApp", "text-ai-700", 'aria-label="Preenchido pela Aria"']) expect(h).toContain(t);
});
it("semIA não inventa origem e mantém conteúdoReact escapado", () => {
 const h = renderToStaticMarkup(createElement(LinhaCampo, { icone: "x", valor: "<script>x</script>", rotulo: "Rótulo" }));
 expect(h).not.toContain("Preenchido pela Aria"); expect(h).toContain("&lt;script&gt;");
});
