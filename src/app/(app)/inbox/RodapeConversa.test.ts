import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it,vi } from 'vitest';
import { RodapeConversa } from './RodapeConversa';
const base={atendimentoId:'a',podeEnviar:true,capacidades:[],aoEnviarTexto:vi.fn(async()=>({ok:true as const})),aoEnviarMidia:vi.fn(async()=>({ok:true as const})),aoNota:vi.fn(async()=>({ok:true as const}))};
it('compositor oferece abas sem selecionar nota, dica e campo nomeado sem moldura duplicada',()=>{
 const h=renderToStaticMarkup(createElement(RodapeConversa,{...base,modo:'compositor'}));
 expect(h).toContain('role="tab"');expect(h).toContain('aria-selected="true"');expect(h).toContain('Responder');expect(h).toContain('Nota interna');expect(h).toContain('/ respostas rápidas');expect(h).toContain('Escreva uma mensagem');expect(h).not.toContain('@ mencionar');expect(h).not.toContain('bg-composer');
});
it('nota inicial mantém aviso e controles internos, sem agendar/anexar/voz',()=>{
 const h=renderToStaticMarkup(createElement(RodapeConversa,{...base,modo:'compositor',abaInicial:'nota',aoAgendar:()=>{}}));
 expect(h).toContain('Escreva uma nota interna');expect(h).toContain('fica só para a equipe');expect(h).not.toContain('Agendar mensagem');expect(h).not.toContain('aria-label="Anexar"');expect(h).not.toContain('Gravar mensagem');
});
it('variante travada só mostra comandos fornecidos e nunca campo',()=>{
 const h=renderToStaticMarkup(createElement(RodapeConversa,{...base,modo:'travado',travado:{texto:'Aria aguarda aprovação.',aoNota(){},aoAssumir(){}}}));
 expect(h).toContain('Aria aguarda aprovação.');expect(h).toContain('Nota interna');expect(h).toContain('Assumir para responder');expect(h).not.toContain('<textarea');
 const sem=renderToStaticMarkup(createElement(RodapeConversa,{...base,modo:'travado',travado:{texto:'Aguardando',aoNota(){}}}));expect(sem).not.toContain('Assumir para responder');
});

it("332 Nova tarefa aparece só com callback real, mesmo sem permissão de envio",()=>{const criar=()=>{};expect(renderToStaticMarkup(createElement(RodapeConversa,{...base,modo:"compositor",podeEnviar:false,aoCriarTarefa:criar}))).toContain('aria-label="Nova tarefa"');expect(renderToStaticMarkup(createElement(RodapeConversa,{...base,modo:"compositor"}))).not.toContain('aria-label="Nova tarefa"');});
