import { buildVirtualLayout, captureVirtualAnchor, restoreVirtualAnchor } from "./virtual-window";
import { describe, expect, it } from "vitest";
import type { MensagemThread, NotaInternaThread } from "@/server/whatsapp/consultas-inbox";
import { itensDaThread, autorDoItem, decorarThread, notaComoMensagem, rotuloDia } from "./itens-thread";

const mensagem = (id: string, criadoEm: string): MensagemThread => ({
  id, criadoEm, direcao: "ENTRADA", tipo: "TEXTO", corpo: id, midiaPath: null, status: "RECEBIDA", origem: null,
  autorNome: null, templateNome: null, participanteNome: null, favorita: false, clientMessageId: null,
});
const nota = (id: string, criadoEm: string): NotaInternaThread => ({ id, criadoEm, nota: id, autorNome: "Ana", origem: "atendimento" });

describe("itensDaThread", () => {
  it("nota posterior à janela só aparece quando não há mensagens mais novas fora dela", () => {
    const mensagens = [mensagem("m1", "2026-10-01T10:00:00.000Z")];
    const notas = [nota("n1", "2026-10-01T11:00:00.000Z")];
    expect(itensDaThread(mensagens, notas, false, true).map((i) => i.id)).toEqual(["m1"]);
    expect(itensDaThread(mensagens, notas, false, false).map((i) => i.id)).toEqual(["m1", "nota:n1"]);
  });

  it("filtra as duas bordas fora de ordem, incluindo notas exatamente nos limites", () => {
    const mensagens = [mensagem("m2", "2026-10-01T12:00:00.000Z"), mensagem("m1", "2026-10-01T10:00:00.000Z")];
    const notas = [nota("fora-antes", "2026-10-01T09:00:00.000Z"), nota("inicio", "2026-10-01T10:00:00.000Z"),
      nota("fim", "2026-10-01T12:00:00.000Z"), nota("fora-depois", "2026-10-01T13:00:00.000Z")];
    expect(itensDaThread(mensagens, notas, true, true).map((i) => i.id)).toEqual(["m1", "nota:inicio", "m2", "nota:fim"]);
  });
  it("intercala por horário e id; mensagem vem antes da nota no empate", () => {
    const t = "2026-10-01T12:00:00.000Z";
    const itens = itensDaThread(
      [mensagem("m2", t), mensagem("m1", "2026-10-01T10:00:00.000Z")],
      [nota("n2", t), nota("n1", "2026-10-01T11:00:00.000Z")], false, false,
    );
    expect(itens.map((i) => i.id)).toEqual(["m1", "nota:n1", "m2", "nota:n2"]);
    expect(itens.map((i) => i.tipo)).toEqual(["mensagem", "nota", "mensagem", "nota"]);
  });

  it("desempata notas por id e usa chave distinta quando id coincide com mensagem", () => {
    const t = "2026-10-01T12:00:00.000Z";
    expect(itensDaThread([mensagem("n1", t)], [nota("n2", t), nota("n1", t)], false, false).map((i) => i.id))
      .toEqual(["n1", "nota:n1", "nota:n2"]);
  });

  it("nota anterior à janela aparece só depois de carregar todas as mensagens anteriores", () => {
    const mensagens = [mensagem("m1", "2026-10-01T10:00:00.000Z")];
    const notas = [nota("n0", "2026-10-01T09:00:00.000Z")];
    expect(itensDaThread(mensagens, notas, true, false).map((i) => i.id)).toEqual(["m1"]);
    expect(itensDaThread(mensagens, notas, false, false).map((i) => i.id)).toEqual(["nota:n0", "m1"]);
  });

  it("usa a mensagem mais antiga da janela mesmo se a entrada chegar fora de ordem", () => {
    const mensagens = [mensagem("m2", "2026-10-01T12:00:00.000Z"), mensagem("m1", "2026-10-01T10:00:00.000Z")];
    const notas = [nota("n1", "2026-10-01T11:00:00.000Z")];
    expect(itensDaThread(mensagens, notas, true, false).map((i) => i.id)).toEqual(["m1", "nota:n1", "m2"]);
  });

  it("thread só com notas mantém todas elas", () => {
    expect(itensDaThread([], [nota("n2", "2026-10-01T12:00:00.000Z"), nota("n1", "2026-10-01T11:00:00.000Z")], true, false)
      .map((i) => i.id)).toEqual(["nota:n1", "nota:n2"]);
  });
});

