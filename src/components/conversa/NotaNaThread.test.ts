import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { NotaInternaThread } from "@/server/whatsapp/consultas-inbox";
import { NotaNaThread } from "./NotaNaThread";

const nota = (origem: NotaInternaThread["origem"], autorNome: string | null): NotaInternaThread => ({
  id: "e1", nota: "linha 1\n<script>linha 2</script>", autorNome, criadoEm: "2026-10-17T15:30:00.000Z", origem,
});

describe("NotaNaThread", () => {
  it("expõe nota do atendimento só para a equipe, autor, quebras e hora no fuso", () => {
    const h = renderToStaticMarkup(createElement(NotaNaThread, { n: nota("atendimento", "Ana"), fuso: "America/Sao_Paulo" }));
    expect(h).toContain('role="note"');
    expect(h).toContain("Nota interna · só equipe");
    expect(h).toContain("Ana");
    expect(h).toContain("whitespace-pre-wrap");
    expect(h).toContain("linha 1\n&lt;script&gt;linha 2&lt;/script&gt;");
    expect(h).toContain("12:30");
    expect(h).not.toContain("Opções da mensagem");
  });

  it("identifica origem da oportunidade e autor ausente", () => {
    const h = renderToStaticMarkup(createElement(NotaNaThread, { n: nota("oportunidade", null), fuso: null }));
    expect(h).toContain("Nota da oportunidade · só equipe");
    expect(h).toContain("Autor não informado");
  });
});
