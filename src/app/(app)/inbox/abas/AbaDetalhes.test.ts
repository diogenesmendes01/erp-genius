import { elementos } from "@/test/tela-sem-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { DetalhesPainel } from "@/server/inbox/painel-detalhes";
import type { CapacidadesPainel } from "@/server/inbox/permissoes";
import { AbaDetalhes } from "./AbaDetalhes";
import { BlocoB2B } from "./BlocoB2B";

const capacidades: CapacidadesPainel = { veLead: true, verContato: true, editarContato: false, editarTags: false, criarTag: false, moverEtapa: false, tarefas: false, tarefasEquipe: false, desfazerAria: false, verEmpresa: false };
const dados: DetalhesPainel = { cadastroPessoa:null, informacoesCadastro:null,
  pessoa: { id: "p 1", nome: "Mariana", email: "mariana@x.com", cidade: "Salvador", cargo: null, linkedin: null, origemCanal: "WHATSAPP", telefone: "+5500000000001", empresa: null },
  oportunidade: { id: "op 1", titulo: "Inglês", produto: "Inglês Intensivo B1", valor: "650.00", moeda: "BRL", etapa: "PROPOSTA", b2b: false }, b2b: null,
  campos: [{ id: "obj", nome: "Objetivo", tipo: "TEXTO", opcoes: [], obrigatorio: false, valor: "Trabalho", ia: true }],
};
const html = (extra: Partial<DetalhesPainel> = {}, cap = capacidades) => renderToStaticMarkup(createElement(AbaDetalhes, { dados: { ...dados, ...extra }, capacidades: cap }));
it("B2C apresenta oportunidade com valor não mensal, contato e campo com autoria Aria", () => {
  const h = html();
  expect(h).toContain("Inglês Intensivo B1 · R$ 650,00 · Proposta");
  expect(h).toContain('href="/funil?o=op%201"');
  expect(h).toContain('<span class="font-mono">+5500000000001</span>');
  for (const s of ["mariana@x.com", "Salvador", "Origem do contato", "Perfil", "Objetivo", "Trabalho", 'aria-label="Preenchido pela Aria"']) expect(h).toContain(s);
  for (const s of ["/mês", "CPF", "Idade", "Preferências"]) expect(h).not.toContain(s);
});
it("valor ausente difere de zero e moeda ausente não assume BRL", () => {
  expect(html({ oportunidade: { ...dados.oportunidade!, valor: null } })).toContain("Sem valor");
  expect(html({ oportunidade: { ...dados.oportunidade!, valor: "0" } })).toContain("R$ 0,00");
  expect(html({ oportunidade: { ...dados.oportunidade!, moeda: null } })).toContain("moeda não definida");
});
it("campos nulos e booleanos são legíveis sem perder false ou zero", () => {
  const h = html({ pessoa: { ...dados.pessoa!, cidade: null }, campos: [
    { ...dados.campos[0], id: "nao", nome: "Aceita", tipo: "BOOLEANO", valor: false, ia: false },
    { ...dados.campos[0], id: "zero", nome: "Quantidade", tipo: "NUMERO", valor: 0, ia: false },
    { ...dados.campos[0], id: "data", nome: "Início", tipo: "DATA", valor: "2026-10-24", ia: false },
  ] });
  expect(h).toContain(">—</div>"); expect(h).toContain(">Não</div>"); expect(h).toContain(">0</div>"); expect(h).toContain("24/10/2026");
  expect(h).not.toContain("Preenchido pela Aria");
});
it("ficha completa exige capacidade própria e codifica identidade", () => {
  expect(html()).toContain('href="/contatos?c=p%201"');
  expect(html({}, { ...capacidades, verContato: false })).not.toContain("/contatos?c=");
});
it("sem Pessoa não apresenta perfil nem links; ausência de oportunidade tem mensagem própria", () => {
  const semPessoa = html({ pessoa: null });
  expect(semPessoa).toContain("Oportunidade atual"); expect(semPessoa).toContain("Sem dados de contato para esta oportunidade.");
  expect(semPessoa).not.toContain("Objetivo"); expect(semPessoa).not.toContain("/contatos?c=");
  expect(html({ pessoa: null, oportunidade: null })).toContain("Sem oportunidade visível para você.");
});
const bloco = { empresa: { id: "e 1", nome: "Grupo Ventura" }, decisor: false, participantes: [
  { pessoaId: "p1", nome: "Ana Ventura", papel: "DECISOR" as const, cargo: "RH", naConversa: true, hrefConversa: "/inbox?c=atual" },
  { pessoaId: "p2", nome: "Bia", papel: "OUTRO" as const, cargo: null, naConversa: false, hrefConversa: "/inbox?c=permitido" },
  { pessoaId: "p3", nome: "Caio", papel: "OUTRO" as const, cargo: null, naConversa: false, hrefConversa: null },
] };
it("B2B usa href autorizado, não cria link para interlocutor ou alvo negado", () => {
  const h = renderToStaticMarkup(createElement(BlocoB2B, { bloco, verEmpresa: false }));
  expect(h).toContain("Na conversa"); expect(h.match(/>Falar com</g)).toHaveLength(1);
  expect(h).toContain('href="/inbox?c=permitido"'); expect(h).not.toContain("/inbox?c=atual"); expect(h).not.toContain("/empresas/");
  expect(renderToStaticMarkup(createElement(BlocoB2B, { bloco, verEmpresa: true }))).toContain('href="/empresas/e%201"');
});
it("empresa e perfil B2B preservam o nome PJ e dados distintos da Pessoa", () => {
  const h = html({ b2b: bloco, oportunidade: { ...dados.oportunidade!, b2b: true }, pessoa: { ...dados.pessoa!, cargo: "Analista", linkedin: "https://linkedin.test/mariana", empresa: { id: "e 1", nome: "Grupo Ventura", documento: "76.086.428-5", segmentoMercado: "Indústria", porte: "Médio", site: "https://ventura.test" } } });
  for (const s of ["Grupo Ventura", "Documento da empresa", "Analista", "76.086.428-5", "Indústria", "Médio", "https://ventura.test", "Decisor?", ">Não</div>"]) expect(h).toContain(s);
  expect(h).not.toContain(">CNPJ<"); expect(h).not.toContain("Perfil"); expect(h).not.toContain("https://linkedin.test/mariana");
});
it("dados são escapados e links de conversa vêm somente do contrato autorizado", () => {
  expect(html({ pessoa: { ...dados.pessoa!, email: '<img src=x onerror="x">' } })).not.toContain("<img");
});

