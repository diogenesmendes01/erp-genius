"use client";
import { useId, type ChangeEvent } from "react";
import { fusoIanaValido, MSG_FUSO_NAO_RECONHECIDO } from "@/server/operacao/fuso";

// O campo de fuso do sistema (docs/42-auditoria-frontend-ux.md, ganho rápido 14; docs/43 §6 item 6). Todo
// campo em que alguém digita ou escolhe um fuso passa por aqui — a trava é src/app/fuso-instante.test.ts.
//
// O bug que motivou o componente: UTC é um fuso IANA válido, então o servidor aceita — a aula, o prazo ou a
// autorização gravam com o instante certo NO FUSO ERRADO, sem erro nenhum, só um deslocamento silencioso de
// horas em relação ao que a pessoa quis dizer. Por isso não há valor padrão aqui: cada chamador passa o fuso
// da escola (consultarFusoInstitucional), o da preferência ou o do registro editado (fusoInicialDeEntrada), e
// "" quando nenhum é conhecido — o campo fica vazio e obrigatório, nunca um fuso plausível-mas-errado.
//
// Continua sendo um <input> com <datalist> de sugestões (não um <select> travado): o servidor aceita qualquer
// fuso IANA válido (FusoInstitucionalSchema) e algumas telas precisam de um fuso fora da lista (aluno ou
// professor fora da sede). A validação é a mesma do servidor (fusoIanaValido), no próprio campo: o navegador
// barra o envio com "Não reconhecemos esse fuso…" em vez de a pessoa descobrir no erro do servidor.
//
// O id do <datalist> vem de useId(), não de `id`/`name`: mais de um CampoFuso na mesma página (ex.
// Disponibilizar e Realizar) tinham o mesmo nome e colidiam no id da lista.

/** Sugestão do datalist: o identificador, ou o identificador e o nome pelo qual a pessoa procura. */
export type SugestaoFuso = string | readonly [valor: string, rotulo: string];

/** Fusos operados pela escola. */
export const FUSOS_SUGERIDOS: readonly SugestaoFuso[] = [
  ["America/Sao_Paulo", "Brasil — São Paulo"],
  ["America/Costa_Rica", "Costa Rica"],
  ["America/Manaus", "Brasil — Manaus"],
  ["America/Rio_Branco", "Brasil — Rio Branco"],
];

let todosEmCache: readonly string[] | null = null;
/** Todos os fusos IANA do ambiente (lista vazia onde `Intl.supportedValuesOf` não existe). */
export function todosOsFusos(): readonly string[] {
  if (todosEmCache) return todosEmCache;
  try { todosEmCache = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []; } catch { todosEmCache = []; }
  return todosEmCache;
}

/** Mensagem de validade do campo: "" para fuso reconhecido ou vazio (o vazio fica com o `required` nativo). */
export function validadeDoFuso(valor: string): string {
  const fuso = valor.trim();
  return !fuso || fusoIanaValido(fuso) ? "" : MSG_FUSO_NAO_RECONHECIDO;
}

type Comum = {
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className: string;
  /** Sugestões no topo da lista (padrão: os fusos operados pela escola). */
  sugestoes?: readonly SugestaoFuso[];
  /** Inclui todos os fusos do ambiente depois das sugestões (preferência de exibição). */
  todos?: boolean;
  /** Opção vazia no topo, com o texto dado (ex.: "Usar fuso de origem do encontro"). */
  opcaoVazia?: string;
  onBlur?: () => void;
  "aria-label"?: string;
  /** Ligações do <Campo> (src/components/Campo.tsx): obrigatoriedade, erro e dica/mensagem. */
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};
/**
 * Não controlado: `padrao` é o valor inicial — fuso da escola, da preferência ou do registro; "" se não houver
 * um conhecido (nunca "UTC" fixo). `onChange` só acompanha o que foi digitado (ex.: prévia de conversão).
 * Controlado: `valor` + `onChange`.
 */
type Props = Comum & ({ padrao: string; valor?: undefined; onChange?: (valor: string) => void } | { valor: string; padrao?: undefined; onChange: (valor: string) => void });

export function CampoFuso({
  id,
  padrao,
  valor,
  onChange,
  onBlur,
  name = "fuso",
  required = true,
  disabled,
  placeholder,
  className,
  sugestoes = FUSOS_SUGERIDOS,
  todos = false,
  opcaoVazia,
  "aria-label": ariaLabel,
  "aria-required": ariaRequired,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}: Props) {
  const listaId = `fusos-${useId()}`;
  const controlado = valor !== undefined;
  const lista = sugestoes.map((s): readonly [string, string | undefined] => (typeof s === "string" ? [s, undefined] : s));
  const aoMudar = (evento: ChangeEvent<HTMLInputElement>) => {
    const texto = evento.currentTarget.value;
    evento.currentTarget.setCustomValidity(validadeDoFuso(texto));
    onChange?.(texto);
  };
  return (
    <>
      <input
        id={id}
        name={name}
        list={listaId}
        value={controlado ? valor : undefined}
        defaultValue={controlado ? undefined : padrao}
        onChange={aoMudar}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-required={ariaRequired}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        maxLength={100}
        className={className}
      />
      <datalist id={listaId}>
        {opcaoVazia !== undefined && <option value="">{opcaoVazia}</option>}
        {lista.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}
        {todos && todosOsFusos().filter((f) => !lista.some(([v]) => v === f)).map((f) => <option key={f} value={f} />)}
      </datalist>
    </>
  );
}
