// Esqueletos com o formato de cada tela (ganho rápido 2 da auditoria): o conteúdo não "salta"
// quando carrega, e quem usa leitor de tela ouve o que está carregando.
//
// O loading.tsx fica DENTRO do layout do mesmo segmento (layout > loading > page). Quando o layout já
// desenha o título ou as abas (financeiro, configuração, matrícula, acadêmico, diário), o esqueleto não
// os desenha de novo — sairiam em dobro (C3 da issue #170). As barras de título e de abas levam
// `data-esqueleto` para a trava contar (src/app/borda-rota.render.test.ts).

const bloco = "rounded-md bg-surface-muted";

function Carregando({ rotulo, className, children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className} aria-busy="true">
      <p className="sr-only" role="status">Carregando {rotulo}</p>
      {children}
    </div>
  );
}

/** Lugar do título (h1) da tela. */
function BarraTitulo({ largura = "w-40" }: { largura?: string }) {
  return <div data-esqueleto="titulo" className={`${bloco} h-7 ${largura}`} />;
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

function Cartao() {
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-4">
      <div className={`${bloco} h-5 w-1/3`} />
      <div className={`${bloco} h-4 w-2/3`} />
      <div className={`${bloco} h-4 w-1/2`} />
    </div>
  );
}

/** Título + barra de busca/filtros + tabela (alunos, leads). */
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

/**
 * Só o conteúdo da aba: indicadores (opcional) + tabela. Para segmento cujo layout já desenha título e
 * abas — /financeiro (o layout de (painel) tem o h1 e a BarraAbasFinanceiro) e /configuracao.
 */
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

/**
 * Título + linha de apoio + (busca) + cartões empilhados: secretaria, diário, acadêmico e as seções da
 * matrícula. As abas, quando a área tem, vêm do layout — não daqui.
 */
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

/**
 * Corpo de uma seção que chega depois do resto da página (fallback de `<Suspense>`). Sem título: quem
 * usa mantém o cabeçalho real da seção em volta, porque ele não depende da consulta.
 */
export function EsqueletoSecao({ rotulo, linhas = 3 }: { rotulo: string; linhas?: number }) {
  return (
    <Carregando rotulo={rotulo} className="space-y-2">
      {Array.from({ length: linhas }, (_, i) => <div key={i} className={`${bloco} h-4 ${i % 2 ? "w-1/2" : "w-2/3"}`} />)}
    </Carregando>
  );
}

/** Título + painel de atendimentos + lista de conversas à esquerda e conversa aberta (inbox). */
export function EsqueletoConversas({ rotulo }: { rotulo: string }) {
  return (
    <Carregando rotulo={rotulo}>
      <BarraTitulo largura="w-24" />
      <div className={`${bloco} mt-1 h-4 w-2/3`} />
      <div className={`${bloco} mt-6 h-24`} />
      <div className="mt-4 flex h-[calc(100vh-13rem)] min-h-[420px] overflow-hidden rounded-lg border border-gray-200 bg-surface">
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
      </div>
    </Carregando>
  );
}

/** Acesso da equipe (/login), fora do shell: cartão estreito no centro com a marca, os campos e o botão. */
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

/** Página pública de consulta (pagamento, validação de certificado): título e um cartão no centro da tela. */
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
