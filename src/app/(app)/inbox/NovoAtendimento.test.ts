import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ abrirAtendimentoInstitucional: vi.fn() }));

import { NovoAtendimento } from "./NovoAtendimento";

describe("NovoAtendimento", () => {
  const painel = (opcoes: object) => renderToStaticMarkup(createElement(NovoAtendimento, { opcoes } as never));
  const FALTA_CANAL = "A administração precisa disponibilizar um canal ativo";

  it("selects cabem no celular (w-full, min-w-0) e usam o raio de campo do DS, não `rounded` (DS-C)", () => {
    const html = painel({ destinos: [], numeros: [] });
    expect(html).toContain('class="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2"');
    expect(html).toContain('class="w-full rounded-md border border-gray-300 px-3 py-2"');
    expect(html.match(/<label class="grid min-w-0 max-w-full gap-1 text-sm">/g)).toHaveLength(2);
  });

  it("vendedor sem lead na carteira: orienta a cadastrar o lead — não culpa a falta de canal", () => {
    const html = painel({ destinos: [], numeros: [], comercial: true });
    expect(html).toContain("Nenhum lead na sua carteira para iniciar uma conversa");
    expect(html).not.toContain(FALTA_CANAL);
  });

  it("papel não comercial sem destinatário: mensagem de escopo, sem falar em canal", () => {
    const html = painel({ destinos: [], numeros: [], comercial: false });
    expect(html).toContain("Nenhum destinatário no seu escopo");
    expect(html).not.toContain(FALTA_CANAL);
    expect(html).not.toContain("Nenhum lead na sua carteira");
  });

  it("há destinatário mas nenhum canal ativo: aí sim a administração precisa disponibilizar o canal", () => {
    const html = painel({ destinos: [{ chave: "SECRETARIA:a1", nome: "Secretaria · Ana", finalidade: "SECRETARIA", alunoId: "a1" }], numeros: [], comercial: false });
    expect(html).toContain(FALTA_CANAL);
    expect(html).not.toContain("Nenhum destinatário no seu escopo");
  });
});

it("compacto retira só moldura do formulário e mantém destinatário/canal/action única",()=>{
 const opcoes={destinos:[{chave:"SECRETARIA:a1",nome:"Secretaria · Ana",finalidade:"SECRETARIA",alunoId:"a1"}],numeros:[],comercial:false};
 const h=renderToStaticMarkup(createElement(NovoAtendimento,{opcoes,compacto:true} as never));const form=h.match(/<form[^>]*class="([^"]+)"/)?.[1]??"";
 expect(form).not.toContain("rounded-lg");expect(form).not.toContain("border-gray-200");expect(form).not.toContain("bg-surface");expect(form.split(/\s+/)).not.toContain("p-3");
 expect(h.match(/<form/g)).toHaveLength(1);expect(h).toContain("Finalidade e destinatário");expect(h).toContain("Canal da escola");expect(h).toContain("Abrir atendimento");
 const normal=renderToStaticMarkup(createElement(NovoAtendimento,{opcoes} as never));expect(normal).toContain("rounded-lg border border-gray-200 bg-surface p-3");
});
