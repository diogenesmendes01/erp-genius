import { expect, it } from "vitest";
import type { DetalhesPainel } from "@/server/inbox/painel-detalhes";
import { diffContato, formDoContato } from "./form-contato";
const dados: DetalhesPainel = { cadastroPessoa:null, informacoesCadastro:null, pessoa: { id: "p326", nome: "Pessoa326", email: "antes@example.test", cidade: "Origem", cargo: null, linkedin: null, origemCanal: "WHATSAPP", telefone: "+5500000000326", empresa: { id: "e326", nome: "Empresa326", documento: "RUC-FICTICIO", segmentoMercado: null, porte: null, site: null } }, oportunidade: null, b2b: null, campos: [{ id: "texto", nome: "Objetivo", tipo: "TEXTO", opcoes: [], obrigatorio: false, valor: "A1", ia: true }, { id: "numero", nome: "Horas", tipo: "NUMERO", opcoes: [], obrigatorio: false, valor: 0, ia: false }, { id: "bool", nome: "Disponível", tipo: "BOOLEANO", opcoes: [], obrigatorio: false, valor: false, ia: false }] };
const base = () => { const f = formDoContato(dados); if (!f) throw Error("Fixture sem Pessoa"); return f; };
it("formulário usa somente campos editáveis, sem empresa/telefone nem trocar identidade principal", () => {
  expect(base()).toEqual({ nome: "Pessoa326", email: "antes@example.test", cidade: "Origem", cargo: "", linkedin: "", origemCanal: "WHATSAPP", campos: { texto: "A1", numero: 0, bool: false } });
  expect(formDoContato({ ...dados, pessoa: null })).toBeNull();
});
it("diff envia somente mudança e branco opcional vira null", () => {
  const f = base(); expect(diffContato(f, { ...f, cidade: "Campinas", email: " ", campos: { ...f.campos, texto: "B2" } })).toEqual({ pessoa: { cidade: "Campinas", email: null }, campos: [{ campoId: "texto", valor: "B2" }] });
  expect(diffContato(f, f)).toEqual({});
});
it("normalização segue o domínio básico sem gerar mudança só de espaços/caixa de email", () => {
  const f = base(); expect(diffContato(f, { ...f, nome: " Pessoa326 ", email: " ANTES@EXAMPLE.TEST ", cidade: " Origem ", cargo: " " })).toEqual({});
});
it("zero e false são valores, não limpeza; remoção explícita e origem vazia viram null", () => {
  const f = base(); expect(diffContato(f, { ...f, origemCanal: "", campos: { texto: null, numero: 0, bool: false } })).toEqual({ pessoa: { origemCanal: null }, campos: [{ campoId: "texto", valor: null }] });
  expect(diffContato(f, { ...f, campos: { texto: "A1", numero: 5, bool: true } })).toEqual({ campos: [{ campoId: "numero", valor: 5 }, { campoId: "bool", valor: true }] });
});
it("não envia IDs de campo que não vieram na leitura nem propriedades de outra entidade", () => {
  const f = base(); expect(diffContato(f, { ...f, campos: { ...f.campos, alheio: "X" }, empresaId: "outra", telefone: "novo" } as never)).toEqual({});
});
it("nome vazio continua erro de domínio, nunca é convertido em null nem omitido", () => {
  const f = base(); expect(diffContato(f, { ...f, nome: " " })).toEqual({ pessoa: { nome: "" } });
});
it("cadastro autorizado usa campos civis opcionais separados sem idade no payload",()=>{const d={...dados,cadastroPessoa:{documento:"DOC FICTICIO",tipoDocumentoId:"tipo",documentoPaisEmissor:"CR",nascimento:"2000-02-29"},informacoesCadastro:{idade:26,documento:null,catalogo:[]}};const f=formDoContato(d)!;expect(f).toMatchObject({cadastro:{documento:"DOC FICTICIO",tipoDocumentoId:"tipo",documentoPaisEmissor:"CR",nascimento:"2000-02-29"}});expect(diffContato(f,f)).toEqual({});});
it("clear cadastral é explícito e mantém omissão dos demais campos",()=>{const d={...dados,cadastroPessoa:{documento:"DOC FICTICIO",tipoDocumentoId:"tipo",documentoPaisEmissor:"CR",nascimento:"2000-02-29"},informacoesCadastro:{idade:26,documento:null,catalogo:[]}},f=formDoContato(d)!;expect(diffContato(f,{...f,cadastro:{documento:"DOC FICTICIO",tipoDocumentoId:"tipo",documentoPaisEmissor:"CR",nascimento:""}})).toEqual({pessoa:{nascimento:null}});});
it("cadastro negado não é criado pelo formulário nem por input injetado",()=>{const f=base();expect(f).not.toHaveProperty("cadastro");expect(diffContato(f,{...f,cadastro:{documento:"INJETADO",tipoDocumentoId:"tipo",documentoPaisEmissor:"CR",nascimento:"2000-02-29"}})).toEqual({});});

it("editar somente nome com cadastro autorizado omite4campos não alterados",()=>{const d={...dados,cadastroPessoa:{documento:"DOC SNAPSHOT",tipoDocumentoId:"tipo",documentoPaisEmissor:"CR",nascimento:"2000-02-29"},informacoesCadastro:{idade:26,documento:null,catalogo:[]}},f=formDoContato(d)!;expect(diffContato(f,{...f,nome:"Nome novo"})).toEqual({pessoa:{nome:"Nome novo"}});});
