"use client";
import { useId } from "react";

// Substitui os `defaultValue="UTC"` fixos nos campos de fuso (ver docs/42-auditoria-frontend-ux.md,
// ganho rápido 14). O bug real: UTC é um fuso IANA válido, então o servidor aceita — a aula, o
// prazo ou a autorização gravam com o instante certo NO FUSO ERRADO, sem erro nenhum, só um
// deslocamento silencioso de horas em relação ao que a pessoa realmente quis dizer.
//
// `padrao` é obrigatório e não tem valor default aqui de propósito: cada chamador busca o fuso
// institucional real (consultarFusoInstitucional) e decide o que fazer quando ele ainda não
// está configurado (o padrão seguro é "" — força o operador a digitar, nunca um fuso
// plausível-mas-errado).
//
// Continua sendo um <input> com <datalist> de sugestões (não um <select> travado): o servidor
// já valida qualquer IANA válido (FusoInstitucionalSchema), e algumas telas legitimamente
// precisam de um fuso fora da lista sugerida (aluno/professor fora da sede). Trocar por select
// removeria essa flexibilidade sem resolver o bug real, que é só o valor inicial errado.
//
// O id do <datalist> vem de useId(), não de `id`/`name`: mais de um CampoFuso na mesma página
// (ex. Disponibilizar e Realizar) tinham o mesmo `name="fuso"` e colidiam em "fusos-fuso".
const FUSOS_SUGERIDOS = ["America/Sao_Paulo", "America/Costa_Rica", "America/Manaus", "America/Rio_Branco"];

export function CampoFuso({
  padrao,
  id,
  name = "fuso",
  required = true,
  className,
}: {
  /** Fuso institucional (ou o fuso do registro sendo editado) — nunca "UTC" fixo. Use "" se
   *  ainda não houver um fuso conhecido pra sugerir; o campo fica vazio e obrigatório. */
  padrao: string;
  id?: string;
  name?: string;
  required?: boolean;
  className: string;
}) {
  const listaId = `fusos-${useId()}`;
  return (
    <>
      <input
        id={id}
        name={name}
        list={listaId}
        defaultValue={padrao}
        required={required}
        maxLength={100}
        className={className}
      />
      <datalist id={listaId}>
        {FUSOS_SUGERIDOS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </>
  );
}
