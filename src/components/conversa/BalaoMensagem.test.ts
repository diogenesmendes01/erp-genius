import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import { notaComoMensagem } from "./itens-thread";
import { BalaoMensagem } from "./BalaoMensagem";
import { CartaoPix } from "./CartaoPix";
import { EnqueteLeitura } from "./EnqueteLeitura";
import { QuadroDocumento } from "./VisualizadorMidia";
import { AVISO_RECURSO_MOTOR, type RecursoMotor } from "./recursos-canal";

const base: MensagemThread = {
  id: "m1", direcao: "SAIDA", tipo: "TEXTO", corpo: "Olá", midiaPath: null, status: "ENVIADA", origem: "HUMANO",
  autorNome: null, templateNome: null, criadoEm: "2026-10-17T15:30:00.000Z", participanteNome: null, favorita: false, clientMessageId: null,
};
function html(p: Partial<MensagemThread>, o: { menuAberto?: boolean; recursos?: (r: RecursoMotor) => boolean } = {}) {
  return renderToStaticMarkup(createElement(BalaoMensagem, {
    m: { ...base, ...p }, fuso: "America/Sao_Paulo", aoComando: () => {}, recursos: o.recursos ?? (() => false), menuAberto: o.menuAberto,
  }));
}

describe("BalaoMensagem", () => {
  it("chevron vem antes de autor/texto, flutua à direita e não é absoluto", () => {
    const h = html({ corpo: "Perfeito. Quanto fica?", autorNome: "Camila" });
    const gatilho = h.indexOf('aria-label="Opções da mensagem"');
    expect(gatilho).toBeLessThan(h.indexOf("Camila"));
    expect(gatilho).toBeLessThan(h.indexOf("Perfeito. Quanto fica?"));
    expect(h).toMatch(/aria-label="Opções da mensagem"[^>]*class="[^"]*\bfloat-right\b/);
    expect(h).not.toContain("absolute right-1 top-1");
  });
  it("chevron aparece em hover/foco/toque e fica visível com menu aberto", () => {
    const h = html({});
    for (const c of ["group relative", "opacity-0", "group-hover:opacity-100", "group-focus-within:opacity-100", "[@media(hover:none)]:opacity-100"]) expect(h).toContain(c);
    expect(html({}, { menuAberto: true })).toMatch(/aria-label="Opções da mensagem"[^>]*aria-expanded="true"[^>]*class="[^"]*\bopacity-100\b/);
  });
  it("painel aberto tem posição fixa e altura limitada com rolagem interna", () => {
    const h = html({}, { menuAberto: true });
    expect(h).toMatch(/role="menu"[^>]*style="position:fixed/);
    expect(h).toContain("max-height:calc(100dvh - 16px)");
    expect(h).toContain("overflow-y:auto");
    expect(h).not.toContain("absolute right-0 top-7");
  });
  it("autor de cada mensagem", () => {
    expect(html({ origem: "CELULAR", direcao: "SAIDA" })).toContain("Enviada pelo celular");
    expect(html({ origem: "IA", direcao: "SAIDA" })).toContain("Aria");
    expect(html({ origem: "HUMANO", autorNome: "Camila", direcao: "SAIDA" })).toContain("Camila");
    expect(html({ origem: "CRON", direcao: "SAIDA" })).toContain("Sistema");
    expect(html({ direcao: "ENTRADA", origem: null, participanteNome: "Pai do João" })).toContain("Pai do João");
  });
  it("status FALHOU aparece como erro, não como ✓✓", () => { expect(html({ status: "FALHOU", direcao: "SAIDA" })).toContain("Não enviada"); });
  it("✓✓ de lida usa a cor de marca definida para texto", () => {
    expect(html({ status: "LIDA" })).toMatch(/<svg[^>]*class="[^"]*text-brand-700/);
  });
  it("editar/apagar/reagir desabilitados com o aviso do motor", () => {
    const h = html({ direcao: "SAIDA" }, { menuAberto: true });
    expect(h).toContain(AVISO_RECURSO_MOTOR);
    for (const r of ["Editar", "Apagar", "Reagir"]) expect(h).toMatch(new RegExp(`<button[^>]* disabled=\"\"[^>]*>(?:(?!</button>).)*${r}`));
  });
  it("com o recurso disponível os itens ficam habilitados e sem aviso", () => {
    const h = html({ direcao: "SAIDA" }, { menuAberto: true, recursos: () => true });
    expect(h).not.toContain(AVISO_RECURSO_MOTOR);
    expect(h).not.toMatch(/<button[^>]* disabled=""/);
  });
  it("menu fechado não mostra itens; horário usa o fuso", () => {
    const h = html({});
    expect(h).not.toContain('role="menu"');
    expect(h).toContain("12:30");
  });
  it("mídia vem de /api/files e não de api do motor", () => {
    const h = html({ tipo: "IMAGEM", midiaPath: "/api/files/a/foto.png", corpo: "legenda" });
    expect(h).toContain('src="/api/files/a/foto.png"');
    expect(h).toContain("legenda");
    expect(html({ tipo: "DOCUMENTO", midiaPath: "/api/files/a/boleto.pdf", corpo: null })).toContain("boleto.pdf");
  });
  it("favorita mostra a estrela e o rótulo do menu muda", () => {
    expect(html({ favorita: true }, { menuAberto: true })).toContain("Remover dos favoritos");
  });
});

