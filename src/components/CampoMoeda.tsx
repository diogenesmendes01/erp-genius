"use client";

import { simboloMoeda, parseMoeda, formatarMoedaParaCampo, casasDecimais, avisoSemCentavos, avisoPontoAmbiguo } from "@/lib/dinheiro";

// Substitui type="number" step="0.01" nos campos de dinheiro (ver docs/42-auditoria-frontend-ux.md,
// ganho rápido 13). Duas garantias que o número nativo não dá:
//   1. "1.234" nunca vira 1234 nem 1234 nunca vira 1.234 — parseMoeda rejeita o que for
//      ambíguo em vez de adivinhar (ver src/lib/dinheiro.ts).
//   2. o símbolo da moeda fica visível no campo, então o operador nunca digita achando que
//      é outra moeda.
// Não valida nem bloqueia digitação livre — o operador pode digitar qualquer coisa; só ao
// perder o foco (onBlur) o texto é normalizado para "1234,56" se for interpretável. Texto
// não interpretável fica como está, visível, para o operador corrigir — a validação de
// "campo obrigatório"/"valor inválido" continua sendo responsabilidade de quem usa o campo,
// igual a qualquer outro input controlado deste app.
// Moeda sem centavos (CRC, CLP…; ver casasDecimais) com casas decimais no texto — "100,50" em CRC —
// NÃO é normalizada no blur (antes virava "101" em silêncio — C6 do doc 44, issue #167): o texto fica
// como o operador digitou e um aviso visível (role="alert", ligado ao input por aria-describedby
// quando há id) pede para conferir o valor — em tom neutro, porque saldo fracionado em CRC é legítimo e
// pode vir pré-preenchido (R1 da #173, B1). O valor nunca é arredondado aqui.
// Texto com ponto que parseMoeda recusou ("100.50", "1.234") ganha, no mesmo lugar, a dica de
// avisoPontoAmbiguo (R1 da #173, C1): "use vírgula para os centavos" ou "não use ponto de milhar". As
// mensagens de validação dos chamadores não mudam. Os dois avisos nunca coexistem: um exige texto
// aceito, o outro texto recusado.
// Sem ganchos de React de propósito: vários testes de tela chamam este componente como função.
export function CampoMoeda({
  value,
  onChange,
  moeda,
  id,
  name,
  ariaLabel,
  required,
  placeholder,
  className,
  disabled,
  "aria-required": ariaRequired,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}: {
  value: string;
  onChange: (valor: string) => void;
  /** Omitido quando o valor ainda não tem moeda definida (ex.: previsão antes de escolher
   *  o país) — o campo funciona igual, só não mostra símbolo. */
  moeda?: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
  required?: boolean;
  placeholder?: string;
  /** Classe do input já usada no formulário chamador — CampoMoeda só acrescenta o
   *  espaço à esquerda para o símbolo, sem impor um visual próprio. */
  className: string;
  disabled?: boolean;
  /** Ligações do <Campo> (src/components/Campo.tsx): obrigatoriedade, erro e dica/mensagem. */
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const semCentavos = !!moeda && casasDecimais(moeda) === 0;
  const aviso = avisoSemCentavos(value, moeda) ?? avisoPontoAmbiguo(value);
  // O aviso entra na descrição do input junto com a dica/erro do <Campo> (quando houver).
  const avisoId = aviso && id ? `${id}-aviso-moeda` : undefined;
  const descritoPor = [ariaDescribedby, avisoId].filter(Boolean).join(" ") || undefined;

  function normalizarAoSair() {
    const numero = parseMoeda(value);
    if (numero === null) return;
    // Moeda sem centavos com fração digitada: deixa o texto como está (o aviso já aparece) —
    // normalizar aqui seria arredondar o que o operador digitou.
    if (semCentavos && !Number.isInteger(numero)) return;
    // Com moeda conhecida, respeita as casas decimais dela (CRC/CLP saem sem centavos) —
    // sem moeda ainda (ex.: previsão antes de escolher o país), duas casas por padrão.
    onChange(formatarMoedaParaCampo(numero, moeda));
  }

  return (
    <div>
      <div className="relative">
        {moeda && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 max-w-[2.5rem] -translate-y-1/2 truncate text-sm text-gray-500"
          >
            {simboloMoeda(moeda)}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          id={id}
          name={name}
          aria-label={ariaLabel}
          aria-required={ariaRequired}
          aria-invalid={ariaInvalid}
          aria-describedby={descritoPor}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={normalizarAoSair}
          // pl-14 (não pl-9): símbolos de 4 caracteres existem de verdade neste app
          // (COL$, CLP$) e colidiam com o texto digitado no espaço mais estreito.
          className={moeda ? className + " pl-14" : className}
        />
      </div>
      {aviso && <span id={avisoId} role="alert" className="mt-1 block text-xs text-amber-700">{aviso}</span>}
    </div>
  );
}
