import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// E7 (docs/42-auditoria-frontend-ux.md): overlay feito à mão — `fixed inset-0` com fundo — sem
// semântica de diálogo deixa o teclado tabulando pela tela de trás e o leitor de tela sem saber que
// há um modal. Todo overlay usa <Modal>/<Drawer> ou, quando precisa de casco próprio, role="dialog"
// com useDialogo (Escape, foco preso e devolvido).

const telas = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

/** Classe `fixed inset-0` em qualquer string — className="…", {"…" + …} ou template. */
const TEM_OVERLAY = /["`][^"`\n]*\bfixed inset-0\b/;

describe("overlays são diálogos acessíveis", () => {
  it("todo `fixed inset-0` tem role=\"dialog\" + aria-modal + useDialogo", () => {
    const ofensores = telas
      .filter(({ conteudo }) => TEM_OVERLAY.test(conteudo))
      // role/aria-modal fixos ou condicionais ao estado aberto (Drawer: role={open ? "dialog" : undefined}).
      .filter(({ conteudo }) => !(/role=(?:"dialog"|\{[^}]*"dialog")/.test(conteudo) && /aria-modal=(?:"true"|\{[^}]*\btrue\b)/.test(conteudo) && /\buseDialogo\(/.test(conteudo)))
      .map((t) => t.arquivo);
    expect(ofensores).toEqual([]);
  });

  it("a varredura acha os cascos (Modal, Drawer, fila de cobrança)", () => {
    const comOverlay = telas.filter(({ conteudo }) => TEM_OVERLAY.test(conteudo)).map((t) => t.arquivo);
    expect(comOverlay).toEqual(expect.arrayContaining(["src/components/Modal.tsx", "src/components/Drawer.tsx", "src/app/(app)/financeiro/FilaCobranca.tsx"]));
  });
});
