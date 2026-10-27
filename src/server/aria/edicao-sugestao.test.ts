import {ZodError} from "zod";
import { describe, expect, it } from "vitest";
import { compilarEdicaoSugestao } from "./edicao-sugestao";

describe("D2 compilação de edição fornecida", () => {
 it("texto trim-equivalente é edição humana e conserva metadados do produtor", () => {
  const r=compilarEdicaoSugestao("RESPONDER",{texto:"Olá",documentoId:"doc",leadId:"lead"},{texto:"  Olá  "});
  expect(r).toEqual({payload:{texto:"Olá",documentoId:"doc",leadId:"lead"},saidaHumana:true,camposEditados:["texto"]});
 });
 it("somente horário de saída agendada é humano", () => {
  const r=compilarEdicaoSugestao("AGENDAR_MENSAGEM",{texto:"Oi",agendadaPara:"2026-11-01T12:00:00.000Z"},{agendadaPara:"2026-11-02T12:00:00.000Z"});
  expect(r.saidaHumana).toBe(true);expect(r.payload.texto).toBe("Oi");expect(r.camposEditados).toEqual(["agendadaPara"]);
 });
 it("nota editada não cria saída externa",()=>{const r=compilarEdicaoSugestao("NOTA_INTERNA",{texto:"antes"},{texto:"depois"});expect(r.saidaHumana).toBe(false);expect(r.payload.texto).toBe("depois");});
 it("edição de tarefa conserva payload do produtor sem tornar saída humana",()=>{const r=compilarEdicaoSugestao("CRIAR_TAREFA",{titulo:"antes",venceEmISO:"2026-11-01T12:00:00.000Z"},{titulo:"depois"});expect(r.saidaHumana).toBe(false);expect(r.payload.titulo).toBe("depois");});
 it("aceita texto humano até4096 sem cap IA1000",()=>expect(compilarEdicaoSugestao("RESPONDER",{texto:"antes"},{texto:"x".repeat(4096)}).payload.texto).toHaveLength(4096));
 it("documento usa limite canônico de legenda e permite legenda vazia",()=>{expect(compilarEdicaoSugestao("RESPONDER",{texto:"antes",documentoId:"doc"},{texto:" "}).payload.texto).toBe("");expect(()=>compilarEdicaoSugestao("RESPONDER",{texto:"antes",documentoId:"doc"},{texto:"x".repeat(1025)})).toThrow(ZodError);});
 it.each([["RESPONDER",{texto:"x".repeat(4097)}],["NOTA_INTERNA",{texto:"x".repeat(2001)}],["CRIAR_TAREFA",{titulo:"x".repeat(201)}]])("recusa excesso por efeito %s",(tipo,edit)=>expect(()=>compilarEdicaoSugestao(tipo,{texto:"original",titulo:"original"},edit)).toThrow(ZodError));
 it.each([{autorId:"intruso"},{documentoId:"outro"},{atendimentoId:"outro"},{texto:undefined},{}, {agendadaPara:"inválida"}])("recusa patch vazio, campo não autorizado ou inválido %j",edit=>expect(()=>compilarEdicaoSugestao("AGENDAR_MENSAGEM",{texto:"original"},edit)).toThrow(ZodError));
 it("tipo não editável recusa mesmo texto válido",()=>expect(()=>compilarEdicaoSugestao("MOVER_ETAPA",{}, {texto:"alterado"})).toThrow(ZodError));
});
it("ENVIAR_DOCUMENTO edita legenda sem permitir troca documental e humaniza a saída",()=>{const r=compilarEdicaoSugestao("ENVIAR_DOCUMENTO",{texto:"antes",documentoId:"doc"},{texto:"depois"});expect(r.payload).toEqual({texto:"depois",documentoId:"doc"});expect(r.saidaHumana).toBe(true);});
it("horário-only não preserva texto legado além do limite humano",()=>expect(()=>compilarEdicaoSugestao("AGENDAR_MENSAGEM",{texto:"x".repeat(4097)},{agendadaPara:"2026-11-02T12:00:00.000Z"})).toThrow(ZodError));
it("título-only não preserva data inválida do produtor",()=>expect(()=>compilarEdicaoSugestao("CRIAR_TAREFA",{titulo:"antes",venceEmISO:"inválida"},{titulo:"depois"})).toThrow(ZodError));
it("tarefa em RESPONDER é campo indevido, não uma alteração de tipo",()=>expect(()=>compilarEdicaoSugestao("RESPONDER",{texto:"antes"},{titulo:"Campo indevido"})).toThrow(ZodError));
it("original fornecido pelo cliente é recusado em vez de substituir auditoria",()=>expect(()=>compilarEdicaoSugestao("RESPONDER",{texto:"antes"},{texto:"depois",original:{texto:"forjado"}})).toThrow(ZodError));