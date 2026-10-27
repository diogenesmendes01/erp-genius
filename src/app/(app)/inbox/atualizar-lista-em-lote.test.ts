import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarAtualizadorEmLote } from "./atualizar-lista-em-lote";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("lotes de atualização da lista", () => {
  it("agrupa a rajada numa fronteira fixa50ms sem adiar com avisos novos", async () => {
    const executar = vi.fn(async () => {});
    const fila = criarAtualizadorEmLote(executar);
    fila.solicitar(); fila.solicitar();
    await vi.advanceTimersByTimeAsync(40); fila.solicitar();
    expect(executar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    expect(executar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(executar).toHaveBeenCalledTimes(1);
    fila.descartar();
  });
  it("mantém um voo e uma pendência até o corpo terminar; depois executa uma só atualização fresca", async () => {
    let concluir!: () => void;
    const executar = vi.fn(() => new Promise<void>(r => { concluir = r; }));
    const fila = criarAtualizadorEmLote(executar);
    fila.solicitar(); await vi.advanceTimersByTimeAsync(50);
    for (let n = 0; n < 20; n++) fila.solicitar();
    await vi.advanceTimersByTimeAsync(500);
    expect(executar).toHaveBeenCalledTimes(1);
    concluir(); await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(49); expect(executar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(executar).toHaveBeenCalledTimes(2);
    fila.descartar(); concluir();
  });
  it.each([false, true])("erro não repete sozinho; preserva apenas pendência real=%s", async pendente => {
    let rejeitar!: (e: Error) => void;
    const executar = vi.fn(() => new Promise<void>((_,r) => { rejeitar = r; }));
    const fila = criarAtualizadorEmLote(executar);
    fila.solicitar(); await vi.advanceTimersByTimeAsync(50);
    if(pendente) fila.solicitar();
    rejeitar(new Error("rede")); await vi.advanceTimersByTimeAsync(50);
    expect(executar).toHaveBeenCalledTimes(pendente ? 2 : 1);
    fila.descartar();
  });
  it("trocar contexto invalida voo antigo e cancela lote pendente sem liberar o corpo antigo", async () => {
    const vigencias: (() => boolean)[] = [];
    const resolvers: (() => void)[] = [];
    const fila = criarAtualizadorEmLote(vigente => {
      vigencias.push(vigente);
      return new Promise<void>(r => resolvers.push(r));
    });
    fila.solicitar(); await vi.advanceTimersByTimeAsync(50);
    fila.solicitar(); fila.cancelarPendentes();
    fila.solicitar(); fila.cancelarPendentes();
    expect(vigencias[0]()).toBe(false);
    fila.solicitar(); await vi.advanceTimersByTimeAsync(100);
    expect(vigencias).toHaveLength(1);
    resolvers[0](); await vi.advanceTimersByTimeAsync(50);
    expect(vigencias).toHaveLength(2); expect(vigencias[1]()).toBe(true);
    fila.descartar(); resolvers[1]();
  });
  it("cancelar antes50ms não faz consulta e não deixa timer", async () => {
    const executar = vi.fn(async () => {});
    const fila = criarAtualizadorEmLote(executar);
    fila.solicitar(); fila.cancelarPendentes();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(500); expect(executar).not.toHaveBeenCalled();
    fila.descartar();
  });
  it("dispose invalida voo e pendência, não permite reagendar; novo mount é independente", async () => {
    let concluir!: () => void;
    let vigente!: () => boolean;
    const anterior = criarAtualizadorEmLote(v => { vigente=v; return new Promise<void>(r => { concluir=r; }); });
    anterior.solicitar(); await vi.advanceTimersByTimeAsync(50); anterior.solicitar();
    anterior.descartar(); anterior.solicitar(); expect(vigente()).toBe(false);
    const executar = vi.fn(async () => {});
    const atual = criarAtualizadorEmLote(executar);
    atual.solicitar(); concluir(); await vi.advanceTimersByTimeAsync(50);
    expect(executar).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    atual.descartar();
  });
});


it("StrictMode React real setup→cleanup→setup conserva um timer e um GET; unmount limpa tudo", async () => {
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const { criarDomMinimo } = await import("@/test/dom-minimo");
  const dom=criarDomMinimo();
  vi.stubGlobal("window",dom.janela);vi.stubGlobal("document",dom.documento);
  const React=await import("react");
  const { createRoot }=await import("react-dom/client");
  const { flushSync }=await import("react-dom");
  const executar=vi.fn(async()=>{});
  let montagens=0;
  function Consumidor(){
    React.useEffect(()=>{
      montagens++;
      const fila=criarAtualizadorEmLote(executar);fila.solicitar();
      return()=>fila.descartar();
    },[]);
    return null;
  }
  const container=dom.documento.createElement("div");dom.documento.body.appendChild(container);
  const root=createRoot(container as unknown as HTMLElement);
  let montado=true;
  try{
    flushSync(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Consumidor))));
    expect(montagens).toBe(2);expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(50);expect(executar).toHaveBeenCalledTimes(1);
    flushSync(()=>root.unmount());montado=false;expect(vi.getTimerCount()).toBe(0);
  }finally{if(montado)flushSync(()=>root.unmount());vi.unstubAllGlobals();}
});

it("P2 invalidação do snapshot em voo consolida1trailing, sem liberar corpo/consultas concorrentes",async()=>{
  const concluir:(()=>void)[]=[];
  const executar=vi.fn(()=>new Promise<void>(r=>concluir.push(r)));
  const fila=criarAtualizadorEmLote(executar);
  fila.solicitar();await vi.advanceTimersByTimeAsync(50);
  for(let n=0;n<20;n++)fila.invalidarSnapshotEmVoo();
  await vi.advanceTimersByTimeAsync(500);expect(executar).toHaveBeenCalledTimes(1);
  concluir[0]();await vi.advanceTimersByTimeAsync(50);expect(executar).toHaveBeenCalledTimes(2);
  fila.descartar();concluir[1]();
});
it("P2 invalidar idle não consulta e antesdoGET não muda fronteira/duplica lote",async()=>{
  const executar=vi.fn(async()=>{});
  const fila=criarAtualizadorEmLote(executar);
  fila.invalidarSnapshotEmVoo();await vi.advanceTimersByTimeAsync(100);expect(executar).not.toHaveBeenCalled();
  fila.solicitar();await vi.advanceTimersByTimeAsync(40);fila.invalidarSnapshotEmVoo();
  await vi.advanceTimersByTimeAsync(10);expect(executar).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(100);expect(executar).toHaveBeenCalledTimes(1);
  fila.descartar();
});
it("P2 A→B→A não reabilita voo da épocaA antiga nem cria trailing ao invalidar props atuais",async()=>{
  let concluir!:()=>void;
  const executar=vi.fn(()=>new Promise<void>(r=>{concluir=r;}));
  const fila=criarAtualizadorEmLote(executar);
  fila.solicitar();await vi.advanceTimersByTimeAsync(50);
  fila.cancelarPendentes();fila.cancelarPendentes();
  fila.invalidarSnapshotEmVoo();concluir();await vi.advanceTimersByTimeAsync(500);
  expect(executar).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  fila.descartar();
});