describe("EnqueteLeitura e CartaoPix", () => {
  it("enquete só mostra totais, sem controle de voto", () => {
    const h = renderToStaticMarkup(createElement(EnqueteLeitura, { enquete: { nome: "Dia?", selecionavel: 1, opcoes: [{ texto: "Seg", votos: 2 }, { texto: "Ter", votos: 1 }] } }));
    expect(h).toContain("Dia?");
    expect(h).toContain("3 votos");
    expect(h).not.toContain("<button");
  });
  it("pix mostra valor e botão de copiar", () => {
    const h = renderToStaticMarkup(createElement(CartaoPix, { pix: { quantia: "R$ 150,00", solicitante: "Escola", codigoCopiaCola: "000201" } }));
    expect(h).toContain("R$ 150,00");
    expect(h).toContain("Copiar código Pix");
  });
});

describe("QuadroDocumento", () => {
  const quadro = (url: string) => renderToStaticMarkup(createElement(QuadroDocumento, { url, nome: "boleto.pdf" }));
  it("PDF embutido sem sandbox (o visualizador de PDF do navegador não roda em iframe com sandbox) e com link para nova aba", () => {
    const h = quadro("/api/files/a/boleto.pdf");
    expect(h).toMatch(/<iframe[^>]* src="\/api\/files\/a\/boleto.pdf"/);
    expect(h).not.toContain("sandbox");
    expect(h).toMatch(/<a[^>]* target="_blank"[^>]* rel="noopener noreferrer"[^>]*>Abrir em nova aba<\/a>/);
  });
  it("documento que não é PDF não vai para iframe: só o link", () => {
    const h = quadro("/api/files/a/planilha.xlsx");
    expect(h).not.toContain("<iframe");
    expect(h).toContain("Abrir em nova aba");
  });
});

const visual = (p: Partial<MensagemThread>, extra: Partial<ComponentProps<typeof BalaoMensagem>> = {}) => renderToStaticMarkup(createElement(BalaoMensagem,{m:{...base,...p},fuso:"America/Sao_Paulo",aoComando:()=>{},recursos:()=>false,...extra}));
describe("balões por autoria e sequência", () => {
  it("entrada tem cauda esquerda e participante só em grupo",()=>{
    const h=visual({direcao:"ENTRADA",origem:null},{autor:"cliente"});
    for(const c of ["bg-entry","rounded-tl-[4px]","max-w-[min(560px,72%)]","leading-[1.45]"])expect(h).toContain(c);
    expect(h).not.toContain('mb-[3px]');
    expect(visual({direcao:"ENTRADA",participanteNome:"Pai do João"},{autor:"cliente"})).toContain("Pai do João");
  });
  it("humano próprio é Você; outra pessoa mantém nome e cor de contraste306",()=>{
    expect(visual({propria:true,autorNome:"Carlos"},{autor:"humano"})).toContain("Você");
    const h=visual({propria:false,autorNome:"Camila"},{autor:"humano"});
    expect(h).toContain("Camila");expect(h).toContain("text-brand-800");expect(h).toContain("bg-entry-accent");
  });
  it("Aria roxa e primeira autoria; sequência sem autor/cauda",()=>{
    const h=visual({origem:"IA"},{autor:"aria"});expect(h).toContain("bg-bubble-ia");expect(h).toContain("Aria · IA");expect(h).toContain("text-ai-700");
    const seq=visual({origem:"IA"},{autor:"aria",emSequencia:true});expect(seq).not.toContain("rounded-tr-[4px]");expect(seq).not.toContain("Aria · IA");
  });
  it("hora mono10,5/status13 e destaque de busca preservam erro/lida",()=>{
    const h=visual({status:"LIDA"},{autor:"humano",destacada:true});expect(h).toContain("font-mono");expect(h).toContain("text-[10.5px]");expect(h).toMatch(/<svg[^>]*width="13"/);expect(h).toContain("ring-2 ring-amber-600");
    expect(visual({status:"FALHOU"},{autor:"humano"})).toContain("Não enviada");
  });
  it("nota preserva origem/autor/hora/XSS e não cria menu/status/mídia mesmo com props impróprias",()=>{
    const n={id:"n",nota:"linha1\n<script>segura</script>",autorNome:"Ana",criadoEm:"2026-10-17T15:30:00Z",origem:"atendimento" as const};
    const h=visual({...notaComoMensagem(n),tipo:"IMAGEM",midiaPath:"/api/whatsapp/midia/m",status:"ENVIADA",templateNome:"modelo externo"},{autor:"nota",nota:n,menuAberto:true});
    for(const c of ['role="note"','data-nota-id="n"',"bg-bubble-note","border-dashed","border-amber-600","Nota interna · só equipe","Ana","12:30","linha1\n&lt;script&gt;segura&lt;/script&gt;"])expect(h).toContain(c);
    for(const proibido of ["Opções da mensagem",'role="menu"','title="Enviada"',"<img",'Modelo:'])expect(h).not.toContain(proibido);
    const oportunidade={...n,origem:"oportunidade" as const,autorNome:null};const outro=visual(notaComoMensagem(oportunidade),{autor:"nota",nota:oportunidade});expect(outro).toContain("Nota da oportunidade · só equipe");expect(outro).toContain("Autor não informado");
  });
  it("mensagem sem comandos também não oferece gatilho sem ação",()=>{expect(visual({},{comandos:[]})).not.toContain("Opções da mensagem");});
});