it("com destino interno o cartão abre Oportunidades sem link global Funil",()=>{const abrir=vi.fn();const props={dados,capacidades,aoAbrirOportunidades:abrir};const arvore=AbaDetalhes(props);const card=elementos(arvore).find(n=>n.props['aria-label']==='Abrir oportunidade atual');expect(card).toBeDefined();(card!.props.onClick as()=>void)();expect(abrir).toHaveBeenCalledOnce();expect(renderToStaticMarkup(createElement(AbaDetalhes,props))).not.toContain('href="/funil?');});

it("Doc/DOB/idade autorizados são apresentação civil e idade zero aparece",()=>{const h=html({cadastroPessoa:{documento:"DOC FICTICIO",tipoDocumentoId:null,documentoPaisEmissor:"CR",nascimento:"2026-10-26"},informacoesCadastro:{idade:0,documento:{tipoNome:null,paisNome:null,paisCodigoISO:null,validado:false},catalogo:null}});expect(h).toContain("DOC FICTICIO");expect(h).toContain("26/10/2026");expect(h).toContain("0 anos");expect(h).not.toContain("2026-10-26T");});
it("blocos negados não renderizam rótulos de cadastro ou bits de existência",()=>{const h=html({cadastroPessoa:null,informacoesCadastro:null});expect(h).not.toMatch(/Nascimento|Idade|Documento pessoal|Não validado/);});
