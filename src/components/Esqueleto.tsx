const bloco = "animate-pulse rounded-md bg-gray-100";

function Carregando({ rotulo, className, children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className} aria-busy="true">
      <p className="sr-only" role="status">Carregando {rotulo}</p>
      {children}
    </div>
  );
}

function BarraTitulo({ largura = "w-40" }: { largura?: string }) {
  return <div data-esqueleto="titulo" className={`${bloco} h-7 ${largura}`} />;
}

function LinhasTabela({ linhas }: { linhas: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="h-9 bg-gray-100" />
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t border-gray-200 px-4 py-3">
          <div className={`${bloco} h-4 w-1/4`} />
          <div className={`${bloco} h-4 w-1/6`} />
          <div className={`${bloco} h-4 w-1/5`} />
          <div className={`${bloco} ml-auto h-4 w-16`} />
        </div>
      ))}
    </div>
  );
}

function Cartao() {
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-4">
      <div className={`${bloco} h-5 w-1/3`} />
      <div className={`${bloco} h-4 w-2/3`} />
      <div className={`${bloco} h-4 w-1/2`} />
    </div>
  );
}

export function EsqueletoLista({ rotulo }: { rotulo: string }) {
  return (
    <Carregando rotulo={rotulo} className="space-y-4">
      <BarraTitulo />
      <div className="flex flex-wrap gap-2">
        <div className={`${bloco} h-8 w-64`} />
        <div className={`${bloco} h-8 w-36`} />
        <div className={`${bloco} h-8 w-36`} />
      </div>
      <LinhasTabela linhas={8} />
    </Carregando>
  );
}

export function EsqueletoTabela({ rotulo, indicadores = 0, linhas = 6 }: { rotulo: string; indicadores?: number; linhas?: number }) {
  return (
    <Carregando rotulo={rotulo} className="space-y-4">
      {indicadores > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: indicadores }, (_, i) => <div key={i} className={`${bloco} h-20`} />)}
        </div>
      )}
      <LinhasTabela linhas={linhas} />
    </Carregando>
  );
}

export function EsqueletoCartoes({ rotulo, cartoes = 3, busca = false }: { rotulo: string; cartoes?: number; busca?: boolean }) {
  return (
    <Carregando rotulo={rotulo} className="space-y-4">
      <BarraTitulo largura="w-56" />
      <div className={`${bloco} h-4 w-2/3`} />
      {busca && (
        <div className="flex flex-wrap gap-2">
          <div className={`${bloco} h-8 w-72`} />
          <div className={`${bloco} h-8 w-20`} />
        </div>
      )}
      {Array.from({ length: cartoes }, (_, i) => <Cartao key={i} />)}
    </Carregando>
  );
}

export function EsqueletoSecao({ rotulo, linhas = 3 }: { rotulo: string; linhas?: number }) {
  return (
    <Carregando rotulo={rotulo} className="space-y-2">
      {Array.from({ length: linhas }, (_, i) => <div key={i} className={`${bloco} h-4 ${i % 2 ? "w-1/2" : "w-2/3"}`} />)}
    </Carregando>
  );
}

export function EsqueletoThread({ rotulo }: { rotulo: string }) {
  return <Carregando rotulo={rotulo} className="min-w-0">
    <div aria-hidden="true" className="flex flex-col gap-4">
      {[false, true, false, true].map((saida, i) => <div key={i} className={`${bloco} h-12 max-w-full ${saida ? "ml-auto w-1/2" : "w-2/3"}`} />)}
    </div>
  </Carregando>;
}

export function EsqueletoPainel({ rotulo }: { rotulo: string }) {
  return <Carregando rotulo={rotulo} className="min-w-0">
    <div aria-hidden="true" className="space-y-3">
      <div className={`${bloco} h-4 w-2/3`} /><div className={`${bloco} h-4 w-full`} /><div className={`${bloco} h-4 w-1/2`} />
    </div>
  </Carregando>;
}

