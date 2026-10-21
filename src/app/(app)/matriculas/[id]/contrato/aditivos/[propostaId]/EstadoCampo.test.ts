import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EstadoCampo } from "./EstadoCampo";
it("aplicação própria registrada não permanece descrita como acerto pendente", () => {
 const html=renderToStaticMarkup(createElement(EstadoCampo,{aplicada:true,exigeAcerto:true}));
 expect(html).toContain("Aplicação registrada"); expect(html).toContain("vigência aprovada"); expect(html).not.toContain("pendente");
});
it("campo não aplicado conserva a pendência financeira", () => {
 expect(renderToStaticMarkup(createElement(EstadoCampo,{aplicada:false,exigeAcerto:true}))).toContain("exige acerto próprio aprovado");
 expect(renderToStaticMarkup(createElement(EstadoCampo,{aplicada:false,exigeAcerto:false}))).toContain("ainda pendente");
});
