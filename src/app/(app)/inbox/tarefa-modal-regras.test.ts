import {expect,it} from "vitest";
import {validarTarefaModal,mensagemNaDataAgendavel,validarMensagemNaData,avisoMensagemForaDaJanela} from "./tarefa-modal-regras";
const base={titulo:"Retornar",descricao:"",dataCivil:null,hora:null,lembreteAntecedenciaMin:null,fusoEscola:"America/Sao_Paulo"};
it("título obrigatório e limite coerente200",()=>{expect(validarTarefaModal({...base,titulo:" "})).toBe("Dê um título para a tarefa.");expect(validarTarefaModal({...base,titulo:"x".repeat(200)})).toBeNull();expect(validarTarefaModal({...base,titulo:"x".repeat(201)})).toContain("200");});
it("descrição e pares de agenda são validados sem data local implícita",()=>{expect(validarTarefaModal({...base,descricao:"x".repeat(2001)})).toContain("2000");expect(validarTarefaModal({...base,hora:"09:00"})).toContain("data");expect(validarTarefaModal({...base,lembreteAntecedenciaMin:30})).toContain("lembrete");expect(validarTarefaModal({...base,dataCivil:"2026-10-25"})).toBeNull();});
it("horário inexistente e ambíguo recusados no fuso declarado",()=>{expect(validarTarefaModal({...base,dataCivil:"2026-03-08",hora:"02:30",fusoEscola:"America/New_York"})).not.toBeNull();expect(validarTarefaModal({...base,dataCivil:"2026-11-01",hora:"01:30",fusoEscola:"America/New_York"})).not.toBeNull();});
it("mensagem na data só agenda com data e horário futuros no fuso da escola",()=>{const agora=new Date("2026-10-27T12:00:00.000Z");const f={fusoEscola:"America/Sao_Paulo"};expect(mensagemNaDataAgendavel({...f,dataCivil:null,hora:null},agora)).toBe(false);expect(mensagemNaDataAgendavel({...f,dataCivil:"2026-10-28",hora:null},agora)).toBe(false);expect(mensagemNaDataAgendavel({...f,dataCivil:"2026-10-27",hora:"08:59"},agora)).toBe(false);expect(mensagemNaDataAgendavel({...f,dataCivil:"2026-10-27",hora:"09:01"},agora)).toBe(true);});
it("texto da mensagem na data é obrigatório e limitado a4096",()=>{expect(validarMensagemNaData("  ")).toContain("Escreva");expect(validarMensagemNaData("x".repeat(4096))).toBeNull();expect(validarMensagemNaData("x".repeat(4097))).toContain("4096");});
it("avisa horário ou dia fora da janela e explica como criar só a tarefa",()=>{
 const agora=new Date("2026-10-27T12:00:00.000Z"),janela={inicio:9,fim:20,diasSemana:[1,2,3,4,5]},fusoEscola="America/Sao_Paulo";
 expect(avisoMensagemForaDaJanela({dataCivil:"2026-10-29",hora:"10:00",fusoEscola},janela,agora)).toBeNull();
 expect(avisoMensagemForaDaJanela({dataCivil:"2026-10-27",hora:"08:00",fusoEscola},janela,agora)).toBeNull();
 for(const hora of ["22:00","10:00"] as const){
  const fora=avisoMensagemForaDaJanela({dataCivil:hora==="22:00"?"2026-10-29":"2026-11-01",hora,fusoEscola},janela,agora);
  expect(fora).toContain("Fora da janela de envio");
  expect(fora).toContain("Enviar mensagem nesta data");
 }
});