const saida = (id: string, p: Partial<MensagemThread> = {}): MensagemThread => ({ ...mensagem(id, "2026-10-22T12:00:00.000Z"), direcao: "SAIDA", origem: "HUMANO", autorNome: "Camila", ...p });
const decoracao = (mensagens: MensagemThread[], notas: NotaInternaThread[] = []) => decorarThread(itensDaThread(mensagens, notas, false, false), { fuso: "UTC", agora: new Date("2026-10-22T13:00:00Z") });
const sequencias = (mensagens: MensagemThread[], notas: NotaInternaThread[] = []) => decoracao(mensagens, notas).filter(i=>i.tipo === "mensagem" || i.tipo === "nota").map(i=>i.emSequencia);
describe("decoração da thread", () => {
  it("clasifica entrada, humano, IA e nota sem mudar itens persistidos", () => {
    expect(autorDoItem({ tipo: "mensagem", id: "a", m: mensagem("a", "2026-10-22T12:00:00Z") })).toBe("cliente");
    expect(autorDoItem({ tipo: "mensagem", id: "b", m: saida("b") })).toBe("humano");
    expect(autorDoItem({ tipo: "mensagem", id: "c", m: saida("c", { origem: "IA" }) })).toBe("aria");
    expect(autorDoItem({ tipo: "nota", id: "nota:n", n: nota("n", "2026-10-22T12:00:00Z") })).toBe("nota");
  });
  it("Você→Camila→Carlos identificam cada autor; só repetição conhecida faz sequência", () => {
    expect(sequencias([saida("a", { propria: true }), saida("b"), saida("c", { autorNome: "Carlos" }), saida("d", { autorNome: "Carlos" })])).toEqual([false,false,false,true]);
  });
  it("autoria desconhecida e origem distinta não apagam identificação", () => {
    expect(sequencias([saida("a", { autorNome: null }), saida("b", { autorNome: null }), saida("c", { origem: "CELULAR" }), saida("d")])).toEqual([false,false,false,false]);
  });
  it("notas conservam origem e autor ao decidir sequência", () => {
    const t="2026-10-22T12:00:00Z";
    expect(sequencias([], [nota("a",t), {...nota("b",t),origem:"oportunidade"}, {...nota("c",t),origem:"oportunidade",autorNome:"Carlos"}, {...nota("d",t),origem:"oportunidade",autorNome:"Carlos"}])).toEqual([false,false,false,true]);
    expect(sequencias([], [{...nota("a",t),autorNome:null}, {...nota("b",t),autorNome:null}])).toEqual([false,false]);
  });
  it("grupo troca participante e dia quebra a sequência", () => {
    expect(sequencias([mensagem("a","2026-10-21T12:00:00Z"), mensagem("b","2026-10-22T12:00:00Z"), mensagem("c","2026-10-22T12:01:00Z")])).toEqual([false,false,true]);
    expect(sequencias([ {...mensagem("a","2026-10-22T12:00:00Z"),participanteNome:"Pai"}, {...mensagem("b","2026-10-22T12:01:00Z"),participanteNome:"Mãe"} ])).toEqual([false,false]);
  });
  it("evento no topo e separadores usam keys civis estáveis, sem colisão com nota", () => {
    const itens=itensDaThread([mensagem("a","2026-10-21T12:00:00Z"),mensagem("b","2026-10-22T12:00:00Z")],[nota("a","2026-10-22T12:00:00Z")],false,false);
    const visual=decorarThread(itens,{fuso:"UTC",agora:new Date("2026-10-22T13:00:00Z"),transferidoDe:"Secretaria"});
    expect(visual.map(i=>i.tipo)).toEqual(["evento","dia","mensagem","dia","mensagem","nota"]);
    expect(visual.filter(i=>i.tipo==="dia").map(i=>i.id)).toEqual(["dia:2026-10-21","dia:2026-10-22"]);
    expect(new Set(visual.map(i=>i.id)).size).toBe(visual.length);
    expect(visual[0]).toMatchObject({tipo:"evento",texto:"Transferido de Secretaria",hora:null,tom:"neutro",icone:"transferencia"});
    expect(itens.map(i=>i.id)).toEqual(["a","b","nota:a"]);
  });
  it("converter nota não inventa autoria própria ou conteúdo de transporte", () => {
    const n=nota("n","2026-10-22T12:00:00Z"),m=notaComoMensagem(n);
    expect(m).toMatchObject({id:"nota:n",corpo:"n",criadoEm:n.criadoEm,autorNome:"Ana",midiaPath:null,templateNome:null,favorita:false});
    expect(m.propria).not.toBe(true);
  });
});
describe("rótulo por dia civil no fuso pessoal", () => {
  it("distingue hoje, ontem e data pelo fuso", () => {
    const agora=new Date("2026-10-22T13:00:00Z");
    expect(rotuloDia("2026-10-22T02:30:00Z","America/Sao_Paulo",agora)).toBe("Ontem");
    expect(rotuloDia("2026-10-22T02:30:00Z","UTC",agora)).toBe("Hoje");
    expect(rotuloDia("2026-10-19T12:00:00Z",null,agora)).toBe("19/10/2026");
  });
  it("Ontem é a véspera civil nos dois DST London, não menos24h", () => {
    expect(rotuloDia("2026-10-24T12:00:00Z","Europe/London",new Date("2026-10-25T23:30:00Z"))).toBe("Ontem");
    expect(rotuloDia("2026-03-29T12:00:00Z","Europe/London",new Date("2026-03-29T23:30:00Z"))).toBe("Ontem");
    expect(rotuloDia("2026-03-28T23:30:00Z","Europe/London",new Date("2026-03-29T23:30:00Z"))).toBe("28/03/2026");
  });
  it("virada de ano, bissexto e fallback de fuso inválido", () => {
    expect(rotuloDia("2025-12-31T12:00:00Z","UTC",new Date("2026-01-01T12:00:00Z"))).toBe("Ontem");
    expect(rotuloDia("2024-02-29T12:00:00Z","UTC",new Date("2024-03-01T12:00:00Z"))).toBe("Ontem");
    expect(rotuloDia("2026-10-22T02:30:00Z","Inválido/Fuso",new Date("2026-10-22T13:00:00Z"))).toBe("Hoje");
  });
});

