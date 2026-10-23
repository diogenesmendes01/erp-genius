import { expect, it, vi } from "vitest";
import { ligarAtalhoBusca, rolarAteMensagem, controleBuscaVisivel } from "./busca-conversa-dom";
it("rola só scrollTop local por geometria real e compara ID como atributo, sem seletor interpolado",()=>{const row={getAttribute:()=> 'id[\"inseguro\"]',getBoundingClientRect:()=>({top:700,height:100})};const scroll={querySelectorAll:vi.fn(()=>[row]),scrollTop:50,clientTop:2,clientHeight:300,getBoundingClientRect:()=>({top:100})};expect(rolarAteMensagem(scroll as unknown as HTMLElement,'id[\"inseguro\"]')).toBe(true);expect(scroll.scrollTop).toBe(548);expect(scroll.querySelectorAll).toHaveBeenCalledWith('[data-mensagem-id]');expect(rolarAteMensagem(scroll as unknown as HTMLElement,'ausente')).toBe(false);});
it("atalho regional exige foco visível dentro, sem composição/Alt/evento tratado/modal; limpa listener",()=>{let handler!:(e:KeyboardEvent)=>void;const active={closest:vi.fn(()=>null)},doc={activeElement:active};let dentro=true,visible=true;const region={ownerDocument:doc,contains:()=>dentro,isConnected:true,getClientRects:()=>visible?[{}]:[],closest:()=>null,addEventListener:vi.fn((_t,f)=>{handler=f;}),removeEventListener:vi.fn()};const abrir=vi.fn(),off=ligarAtalhoBusca(region as unknown as HTMLElement,abrir);const event=(o={})=>({key:'f',ctrlKey:true,metaKey:false,altKey:false,isComposing:false,defaultPrevented:false,preventDefault:vi.fn(),...o} as unknown as KeyboardEvent);const e=event();handler(e);expect(e.preventDefault).toHaveBeenCalledOnce();expect(abrir).toHaveBeenCalledOnce();for(const o of[{isComposing:true},{altKey:true},{defaultPrevented:true},{ctrlKey:false}])handler(event(o));dentro=false;handler(event());dentro=true;visible=false;handler(event());visible=true;active.closest.mockReturnValue({} as never);handler(event());expect(abrir).toHaveBeenCalledOnce();off();expect(region.removeEventListener).toHaveBeenCalledWith('keydown',handler);});
it("fallback de foco escolhe Buscar visível ou Mais ações sem alterar corte móvel",()=>{const button=(label:string,visible:boolean)=>({getAttribute:()=>label,isConnected:true,getClientRects:()=>visible?[{}]:[],closest:()=>null});const more=button('Mais ações da conversa',true),search=button('Buscar na conversa',false);const region={querySelectorAll:()=>[search,more]};expect(controleBuscaVisivel(region as unknown as HTMLElement)).toBe(more);search.getClientRects=()=>[{}];expect(controleBuscaVisivel(region as unknown as HTMLElement)).toBe(search);});

it.each([
  { comando: "Ctrl", ctrlKey: true, metaKey: false },
  { comando: "Meta", ctrlKey: false, metaKey: true },
])("C3: $comando+F abre a busca, sem capturar Shift ou Alt", ({ ctrlKey, metaKey }) => {
  let tecla!: (e: KeyboardEvent) => void;
  const foco = { closest: () => null };
  const regiao = {
    ownerDocument: { activeElement: foco }, contains: () => true,
    isConnected: true, getClientRects: () => [{}], closest: () => null,
    addEventListener: vi.fn((_tipo, handler) => { tecla = handler; }), removeEventListener: vi.fn(),
  };
  const abrir = vi.fn();
  const desligar = ligarAtalhoBusca(regiao as unknown as HTMLElement, abrir);
  const evento = (shiftKey = false, altKey = false) => ({
    key: shiftKey ? "F" : "f", ctrlKey, metaKey, shiftKey, altKey,
    isComposing: false, defaultPrevented: false, preventDefault: vi.fn(),
  } as unknown as KeyboardEvent);
  try {
    const simples = evento();
    tecla(simples);
    expect(simples.preventDefault).toHaveBeenCalledOnce();
    expect(abrir).toHaveBeenCalledOnce();
    abrir.mockClear();
    for (const [shift, alt] of [[true, false], [false, true], [true, true]]) {
      const modificado = evento(shift, alt);
      tecla(modificado);
      expect(modificado.preventDefault).not.toHaveBeenCalled();
      expect(abrir).not.toHaveBeenCalled();
    }
  } finally { desligar(); }
});
