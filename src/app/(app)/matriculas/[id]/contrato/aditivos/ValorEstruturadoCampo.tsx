"use client";

import { useId, useState } from "react";
import type { OrigemCampo } from "@/server/contratos/campos";

type Props = {
  campo: OrigemCampo;
  rotulo: string;
  disabled: boolean;
  onChange: (valor: unknown) => void;
};

type ValorComTipo = { tipo?: unknown } & Record<string, unknown>;

const comoObjeto = (valor: unknown): ValorComTipo =>
  valor !== null && typeof valor === "object" ? valor as ValorComTipo : {};

const texto = (valor: unknown, tipo: string, chave: string) => {
  const dado = comoObjeto(valor);
  return dado.tipo === tipo && typeof dado[chave] === "string" ? dado[chave] : "";
};

const numero = (valor: unknown, tipo: string, chave: string) => {
  const dado = comoObjeto(valor);
  return dado.tipo === tipo && typeof dado[chave] === "number" && Number.isFinite(dado[chave]) ? String(dado[chave]) : "";
};

const camposTexto = new Set<OrigemCampo>([
  "ALUNO_NOME", "ALUNO_DOCUMENTO", "ALUNO_ENDERECO",
  "PAGADOR_NOME", "PAGADOR_DOCUMENTO", "PAGADOR_ENDERECO",
]);

const camposDinheiro = new Set<OrigemCampo>([
  "TAXA_VALOR", "MENSALIDADE_VALOR", "HORA_VALOR", "ADIANTAMENTO_VALOR",
]);

const camposData = new Set<OrigemCampo>([
  "TAXA_VENCIMENTO", "PRIMEIRA_MENSALIDADE_VENCIMENTO", "COBERTURA_INICIO",
  "COBERTURA_FIM", "ADIANTAMENTO_VENCIMENTO",
]);

function CampoDeTexto({ disabled, onChange, rotulo, valor, tipo = "TEXT", chave = "texto", inputType = "text" }: {
  disabled: boolean;
  onChange: (valor: unknown) => void;
  rotulo: string;
  valor: unknown;
  tipo?: "TEXT" | "EMAIL";
  chave?: "texto" | "email";
  inputType?: "text" | "email";
}) {
  const id = useId();
  return <><label className="block" htmlFor={id}>{rotulo}</label><input id={id} className="mt-1 block w-full rounded border p-2" type={inputType} value={texto(valor, tipo, chave)}
    onChange={event => onChange({ tipo, [chave]: event.target.value })} disabled={disabled} /></>;
}

/** Entrada client-side de um valor de aditivo; a validação e a aplicação são sempre do servidor. */
export function ValorEstruturadoCampo({ campo, rotulo, disabled, onChange }: Props) {
  const [valor, setValor] = useState<unknown>(null);
  const id = useId();
  const atualizar = (proximo: unknown) => { setValor(proximo); onChange(proximo); };

  if (campo.startsWith("ADITIVO_")) {
    return <p role="status">Este é um campo derivado do aditivo e não recebe valor editável.</p>;
  }

  if (camposTexto.has(campo)) return <CampoDeTexto disabled={disabled} onChange={atualizar} rotulo={rotulo} valor={valor} />;

  if (campo === "ALUNO_EMAIL" || campo === "PAGADOR_EMAIL") {
    return <CampoDeTexto disabled={disabled} onChange={atualizar} rotulo={rotulo} valor={valor} tipo="EMAIL" chave="email" inputType="email" />;
  }

  if (camposDinheiro.has(campo)) {
    return <fieldset className="grid gap-2 sm:grid-cols-2"><legend>{rotulo}</legend>
      <div><label className="block" htmlFor={`${id}-valor`}>Valor</label>
        <input id={`${id}-valor`} aria-describedby={`${id}-ajuda-valor`} className="mt-1 block w-full rounded border p-2" type="text" inputMode="decimal" placeholder="Ex.: 1000.00" value={texto(valor, "DINHEIRO", "valor")}
          onChange={event => atualizar({ tipo: "DINHEIRO", valor: event.target.value, moeda: texto(valor, "DINHEIRO", "moeda") })} disabled={disabled} />
        <span id={`${id}-ajuda-valor`} className="mt-1 block text-sm">Use ponto para os centavos, por exemplo 1000.00.</span>
      </div>
      <div><label className="block" htmlFor={`${id}-moeda`}>Moeda</label>
        <input id={`${id}-moeda`} aria-describedby={`${id}-ajuda-moeda`} className="mt-1 block w-full rounded border p-2" type="text" value={texto(valor, "DINHEIRO", "moeda")}
          onChange={event => atualizar({ tipo: "DINHEIRO", valor: texto(valor, "DINHEIRO", "valor"), moeda: event.target.value })} disabled={disabled} />
        <span id={`${id}-ajuda-moeda`} className="mt-1 block text-sm">Código de três letras, por exemplo BRL.</span>
      </div>
    </fieldset>;
  }

  if (camposData.has(campo)) {
    return <><label className="block" htmlFor={id}>{rotulo}</label><input id={id} className="mt-1 block rounded border p-2" type="date" value={texto(valor, "DATA", "data")}
      onChange={event => atualizar({ tipo: "DATA", data: event.target.value })} disabled={disabled} /></>;
  }

  if (campo === "ADIANTAMENTO_MINUTOS") {
    return <><label className="block" htmlFor={id}>{rotulo}</label><input id={id} className="mt-1 block rounded border p-2" type="number" min="1" step="1" value={numero(valor, "MINUTOS", "minutos")}
      onChange={event => atualizar({ tipo: "MINUTOS", minutos: event.target.value === "" ? Number.NaN : Number(event.target.value) })} disabled={disabled} /></>;
  }

  if (campo === "MOEDA") {
    return <><label className="block" htmlFor={id}>{rotulo}</label><input id={id} className="mt-1 block w-full rounded border p-2" type="text" value={texto(valor, "MOEDA", "moeda")}
      onChange={event => atualizar({ tipo: "MOEDA", moeda: event.target.value })} disabled={disabled} /></>;
  }

  if (campo === "REGIME") {
    return <><label className="block" htmlFor={id}>{rotulo}</label><select id={id} className="mt-1 block rounded border p-2" value={texto(valor, "REGIME", "regime")} onChange={event => atualizar({ tipo: "REGIME", regime: event.target.value })} disabled={disabled}>
      <option value="">Selecione o regime</option>
      <option value="MENSALIDADE">Mensalidade</option>
      <option value="HORA_PARTICULAR">Hora particular</option>
    </select></>;
  }

  if (campo === "AGENDA_PARTICULAR") {
    return <p role="status">A proposta não altera horários. A agenda precisa de revisão própria antes de qualquer aplicação.</p>;
  }

  return <p role="status">Não há campo editável seguro para esta origem.</p>;
}
