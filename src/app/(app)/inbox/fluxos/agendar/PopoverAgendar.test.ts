import {act,createElement} from "react";
import type {Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {criarDomMinimo,desligarObservadores,type Documento,type Elemento} from "@/test/dom-minimo";
import {PopoverAgendar,type PropsPopoverAgendar} from "./PopoverAgendar";
import {criarIntencoesAgendamento} from "./intencao-agendamento";
const m=vi.hoisted(()=>({insights:vi.fn()}));
vi.mock("../../insights/useSugestaoAgendamento",()=>({useSugestaoAgendamento:m.insights}));
let root:Root,doc:Documento,gatilho:Elemento,dono:ReturnType<typeof criarIntencoesAgendamento>;
const executar=vi.fn(),fechar=vi.fn(),concluir=vi.fn(),salvar=vi.fn();
const agora=new Date("2026-10-22T13:30Z");
function eventos(el:Elemento){const k=Object.keys(el).find(k=>k.startsWith("__reactProps"))!;return (el as unknown as Record<string,{value?:string;disabled?:boolean;readOnly?:boolean;onChange(e:unknown):void;onSubmit(e:unknown):void;onClick():void;onCheckedChange?(v:boolean):void}>)[k];}
function disparar(el:Elemento,nome:string,arg?:unknown){const direto=eventos(el) as unknown as Record<string,unknown>;if(typeof direto[nome]==="function"){(direto[nome] as (a?:unknown)=>void)(arg);return;}const fk=Object.keys(el).find(k=>k.startsWith("__reactFiber"));let f=fk?(el as unknown as Record<string,{return?:unknown;memoizedProps?:Record<string,unknown>}>)[fk]:undefined;while(f){const fn=f.memoizedProps?.[nome];if(typeof fn==="function"){(fn as (a?:unknown)=>void)(arg);return;}f=f.return as typeof f;}throw new Error("sem "+nome);}
function campo(nome:string){const c=doc.body.querySelector(`[name="${nome}"]`);expect(c,`campo ${nome}`).not.toBeNull();return c!;}
function botao(texto:string){const b=doc.body.querySelectorAll("button").find(e=>e.textContent===texto);expect(b,`botão ${texto}`).toBeDefined();return b!;}
async function mudar(nome:string,value:string){await act(async()=>eventos(campo(nome)).onChange({target:{value}}));}
async function clicar(texto:string){await act(async()=>eventos(botao(texto)).onClick());}
async function submeter(){const form=doc.body.querySelector("form");expect(form).not.toBeNull();await act(async()=>eventos(form!).onSubmit({preventDefault(){}}));}
function props(p:Partial<PropsPopoverAgendar>={}):PropsPopoverAgendar{return {atendimentoId:"a",fuso:"America/Sao_Paulo",nomeContato:"Ana",textoInicial:"RascunhoA",ancora:{current:gatilho as unknown as HTMLElement},agendadas:[],respostas:[],variaveisResposta:{nome:"Ana"},intencao:dono.para({tipo:"CRIAR",atendimentoId:"a"}),executar,podeAgendar:true,podeRecuperar:true,relogio:()=>agora,aoSalvarRascunho:salvar,aoFechar:fechar,aoConcluir:concluir,...p};}
async function montar(p:Partial<PropsPopoverAgendar>={}){await act(async()=>root.render(createElement(PopoverAgendar,props(p))));}
beforeEach(async()=>{vi.resetAllMocks();dono=criarIntencoesAgendamento(()=>"chave-ui363");executar.mockResolvedValue({ok:true,dado:{id:"ack"}});salvar.mockReturnValue({ok:true});m.insights.mockReturnValue({disponivel:false,ocupado:false,carregando:false,aviso:null,erro:null,sucesso:null,pedirUso:vi.fn(),confirmacao:null});const dom=criarDomMinimo();doc=dom.documento;Object.assign(doc,{addEventListener(){},removeEventListener(){},createElementNS(_ns:string,tag:string){return doc.createElement(tag);}});Object.assign(dom.janela,{innerWidth:1280,innerHeight:800,addEventListener(){},removeEventListener(){}});const original=doc.createElement.bind(doc);doc.createElement=((tag:string)=>{const e=original(tag);Object.assign(e,{getBoundingClientRect:()=>({top:40,bottom:76,left:300,right:336,width:340,height:500})});return e;}) as typeof doc.createElement;vi.stubGlobal("document",doc);vi.stubGlobal("window",dom.janela);vi.stubGlobal("MutationObserver",dom.MutationObserver);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);gatilho=doc.createElement("button");doc.body.appendChild(gatilho);const host=doc.createElement("div");doc.body.appendChild(host);const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("abre diálogo com draft e Amanhã09 no fuso declarado",async()=>{await montar();expect(doc.body.querySelector('[role="dialog"]')).not.toBeNull();expect(eventos(campo("texto")).value).toBe("RascunhoA");expect(eventos(campo("quandoLocal")).value).toBe("2026-10-23T09:00");expect(campo("quandoLocal").getAttribute("data-fuso")).toBe("America/Sao_Paulo");});
it("atalho e resposta rápida aplicam horário e variáveis canônicas",async()=>{await montar({respostas:[{id:"r",atalho:"/oi",titulo:"Saudação",corpo:"Oi {nome}"}]});await clicar("Em 1 hora");expect(eventos(campo("quandoLocal")).value).toBe("2026-10-22T11:30");await clicar("Saudação");expect(eventos(campo("texto")).value).toBe("Oi Ana");});
it("passado desabilita e mesmo submit instrumental não chama action",async()=>{await montar();await mudar("quandoLocal","2026-10-22T10:30");expect(doc.body.textContent).toContain("Esse horário já passou. Escolha uma data e hora no futuro.");expect(eventos(botao("Agendar")).disabled).toBe(true);await submeter();expect(executar).not.toHaveBeenCalled();});
it("conflito próximo avisa sem bloquear e confirma input/fuso/chave sem autoridade cliente",async()=>{await montar({agendadas:[{id:"i",texto:"Outra",agendadaPara:"2026-10-23T13:00Z",status:"PENDENTE",tipo:"TEXTO",temAnexo:false,autor:"voce",autorNome:null,podeAlterar:true,perguntaPendente:false}]});expect(doc.body.textContent).toContain("Já existe uma mensagem agendada para Ana");await submeter();expect(executar).toHaveBeenCalledExactlyOnceWith({tipo:"CRIAR",atendimentoId:"a",texto:"RascunhoA",quandoLocal:"2026-10-23T09:00",fuso:"America/Sao_Paulo",perguntarSeResponder:true,chaveIdempotencia:"chave-ui363"});expect(concluir).toHaveBeenCalledWith("Mensagem agendada.");expect(salvar).not.toHaveBeenCalled();});
it("erro de silêncio do servidor mantém popover e texto",async()=>{executar.mockResolvedValue({ok:false,erro:"Fora do horário de envio da escola."});await montar();await submeter();expect(doc.body.textContent).toContain("Fora do horário de envio da escola.");expect(eventos(campo("texto")).value).toBe("RascunhoA");expect(concluir).not.toHaveBeenCalled();expect(fechar).not.toHaveBeenCalled();});
it("Salvar rascunho é explícito e local, fecha sem chamar action",async()=>{await montar();await mudar("texto","Salvar novo");await clicar("Salvar rascunho");expect(salvar).toHaveBeenCalledWith("Salvar novo");expect(fechar).toHaveBeenCalledOnce();expect(executar).not.toHaveBeenCalled();});
const existente=(p:Partial<{podeAlterar:boolean}>={})=>({id:"i",texto:"Texto existente",agendadaPara:"2026-10-23T12:00Z",status:"PENDENTE" as const,tipo:"TEXTO" as const,temAnexo:false,autor:"voce" as const,autorNome:null,podeAlterar:true,perguntaPendente:false,...p});
it("PopoverAgendar editar: texto editável e Salvar chama editarAgendamentoDoAtendimento com texto e horário, sem Salvar rascunho",async()=>{await montar({editar:existente(),intencao:dono.para({tipo:"EDITAR",atendimentoId:"a",intencaoId:"i"})});expect(eventos(campo("texto")).value).toBe("Texto existente");expect(eventos(campo("texto")).readOnly).toBe(false);expect(doc.body.textContent).not.toContain("Para mudar o texto");expect(doc.body.textContent).not.toContain("Salvar rascunho");await mudar("texto","Texto corrigido");await clicar("Em 1 hora");await submeter();expect(executar).toHaveBeenCalledExactlyOnceWith({tipo:"EDITAR",atendimentoId:"a",intencaoId:"i",texto:"Texto corrigido",quandoLocal:"2026-10-22T11:30",fuso:"America/Sao_Paulo",chaveIdempotencia:"chave-ui363"});expect(concluir).toHaveBeenCalledWith("Agendamento atualizado.");});
it("editar sem alçada mantém texto somente leitura e não envia",async()=>{await montar({editar:existente({podeAlterar:false}),intencao:dono.para({tipo:"EDITAR",atendimentoId:"a",intencaoId:"i"})});expect(eventos(campo("texto")).readOnly).toBe(true);await mudar("texto","Tentativa");expect(eventos(campo("texto")).value).toBe("Texto existente");expect(eventos(botao("Salvar")).disabled).toBe(true);await submeter();expect(executar).not.toHaveBeenCalled();});
it("editar sem ter assumido bloqueia Salvar mesmo forçando submit",async()=>{await montar({editar:existente(),intencao:dono.para({tipo:"EDITAR",atendimentoId:"a",intencaoId:"i"}),podeAgendar:false});expect(doc.body.textContent).toContain("Assuma a conversa para alterar a mensagem agendada.");expect(doc.body.textContent).not.toContain("para agendar a mensagem");expect(eventos(botao("Salvar")).disabled).toBe(true);await submeter();expect(executar).not.toHaveBeenCalled();});
it("editar com texto apagado não envia",async()=>{await montar({editar:existente(),intencao:dono.para({tipo:"EDITAR",atendimentoId:"a",intencaoId:"i"})});await mudar("texto","   ");expect(eventos(botao("Salvar")).disabled).toBe(true);await submeter();expect(executar).not.toHaveBeenCalled();});
it("D11 sem Assumir bloqueia nova criação mesmo forçando submit",async()=>{await montar({podeAgendar:false,motivoBloqueio:"Assuma a conversa para agendar a mensagem."});expect(doc.body.textContent).toContain("Assuma a conversa");expect(eventos(botao("Agendar")).disabled).toBe(true);await submeter();expect(executar).not.toHaveBeenCalled();});
it("incerto sobrevive remount e recupera comando original mesmo após perder responsável",async()=>{executar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ok:true,dado:{id:"ack"}});await montar();await submeter();const original=executar.mock.calls[0][0];await act(async()=>root.render(null));await montar({textoInicial:"Outro draft",fuso:"UTC",podeAgendar:false});expect(eventos(campo("texto")).value).toBe("RascunhoA");expect(campo("quandoLocal").getAttribute("data-fuso")).toBe("America/Sao_Paulo");await submeter();expect(executar.mock.calls[1][0]).toBe(original);expect(concluir).toHaveBeenCalledOnce();});
it("ACK tardio após desmontar não fecha outro formulário",async()=>{let liberar!:(r:{ok:true;dado:{id:string}})=>void;executar.mockReturnValue(new Promise(r=>liberar=r));await montar();let envio:Promise<void>;const form=doc.body.querySelector("form");expect(form).not.toBeNull();await act(async()=>{envio=Promise.resolve(eventos(form!).onSubmit({preventDefault(){}}));});await act(async()=>root.render(null));await act(async()=>{liberar({ok:true,dado:{id:"ack"}});await envio;});expect(concluir).not.toHaveBeenCalled();expect(salvar).not.toHaveBeenCalled();});
it("Insights público permanece opt-in e não preenche texto automaticamente",async()=>{await montar({insightsAplicaveis:true,versaoInsights:2});expect(m.insights).toHaveBeenCalledWith(expect.objectContaining({ativo:true,atendimentoId:"a",versao:2}));expect(eventos(campo("texto")).value).toBe("RascunhoA");expect(executar).not.toHaveBeenCalled();});
async function escolherVinculo(valor:string){const alvo=valor||"__nenhum__";const r=doc.body.querySelectorAll('[role="radio"]').find(e=>e.getAttribute("value")===alvo);expect(r,`vínculo ${valor}`).toBeDefined();await act(async()=>disparar(r!,"onValueChange",alvo));}
const opcoes={oportunidadeId:"op1",propostas:[{id:"d1",nome:"Proposta anual.pdf"}],tarefas:[{id:"t1",titulo:"Ligar para Ana"}]};
it("PopoverAgendar: 'Anexar' mostra Proposta e Arquivo; 'Mais opções' mostra 'Vincular a' sem 'Repetir'",async()=>{
 await montar({opcoes,subirArquivo:vi.fn()});expect(doc.body.textContent).toContain("Anexar");botao("Proposta");botao("Arquivo");
 expect(doc.body.textContent).not.toContain("Vincular a");await clicar("Mais opções");expect(doc.body.textContent).toContain("Vincular a");
 const opcoesVinculo=doc.body.querySelectorAll('[role="radio"]').map(o=>o.parentNode?.textContent);expect(opcoesVinculo).toEqual(["Nenhum","Oportunidade","Tarefa · Ligar para Ana"]);
 expect(doc.body.textContent).not.toContain("Repetir");
});
it("editar não mostra Anexar nem Mais opções",async()=>{await montar({opcoes,editar:existente(),intencao:dono.para({tipo:"EDITAR",atendimentoId:"a",intencaoId:"i"})});expect(doc.body.textContent).not.toContain("Anexar");expect(doc.body.textContent).not.toContain("Mais opções");});
it("proposta escolhida vai na action e dispensa o texto",async()=>{
 await montar({opcoes,textoInicial:""});expect(eventos(botao("Agendar")).disabled).toBe(true);
 await clicar("Proposta");await clicar("Proposta anual.pdf");expect(doc.body.textContent).toContain("Proposta anual.pdf");expect(eventos(botao("Agendar")).disabled).toBe(false);
 await submeter();expect(executar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({tipo:"CRIAR",texto:"",anexo:{tipo:"proposta",documentoId:"d1",nome:"Proposta anual.pdf"}}));
});
it("editar agendada com anexo: mostra o anexo, aceita legenda vazia e salva só legenda e horário",async()=>{
 await montar({opcoes,editar:{...existente(),texto:"Segue a proposta",tipo:"DOCUMENTO",temAnexo:true,anexoNome:"Proposta anual.pdf"},intencao:dono.para({tipo:"EDITAR",atendimentoId:"a",intencaoId:"i"})});
 expect(doc.body.textContent).toContain("Proposta anual.pdf");expect(doc.body.textContent).toContain("Legenda");expect(doc.body.textContent).not.toContain("Anexar");
 await mudar("texto","");expect(eventos(botao("Salvar")).disabled).toBe(false);await clicar("Em 1 hora");await submeter();
 expect(executar).toHaveBeenCalledExactlyOnceWith({tipo:"EDITAR",atendimentoId:"a",intencaoId:"i",texto:"",quandoLocal:"2026-10-22T11:30",fuso:"America/Sao_Paulo",chaveIdempotencia:"chave-ui363"});
});
it("falha ao carregar propostas avisa o erro em vez de dizer que não há oportunidade",async()=>{
 await montar({opcoes:{oportunidadeId:null,propostas:[],tarefas:[],erroPropostas:true}});await clicar("Proposta");
 expect(doc.body.textContent).toContain("Não foi possível carregar as propostas.");expect(doc.body.textContent).not.toContain("Esta conversa não tem oportunidade");
});
it("Mais opções fica desabilitado enquanto o envio está em andamento",async()=>{
 let fim!:(r:{ok:true;dado:{id:string}})=>void;executar.mockImplementation(()=>new Promise(r=>{fim=r;}));
 await montar({opcoes});await act(async()=>{void eventos(doc.body.querySelector("form")!).onSubmit({preventDefault(){}});});
 expect(eventos(botao("Mais opções")).disabled).toBe(true);await act(async()=>fim({ok:true,dado:{id:"ack"}}));
});
it("sem oportunidade, Proposta avisa e não oferece Oportunidade no vínculo",async()=>{
 await montar({opcoes:{oportunidadeId:null,propostas:[],tarefas:[]}});await clicar("Proposta");expect(doc.body.textContent).toContain("Esta conversa não tem oportunidade com propostas.");
 await clicar("Mais opções");expect(doc.body.querySelectorAll('[role="radio"]').map(o=>o.parentNode?.textContent)).toEqual(["Nenhum"]);
});
it("arquivo sobe pelo uploader e vai na action",async()=>{
 const subirArquivo=vi.fn().mockResolvedValue({ok:true,dado:{url:"/api/files/whatsapp-out/u/1.pdf",nome:"Foto da turma.pdf"}});await montar({opcoes,subirArquivo});
 const arquivo={name:"Foto da turma.pdf",size:10};await act(async()=>eventos(campo("arquivoAnexo")).onChange({target:{files:[arquivo],value:"x"}}));
 expect(subirArquivo).toHaveBeenCalledExactlyOnceWith(arquivo);expect(doc.body.textContent).toContain("Foto da turma.pdf");
 await submeter();expect(executar).toHaveBeenLastCalledWith(expect.objectContaining({anexo:{tipo:"arquivo",url:"/api/files/whatsapp-out/u/1.pdf",nome:"Foto da turma.pdf"}}));
 expect(doc.body.querySelector('[aria-label="Remover anexo"]')).not.toBeNull();
});
it("falha do upload fica no popover sem anexo",async()=>{
 const subirArquivo=vi.fn().mockResolvedValue({ok:false,erro:"Tipo não suportado."});await montar({opcoes,subirArquivo});
 await act(async()=>eventos(campo("arquivoAnexo")).onChange({target:{files:[{name:"x.exe",size:1}],value:"x"}}));
 expect(doc.body.textContent).toContain("Tipo não suportado.");expect(doc.body.querySelector('[aria-label="Remover anexo"]')).toBeNull();
 await submeter();expect(executar).toHaveBeenCalledExactlyOnceWith(expect.not.objectContaining({anexo:expect.anything()}));
});
it("Remover anexo volta a exigir texto",async()=>{
 await montar({opcoes,textoInicial:""});await clicar("Proposta");await clicar("Proposta anual.pdf");
 const remover=doc.body.querySelector('[aria-label="Remover anexo"]');expect(remover).not.toBeNull();await act(async()=>eventos(remover!).onClick());
 expect(eventos(botao("Agendar")).disabled).toBe(true);await submeter();expect(executar).not.toHaveBeenCalled();
});
it("Vincular a tarefa aberta ou à oportunidade vai na action",async()=>{
 await montar({opcoes});await clicar("Mais opções");await escolherVinculo("tarefa:t1");await submeter();
 expect(executar).toHaveBeenLastCalledWith(expect.objectContaining({vinculo:{tipo:"tarefa",tarefaId:"t1",titulo:"Ligar para Ana"}}));
});
it("Vincular à oportunidade usa a oportunidade da conversa",async()=>{
 await montar({opcoes});await clicar("Mais opções");await escolherVinculo("oportunidade");await submeter();
 expect(executar).toHaveBeenLastCalledWith(expect.objectContaining({vinculo:{tipo:"oportunidade",leadId:"op1"}}));
});
it("PopoverAgendar: 'Perguntar antes de enviar se o contato responder' ligado por padrão e enviado na action",async()=>{await montar();expect(doc.body.textContent).toContain("Perguntar antes de enviar se o contato responder");expect(doc.body.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");await submeter();expect(executar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({tipo:"CRIAR",perguntarSeResponder:true}));});
it("desligar a pergunta envia perguntarSeResponder falso",async()=>{await montar();const caixa=doc.body.querySelector('[role="checkbox"]')!;await act(async()=>disparar(caixa,"onCheckedChange",false));expect(caixa.getAttribute("aria-checked")).toBe("false");await submeter();expect(executar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({tipo:"CRIAR",perguntarSeResponder:false}));});
it("editar não mostra a opção de perguntar",async()=>{await montar({editar:existente(),intencao:dono.para({tipo:"EDITAR",atendimentoId:"a",intencaoId:"i"})});expect(doc.body.textContent).not.toContain("Perguntar antes de enviar");expect(doc.body.querySelector('[name="perguntarSeResponder"]')).toBeNull();});
it("recupera EDITAR incerto sem depender de row ainda pendente na lista, nem horário futuro",async()=>{
 const i=dono.para({tipo:"EDITAR",atendimentoId:"a",intencaoId:"i"});const e={tipo:"EDITAR" as const,atendimentoId:"a",intencaoId:"i",texto:"Texto em confirmação",quandoLocal:"2026-10-23T09:00",fuso:"America/Sao_Paulo"};executar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ok:true,dado:{id:"i"}});await i.enviar(e,executar);const original=executar.mock.calls[0][0];
 await montar({intencao:i,podeAgendar:false,relogio:()=>new Date("2037-01-01Z"),agendadas:[]});expect(doc.body.textContent).toContain("Editar agendamento");expect(eventos(campo("texto")).readOnly).toBe(true);expect(eventos(campo("texto")).value).toBe("Texto em confirmação");await submeter();expect(executar.mock.calls[1][0]).toBe(original);expect(concluir).toHaveBeenCalledOnce();
});it("relógio real avança com o popover aberto: Hoje 18:00 some e horário vencido bloqueia",async()=>{
 let t=new Date("2026-10-22T20:00Z");const relogio=()=>t;await montar({relogio});await mudar("quandoLocal","2026-10-22T18:30");expect(eventos(botao("Agendar")).disabled).toBe(false);
 t=new Date("2026-10-22T22:30Z");await submeter();expect(executar).not.toHaveBeenCalled();expect(doc.body.textContent).toContain("Esse horário já passou. Escolha uma data e hora no futuro.");expect(eventos(botao("Agendar")).disabled).toBe(true);
 expect(doc.body.querySelectorAll("button").some(b=>b.textContent==="Hoje 18:00")).toBe(false);
 await clicar("Em 1 hora");expect(eventos(campo("quandoLocal")).value).toBe("2026-10-22T20:30");expect(eventos(botao("Agendar")).disabled).toBe(false);
});
it("sem porta de rascunho não oferece Salvar rascunho",async()=>{await montar({textoInicial:"",podeSalvarRascunho:false});expect(doc.body.textContent).not.toContain("Salvar rascunho");expect(eventos(campo("texto")).value).toBe("");});
it("conflito mostra quando relativo e texto de limite com espaço",async()=>{await montar({agendadas:[{id:"i",texto:"Outra",agendadaPara:"2026-10-23T13:00Z",status:"PENDENTE",tipo:"TEXTO",temAnexo:false,autor:"voce",autorNome:null,podeAlterar:true,perguntaPendente:false}]});expect(doc.body.textContent).toContain("Já existe uma mensagem agendada para Ana Amanhã às 10:00, perto desse horário.");expect(doc.body.textContent).not.toContain("carregada");await mudar("texto","");await submeter();expect(doc.body.textContent).not.toContain("até4000");});
