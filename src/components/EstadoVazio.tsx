import type { ReactNode } from "react";

// Estado vazio do design system (docs/42-auditoria-frontend-ux.md, E1): havia mais de 200 textos
// de "nada aqui" em texto cru, cada um com uma cor (gray-400, 500, 600 ou nenhuma) e sem ação.
// Uma fonte só para o que a tela mostra quando a lista não tem itens.
//
// - Compacto (padrão): seção dentro de um cartão ou de uma ficha.
// - `bloco`: a lista principal da tela — bloco tracejado maior, centralizado.
// - `acao`: o próximo passo (um link ou botão), quando existe um. O vazio é o ponto de partida.
// - `EstadoVazioLinha`: o mesmo, dentro de uma tabela (uma linha que ocupa todas as colunas).
//
// A mensagem vai num <p>: o texto é frase (pode ter <Link> ou <strong>), não bloco.
// `className` é só para posição (margem); aparência vem daqui. A trava está em
// src/app/estados-vazios.test.ts.

type PropsEstadoVazio = {
  /** O que não há — "Nenhuma turma cadastrada." */
  children: ReactNode;
  /** Próximo passo, quando existe (link ou botão). */
  acao?: ReactNode;
  /** Lista principal da tela: bloco tracejado maior e centralizado. */
  bloco?: boolean;
  /** Só posição (margem). */
  className?: string;
  /** Vazio que aparece em resposta a uma ação na tela (busca, troca de opção). */
  role?: "status";
  "aria-busy"?: boolean;
};

const VISUAL = {
  compacto: "rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500",
  bloco: "rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500",
};

export function EstadoVazio({ children, acao, bloco = false, className, ...atributos }: PropsEstadoVazio) {
  return (
    <div data-estado-vazio="" className={(bloco ? VISUAL.bloco : VISUAL.compacto) + (className ? ` ${className}` : "")} {...atributos}>
      <p>{children}</p>
      {acao && <div className={bloco ? "mt-3 flex flex-wrap justify-center gap-2" : "mt-2 flex flex-wrap gap-2"}>{acao}</div>}
    </div>
  );
}

/**
 * Estado vazio dentro de uma tabela: uma linha que ocupa todas as colunas. `role`/`aria-busy` vão
 * num bloco dentro da célula — na <tr>/<td> trocariam a semântica da tabela.
 */
export function EstadoVazioLinha({ colSpan, children, acao, ...atributos }: { colSpan: number; children: ReactNode; acao?: ReactNode; role?: "status"; "aria-busy"?: boolean }) {
  return (
    <tr>
      <td colSpan={colSpan} data-estado-vazio="" className="px-4 py-8 text-center text-sm text-gray-500">
        <div {...atributos}>
          <p>{children}</p>
          {acao && <div className="mt-3 flex flex-wrap justify-center gap-2">{acao}</div>}
        </div>
      </td>
    </tr>
  );
}
