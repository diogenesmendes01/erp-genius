"use client";

import { useState } from "react";
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
// como o operador digitou e um aviso visível (ligado ao input por aria-describedby quando há id e
// anunciado no blur; ver abaixo) pede para conferir o valor — em tom neutro, porque saldo fracionado em CRC é legítimo e
// pode vir pré-preenchido (R1 da #173, B1). O valor nunca é arredondado aqui.
// Texto com ponto que parseMoeda recusou ("100.50", "1.234") ganha, no mesmo lugar, a dica de
// avisoPontoAmbiguo (R1 da #173, C1): "use vírgula para os centavos" ou "não use ponto de milhar". As
// mensagens de validação dos chamadores não mudam. Os dois avisos nunca coexistem: um exige texto
// aceito, o outro texto recusado.
// Anúncio só no blur (C6 da #173, B12 da triagem): o aviso visível muda a cada tecla ("1.2" pede vírgula,
// "1.234" pede para tirar o ponto) e, em role="alert", o leitor de tela interrompia a digitação a cada
// troca. Agora o texto visível só descreve o campo (aria-describedby, lido ao focar) e o anúncio sai de
// uma região polite sempre montada, preenchida ao sair do campo com o aviso que ficou — e esvaziada ao
// voltar a digitar, para o próximo blur anunciar de novo.
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
  // O que a região polite diz: vazio enquanto se digita; o aviso que restou, depois do blur.
  const [anunciado, setAnunciado] = useState<string | null>(null);

  function normalizarAoSair() {
    const numero = parseMoeda(value);
    // Texto recusado ou fração em moeda sem centavos: o texto fica e o aviso visível é anunciado.
    // Moeda sem centavos com fração digitada: normalizar aqui seria arredondar o que o operador digitou.
    if (numero === null || (semCentavos && !Number.isInteger(numero))) {
      setAnunciado(aviso);
      return;
    }
    setAnunciado(null);
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
          onChange={(e) => { setAnunciado(null); onChange(e.target.value); }}
          onBlur={normalizarAoSair}
          // pl-14 (não pl-9): símbolos de 4 caracteres existem de verdade neste app
          // (COL$, CLP$) e colidiam com o texto digitado no espaço mais estreito.
          className={moeda ? className + " pl-14" : className}
        />
      </div>
      {/* Visível e ligado ao input; fora da leitura linear (aria-hidden) porque o anúncio vem da região abaixo. */}
      {aviso ? <span id={avisoId} aria-hidden="true" className="mt-1 block text-xs text-amber-700">{aviso}</span> : null}
      <span role="status" className="sr-only">{anunciado}</span>
    </div>
  );
}
