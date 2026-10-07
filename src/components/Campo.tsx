import { useId, type ReactNode } from "react";

// Campo de formulário do design system (docs/42-auditoria-frontend-ux.md, E1 e E7; §5.2 e §5.4): havia
// 198 controles sem nome acessível, 0 aria-invalid para 619 `required` e um wrapper local (o `Campo` de
// /matriculas/nova) que deixava rótulo e campo como irmãos sem ligação. Uma fonte só para o que liga
// rótulo, dica, erro e obrigatoriedade a um controle.
//
// - O controle é passado por função (render prop): <Campo rotulo="Nome">{(campo) => <input {...campo} />}</Campo>.
//   `campo` traz o id (o mesmo do htmlFor do rótulo), aria-required, aria-invalid e aria-describedby.
//   Assim o Campo compõe com qualquer controle — <input>, <select>, CampoTexto, CampoMoeda, CampoFuso —
//   sem duplicar nenhum deles: cada um só precisa repassar esses atributos.
// - `obrigatorio`: aria-required no controle e o asterisco no rótulo (aria-hidden: quem usa leitor de
//   tela já ouve "obrigatório" pelo atributo). Não põe `required` nativo — o bloqueio do navegador no
//   envio continua sendo decisão de quem usa o campo.
// - `erro`: só com mensagem o controle fica aria-invalid; a mensagem (role="alert") entra em
//   aria-describedby. Erro vazio ou nulo não marca nada.
// - `dica`: texto de apoio permanente (formato, regra), também em aria-describedby, antes do erro.
// - `id`: opcional. Sem ele, o id vem de useId(); com ele, a tela pode focar o campo pelo id (primeiro
//   campo com erro, ver focarPrimeiroComErro).
//
// Sem "use client": o Campo não tem estado e serve também a telas do servidor. A trava está em
// src/app/campos.test.ts (manifesto em src/app/campos-mapa.ts).

/** O que o Campo entrega ao controle: espalhar inteiro (`{...campo}`), sem sobrescrever. */
export type LigacaoCampo = {
  id: string;
  "aria-required"?: true;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

/** Erros por campo de um formulário: só os campos com problema têm chave. */
export type ErrosDeCampos<K extends string> = Partial<Record<K, string>>;

export const ROTULO_CAMPO = "mb-1 block text-xs text-gray-600";
export const DICA_CAMPO = "mt-1 block text-xs text-gray-500";
export const ERRO_CAMPO = "mt-1 block text-xs text-red-700";
/** Borda do controle marcado como inválido — acrescentar à classe do controle (só tokens: red-500 = --danger-text). */
export const CONTROLE_INVALIDO = "aria-[invalid=true]:border-red-500";

type PropsCampo = {
  /** Nome do campo, em sentence case — "Data de nascimento". */
  rotulo: ReactNode;
  obrigatorio?: boolean;
  /** Apoio permanente: formato esperado, regra, consequência. */
  dica?: ReactNode;
  /** Mensagem do problema neste campo; vazio ou nulo = sem erro. */
  erro?: string | null;
  /** Id fixo do controle (para focar pelo id); sem ele, useId(). */
  id?: string;
  /** Só posição na grade (col-span, margem); a aparência vem daqui. */
  className?: string;
  children: (campo: LigacaoCampo) => ReactNode;
};

export function Campo({ rotulo, obrigatorio = false, dica, erro, id: idFixo, className, children }: PropsCampo) {
  const gerado = useId();
  const id = idFixo ?? `campo-${gerado}`;
  const dicaId = `${id}-dica`;
  const erroId = `${id}-erro`;
  const temDica = dica !== undefined && dica !== null && dica !== false && dica !== "";
  const temErro = !!erro;
  const descritoPor = [temDica ? dicaId : null, temErro ? erroId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className={ROTULO_CAMPO}>
        {rotulo}
        {obrigatorio && <span aria-hidden="true" className="text-red-700"> *</span>}
      </label>
      {children({
        id,
        "aria-required": obrigatorio || undefined,
        "aria-invalid": temErro || undefined,
        "aria-describedby": descritoPor,
      })}
      {temDica && <span id={dicaId} className={DICA_CAMPO}>{dica}</span>}
      {temErro && <span id={erroId} role="alert" className={ERRO_CAMPO}>{erro}</span>}
    </div>
  );
}

/**
 * Leva o foco ao primeiro campo com erro, na ordem em que a validação os encontrou (a ordem da tela).
 * Chamar no clique de "Salvar"/"Próximo" — o operador vê o campo e o leitor de tela lê rótulo + erro.
 * Devolve true quando havia erro (para a tela interromper o envio).
 */
export function focarPrimeiroComErro<K extends string>(erros: ErrosDeCampos<K>, ids: Record<K, string>): boolean {
  const primeiro = (Object.keys(erros) as K[]).find((k) => erros[k]);
  if (primeiro === undefined) return false;
  if (typeof document !== "undefined") document.getElementById(ids[primeiro])?.focus();
  return true;
}
