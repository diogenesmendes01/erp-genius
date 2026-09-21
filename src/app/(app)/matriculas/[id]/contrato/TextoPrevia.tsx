import { z } from "zod";
import { TextoPreviaSchema } from "@/server/contratos/previa-projecao";
import { ROTULOS_ORIGEM } from "@/server/contratos/campos";
import { PAPEIS_MODELO } from "@/app/(app)/configuracao/contratos/labels";
export function TextoPrevia({ dados }: { dados: z.infer<typeof TextoPreviaSchema> }) {
  return <section className="space-y-4">
    <p>Modelo {dados.modeloCodigo} · versão {dados.modeloVersao}. Condições de entrada: versão {dados.condicoesVersao}.</p>
    <div className="rounded border p-3"><h2 className="font-medium">Aplicação do modelo</h2><p className="whitespace-pre-wrap">{dados.aplicacao}</p></div>
    <article className="space-y-4 rounded border p-5"><h2 className="text-xl font-medium">{dados.documento.titulo}</h2>{dados.documento.secoes.map((s, i) => <section key={i}><h3 className="font-medium">{s.titulo}</h3><p className="mt-2 whitespace-pre-wrap break-words">{s.texto}</p></section>)}</article>
    <details className="rounded border p-3"><summary>Conferir a origem dos campos preenchidos</summary><dl className="mt-3 space-y-2">{dados.documento.campos.map((c) => <div key={c.chave}><dt className="font-medium">{c.chave} · {ROTULOS_ORIGEM[c.origem]}</dt><dd className="whitespace-pre-wrap break-words">{c.valor}</dd></div>)}</dl></details>
    <section className="space-y-2 rounded border p-3"><h2 className="font-medium">Exigências de assinatura</h2>
      <p>Identifique as pessoas correspondentes antes do envio. O lado do cliente assina primeiro; a escola participa depois, quando exigida pelo modelo.</p>
      {dados.assinaturasPlanejadas ? <>
        <ul>{dados.assinaturasPlanejadas.participantesExigidos.map((p) => <li key={p.papel}>{PAPEIS_MODELO[p.papel]} · {p.etapa === "CLIENTE" ? "etapa do cliente" : "etapa da escola"}</li>)}</ul>
        {dados.assinaturasPlanejadas.pendencias.map((p) => <p key={p} role="status">{p}</p>)}
        <p>Os papéis acima ainda não comprovam identificação, representação ou assinatura das pessoas.</p>
      </> : <p>Esta prévia histórica não contém o planejamento de signatários. Seu conteúdo original permanece preservado.</p>}
    </section>
  </section>;
}