it("decorar paginação preserva âncora de mensagem e chaves mesmo ao trocar rótulo de Hoje",()=>{
 const depois=[mensagem("a","2026-10-22T12:00:00Z"),mensagem("b","2026-10-22T12:01:00Z")];
 const antes=decorarThread(itensDaThread(depois,[],true,false),{fuso:"UTC",agora:new Date("2026-10-22T13:00:00Z")});
 const layout=buildVirtualLayout(antes.map(i=>i.id),new Map(),50),ancora=captureVirtualAnchor(layout,65);
 const mais=decorarThread(itensDaThread([mensagem("antiga","2026-10-21T12:00:00Z"),...depois],[],false,false),{fuso:"UTC",agora:new Date("2026-10-23T13:00:00Z")});
 expect(ancora?.key).toBe("a");expect(restoreVirtualAnchor(buildVirtualLayout(mais.map(i=>i.id),new Map(),50),ancora)).toBe(165);
 expect(antes.find(i=>i.id==="dia:2026-10-22")).toMatchObject({rotulo:"Hoje"});expect(mais.find(i=>i.id==="dia:2026-10-22")).toMatchObject({rotulo:"Ontem"});
});


describe("C3 PR398: data inválida não duplica separador", () => {
  it.each(["mensagem", "nota"] as const)("preserva o último dia válido ao atravessar %s sem criadoEm válido", tipo => {
    const itens: import("./itens-thread").ItemThread[] = [
      { tipo: "mensagem", id: "antes", m: mensagem("antes", "2026-10-22T12:00:00Z") },
      tipo === "nota" ? { tipo: "nota", id: "nota:invalida", n: nota("invalida", "data inválida") } : { tipo: "mensagem", id: "invalida", m: mensagem("invalida", "data inválida") },
      { tipo: "mensagem", id: "depois", m: mensagem("depois", "2026-10-22T12:01:00Z") },
    ];
    const visual = decorarThread(itens, { fuso: "UTC", agora: new Date("2026-10-22T13:00:00Z") });
    expect(visual.filter(i => i.tipo === "dia").map(i => i.id)).toEqual(["dia:2026-10-22"]);
    expect(new Set(visual.map(i => i.id)).size).toBe(visual.length);
    expect(visual.filter(i => i.tipo === "mensagem" || i.tipo === "nota").map(i => i.id)).toEqual(itens.map(i => i.id));
    expect(visual.find(i => i.id === itens[1].id)).toMatchObject({ emSequencia: false });
  });
  it("data inválida inicial não inventa dia e mudança civil real continua criando separador", () => {
    const itens: import("./itens-thread").ItemThread[] = [
      { tipo: "nota", id: "nota:invalida", n: nota("invalida", "data inválida") },
      { tipo: "mensagem", id: "ontem", m: mensagem("ontem", "2026-10-21T12:00:00Z") },
      { tipo: "mensagem", id: "hoje", m: mensagem("hoje", "2026-10-22T12:00:00Z") },
    ];
    const visual = decorarThread(itens, { fuso: "UTC", agora: new Date("2026-10-22T13:00:00Z") });
    expect(visual[0]).toMatchObject({ id: "nota:invalida", emSequencia: false });
    expect(visual.filter(i => i.tipo === "dia")).toEqual([{ tipo: "dia", id: "dia:2026-10-21", rotulo: "Ontem" }, { tipo: "dia", id: "dia:2026-10-22", rotulo: "Hoje" }]);
  });
});

it("cartão entre balões rompe sequência e conserva separadores/transferência",()=>{
 const a=saida("a",{criadoEm:"2026-10-22T12:00:00Z"}),b=saida("b",{criadoEm:"2026-10-22T12:02:00Z"});
 const extra={tipo:"sugestao-aria",id:"sugestao-aria:s",s:{id:"s",criadoEm:"2026-10-22T12:01:00Z"}};
 const r=decorarThread([{tipo:"mensagem",id:a.id,m:a},extra,{tipo:"mensagem",id:b.id,m:b}] as Parameters<typeof decorarThread>[0],{fuso:"UTC",agora:new Date("2026-10-22T13:00Z"),transferidoDe:"Comercial"});
 expect(r.map(i=>i.id)).toEqual(["evento:transferencia","dia:2026-10-22","a","sugestao-aria:s","b"]);
 expect(r.filter(i=>i.tipo==="mensagem").map(i=>i.emSequencia)).toEqual([false,false]);
});
