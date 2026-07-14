import { describe, it, expect } from "vitest";
import { ErroDriver } from "./canal";
import { lerMidiaParaEnvio, midiaSaidaDoAutor, tipoPorMime } from "./midia";

// Posse do anexo de saída (review PR #51 P1-2): a checagem é canônica por segmentos —
// prefixo de string aceitaria traversal que resolve para arquivo de outro usuário/pasta.

describe("midiaSaidaDoAutor", () => {
  const u1 = "user-aaa";
  const u2 = "user-bbb";

  it("aceita só o anexo do próprio autor em whatsapp-out", () => {
    expect(midiaSaidaDoAutor(`/api/files/whatsapp-out/${u1}/123-foto.jpg`, u1)).toBe(true);
  });

  it("recusa anexo de outro usuário, outra pasta e agregados de fora", () => {
    expect(midiaSaidaDoAutor(`/api/files/whatsapp-out/${u2}/123-foto.jpg`, u1)).toBe(false);
    expect(midiaSaidaDoAutor("/api/files/999-comprovante.pdf", u1)).toBe(false);
    expect(midiaSaidaDoAutor("/api/files/whatsapp/123-inbound.ogg", u1)).toBe(false);
  });

  it("recusa traversal e caminhos malformados", () => {
    expect(midiaSaidaDoAutor(`/api/files/whatsapp-out/${u1}/../${u2}/x.jpg`, u1)).toBe(false);
    expect(midiaSaidaDoAutor(`/api/files/whatsapp-out/${u1}/..`, u1)).toBe(false);
    expect(midiaSaidaDoAutor(`/api/files/whatsapp-out/${u1}/a\\..\\b.jpg`, u1)).toBe(false);
    expect(midiaSaidaDoAutor(`/files/whatsapp-out/${u1}/x.jpg`, u1)).toBe(false);
    expect(midiaSaidaDoAutor(`/api/files/whatsapp-out/${u1}/`, u1)).toBe(false);
  });
});

describe("lerMidiaParaEnvio — defesa em profundidade", () => {
  it("recusa caminho fora de whatsapp-out mesmo que exista no storage", async () => {
    await expect(lerMidiaParaEnvio("/api/files/999-comprovante.jpg")).rejects.toMatchObject({
      motivo: "midia_fora_do_storage_de_envio",
    } satisfies Partial<ErroDriver>);
    await expect(lerMidiaParaEnvio("/api/files/whatsapp/123-inbound.ogg")).rejects.toMatchObject({
      motivo: "midia_fora_do_storage_de_envio",
    } satisfies Partial<ErroDriver>);
  });

  it("recusa caminho que nem é do /api/files", async () => {
    await expect(lerMidiaParaEnvio("https://evil.example/x.jpg")).rejects.toMatchObject({
      motivo: "midia_caminho_invalido",
    } satisfies Partial<ErroDriver>);
  });
});

describe("tipoPorMime", () => {
  it("normaliza mime com codecs e mapeia para o enum", () => {
    expect(tipoPorMime("audio/ogg;codecs=opus")).toBe("AUDIO");
    expect(tipoPorMime("image/jpeg")).toBe("IMAGEM");
    expect(tipoPorMime("application/pdf")).toBe("DOCUMENTO");
    expect(tipoPorMime("text/plain")).toBe("OUTRO");
  });
});