export function EsqueletoConversas({ rotulo }: { rotulo: string }) {
  return <Carregando rotulo={rotulo} className="-m-4 md:-m-8 flex min-h-0 h-[calc(100dvh-3.5625rem)] sm:h-[calc(100dvh-3.3125rem)] md:h-dvh overflow-hidden">
    <div aria-hidden="true" className="flex w-full min-h-0 flex-col overflow-hidden border-gray-200 bg-surface min-[960px]:w-[300px] min-[960px]:shrink-0 min-[960px]:border-r min-[1100px]:w-[372px]">
      <div className="shrink-0 space-y-3 px-[18px] pb-3 pt-[18px]">
        <div data-esqueleto="titulo" className={`${bloco} h-5 w-32`} />
        <div className={`${bloco} h-[38px] w-full rounded-item`} />
        <div className="flex flex-wrap gap-1.5">{[0, 1, 2].map(i => <div key={i} className={`${bloco} h-7 w-20 rounded-[20px]`} />)}</div>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-hidden px-[18px] py-3">
        {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="flex gap-3">
          <div className={`${bloco} h-11 w-11 shrink-0 rounded-full`} />
          <div className="min-w-0 flex-1 space-y-2"><div className={`${bloco} h-4 w-2/3`} /><div className={`${bloco} h-3 w-full`} /></div>
        </div>)}
      </div>
    </div>
    <div aria-hidden="true" className="hidden min-h-0 min-w-0 flex-1 flex-col fundo-conversa min-[960px]:flex">
      <div className="flex h-[68px] shrink-0 items-center border-b border-gray-200 bg-surface px-3"><div className={`${bloco} h-5 w-40`} /></div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-[7%] py-[18px]">
        {[false, true, false, true].map((saida, i) => <div key={i} className={`${bloco} h-12 shrink-0 ${saida ? "ml-auto w-1/2" : "w-2/3"}`} />)}
        <div className={`${bloco} mt-auto h-10 shrink-0`} />
      </div>
    </div>
    <div aria-hidden="true" className="hidden min-h-0 w-[348px] shrink-0 flex-col items-center gap-3.5 overflow-hidden border-l border-gray-200 bg-surface px-6 pt-9 min-[1400px]:flex">
      <div className={`${bloco} h-[132px] w-[132px] shrink-0 rounded-full`} /><div className={`${bloco} h-5 w-32`} /><div className={`${bloco} h-4 w-40`} />
    </div>
  </Carregando>;
}

export function EsqueletoColunas({ rotulo, colunas = 5 }: { rotulo: string; colunas?: number }) {
  return (
    <Carregando rotulo={rotulo} className="space-y-4">
      <BarraTitulo />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {Array.from({ length: colunas }, (_, i) => (
          <div key={i} className="w-64 shrink-0 space-y-2">
            <div className={`${bloco} h-6 w-32`} />
            <div className={`${bloco} h-20`} />
            <div className={`${bloco} h-20`} />
          </div>
        ))}
      </div>
    </Carregando>
  );
}

function BarraAbas({ abas = 5 }: { abas?: number }) {
  return (
    <div data-esqueleto="abas" className="flex gap-1 overflow-hidden">
      {Array.from({ length: abas }, (_, i) => <div key={i} className={`${bloco} h-8 w-24 shrink-0 rounded-full`} />)}
    </div>
  );
}

export function EsqueletoArea({ rotulo, area = "abas" }: { rotulo: string; area?: "financeiro" | "configuracao" | "matricula" | "abas" }) {
  if (area === "financeiro" || area === "configuracao") {
    return (
      <Carregando rotulo={rotulo} className="space-y-4">
        <BarraTitulo largura={area === "financeiro" ? "w-32" : "w-40"} />
        {area === "configuracao" && <div className={`${bloco} h-4 w-1/2`} />}
        <BarraAbas abas={area === "financeiro" ? 6 : 5} />
        {area === "financeiro" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className={`${bloco} h-20`} />)}
          </div>
        )}
        <LinhasTabela linhas={6} />
      </Carregando>
    );
  }
  return (
    <Carregando rotulo={rotulo} className="space-y-4">
      <div className="space-y-3 border-b border-gray-200 pb-3">
        {area === "matricula" && (
          <div data-esqueleto="registro" className="flex flex-wrap items-center gap-3">
            <div className={`${bloco} h-4 w-24`} />
            <div className={`${bloco} h-4 w-40`} />
            <div className={`${bloco} h-5 w-16 rounded-full`} />
          </div>
        )}
        <BarraAbas />
      </div>
      <BarraTitulo largura="w-56" />
      <div className={`${bloco} h-4 w-2/3`} />
      {Array.from({ length: 3 }, (_, i) => <Cartao key={i} />)}
    </Carregando>
  );
}

export function EsqueletoAcesso({ rotulo, campos = 2 }: { rotulo: string; campos?: number }) {
  return (
    <Carregando rotulo={rotulo} className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-gray-200 bg-surface p-8">
        <div data-esqueleto="titulo" className={`${bloco} mb-2 h-7 w-32`} />
        {Array.from({ length: campos }, (_, i) => (
          <div key={i} className="space-y-1">
            <div className={`${bloco} h-4 w-16`} />
            <div className={`${bloco} h-9`} />
          </div>
        ))}
        <div className={`${bloco} h-9`} />
      </div>
    </Carregando>
  );
}

export function EsqueletoPublico({ rotulo }: { rotulo: string }) {
  return (
    <Carregando rotulo={rotulo} className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-10">
      <BarraTitulo largura="w-64" />
      <div className="space-y-3 rounded-lg border border-gray-200 bg-surface p-4">
        <div className={`${bloco} h-4 w-1/2`} />
        <div className={`${bloco} h-8 w-1/3`} />
        <div className={`${bloco} h-12`} />
      </div>
    </Carregando>
  );
}
