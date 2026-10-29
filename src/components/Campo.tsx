import { useId, type ReactNode } from "react";

export type LigacaoCampo = {
  id: string;
  "aria-required"?: true;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

export type ErrosDeCampos<K extends string> = Partial<Record<K, string>>;

export const ROTULO_CAMPO = "mb-1 block text-sm font-medium text-gray-800";
export const DICA_CAMPO = "mt-1 block text-xs text-gray-500";
export const ERRO_CAMPO = "mt-1 block text-xs text-red-700";
export const CONTROLE_INVALIDO = "aria-[invalid=true]:border-red-500";
export const CONTROLE_CAMPO =
  `w-full min-h-11 md:min-h-[36px] rounded-md border border-gray-200 bg-surface-muted px-3 py-1.5 text-sm text-gray-800 transition-colors focus:border-brand-500 focus:bg-surface focus:outline-none ${CONTROLE_INVALIDO}`;

type PropsCampo = {
  rotulo: ReactNode;
  obrigatorio?: boolean;
  dica?: ReactNode;
  erro?: string | null;
  id?: string;
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

export function focarPrimeiroComErro<K extends string>(erros: ErrosDeCampos<K>, ids: Record<K, string>): boolean {
  const primeiro = (Object.keys(erros) as K[]).find((k) => erros[k]);
  if (primeiro === undefined) return false;
  if (typeof document !== "undefined") document.getElementById(ids[primeiro])?.focus();
  return true;
}
