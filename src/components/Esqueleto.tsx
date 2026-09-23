// Esqueletos com o formato de cada tela (ganho rápido 2 da auditoria): o conteúdo não "salta"
// quando carrega, e quem usa leitor de tela ouve o que está carregando.

const bloco = "rounded-md bg-surface-muted";

function Carregando({ rotulo, className, children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className} aria-busy="true">
      <p className="sr-only" role="status">Carregando {rotulo}</p>
      {children}
    </div>
  );
}

function LinhasTabela({ linhas }: { linhas: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="h-9 bg-surface-muted" />
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

/** Título + barra de busca/filtros + tabela (alunos, leads). */
export function EsqueletoLista({ rotulo }: { rotulo: string }) {
  return (
    <Carregando rotulo={rotulo} className="space-y-4">
      <div className={`${bloco} h-7 w-40`} />
      <div className="flex flex-wrap gap-2">
        <div className={`${bloco} h-8 w-64`} />
        <div className={`${bloco} h-8 w-36`} />
        <div className={`${bloco} h-8 w-36`} />
      </div>
      <LinhasTabela linhas={8} />
    </Carregando>
  );
}

/** Título + fileira de abas + tabela (financeiro). */
export function EsqueletoAbas({ rotulo }: { rotulo: string }) {
  return (
    <Carregando rotulo={rotulo} className="space-y-4">
      <div className={`${bloco} h-7 w-40`} />
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 5 }, (_, i) => <div key={i} className={`${bloco} h-8 w-24`} />)}
      </div>
      <LinhasTabela linhas={6} />
    </Carregando>
  );
}

/** Lista de conversas à esquerda + conversa aberta (inbox). */
export function EsqueletoConversas({ rotulo }: { rotulo: string }) {
  return (
    <Carregando rotulo={rotulo} className="flex h-[calc(100vh-13rem)] min-h-[420px] overflow-hidden rounded-lg border border-gray-200 bg-surface">
      <div className="w-80 shrink-0 space-y-3 border-r border-gray-200 p-3">
        <div className={`${bloco} h-8`} />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className={`${bloco} h-4 w-2/3`} />
            <div className={`${bloco} h-3 w-full`} />
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className={`${bloco} h-6 w-48`} />
        <div className={`${bloco} h-10 w-2/3`} />
        <div className={`${bloco} ml-auto h-10 w-1/2`} />
        <div className={`${bloco} mt-auto h-10`} />
      </div>
    </Carregando>
  );
}

/** Colunas do funil (pipeline). */
export function EsqueletoColunas({ rotulo, colunas = 5 }: { rotulo: string; colunas?: number }) {
  return (
    <Carregando rotulo={rotulo} className="space-y-4">
      <div className={`${bloco} h-7 w-40`} />
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
