import { ROTULOS_ORIGEM } from "@/server/contratos/campos";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarModelosContratuais } from "@/server/contratos/modelos";
import { ConteudoModeloSchema, PrepararModeloSchema } from "@/server/contratos/modelo-schema";
import { ModeloFormulario } from "../ModeloFormulario";
import { DecidirModelo } from "../DecidirModelo";
import { PAPEIS_MODELO, CONDICOES_MODELO } from "../labels";

export default async function ModeloPage({ params, searchParams }: { params: Promise<{ codigo: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const codigo = (await params).codigo;
  if (!PrepararModeloSchema.shape.codigo.safeParse(codigo).success) notFound();
  const p = Number((await searchParams).pagina ?? 1), pagina = Number.isInteger(p) && p > 0 && p <= 100000 ? p : 1;
  const dados = await consultarModelosContratuais({ codigo, pagina });
  if (!dados.modelos.length && pagina === 1) notFound();
  const atual = pagina === 1 ? dados.modelos[0] : null;
  const conteudoAtual = atual ? ConteudoModeloSchema.safeParse(atual.conteudo) : null;
  return <section className="space-y-5">
    <Link href="/configuracao/contratos" className="underline">Todos os modelos</Link>
    <h2 className="text-xl font-medium">Modelo {codigo}</h2>
    <p>A publicação autoriza o uso do modelo. Os contratos de cada matrícula ainda precisam ser gerados, conferidos e assinados.</p>
    {atual && conteudoAtual?.success && <details className="rounded border p-4"><summary className="cursor-pointer font-medium">Preparar nova versão a partir da versão {atual.versao}</summary>
      <div className="mt-4"><ModeloFormulario key={atual.id} codigo={codigo} versaoEsperada={atual.versao} inicial={conteudoAtual.data} /></div>
    </details>}
    <h3 className="font-medium">Histórico e revisão</h3>
    {dados.modelos.map((m, i) => {
      const c = ConteudoModeloSchema.safeParse(m.conteudo);
      return <details key={m.id} open={i === 0} className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Versão {m.versao} — {m.decisao ? m.decisao.aprovada ? "Publicada" : "Rejeitada" : "Aguardando decisão"}</summary>
        <div className="mt-4 space-y-4">
          <p>Preparada por {m.preparador.nome}, em {m.criadaEm.toISOString().replace("T", " ").slice(0, 19)} UTC.</p>
          <p className="whitespace-pre-wrap">Motivo: {m.motivo}</p>
          {!c.success ? <p role="alert">Estrutura de conteúdo inválida. Encaminhe para conferência; esta tela não permite publicar a versão.</p> : <>
            <h4 className="text-lg font-medium">{c.data.titulo}</h4>
            <p>{c.data.finalidade === "CONTRATO" ? "Contrato" : "Aditivo"} · {c.data.regimes.map((r) => r === "MENSALIDADE" ? "Mensalidade" : "Particular por hora").join(", ")}</p>
            <div><h5 className="font-medium">Aplicação</h5><p className="whitespace-pre-wrap">{c.data.aplicacao}</p></div>
            <div><h5 className="font-medium">Campos declarados</h5>{c.data.campos.length ? <dl>{c.data.campos.map((campo) => <div key={campo.chave} className="my-2"><dt className="font-mono">{`{{${campo.chave}}}`}</dt><dd>{campo.descricao} — {campo.origem ? ROTULOS_ORIGEM[campo.origem] : "Origem pendente: geração indisponível para este campo"}</dd></div>)}</dl> : <p>Sem campos variáveis.</p>}</div>
            {c.data.secoes.map((s, j) => <article key={j} className="rounded bg-gray-50 p-4"><h5 className="font-medium">{j + 1}. {s.titulo}</h5><p className="mt-2 whitespace-pre-wrap break-words">{s.texto}</p></article>)}
            <div><h5 className="font-medium">Assinaturas exigidas</h5><ul>{c.data.assinaturas.map((a, j) => <li key={j}>{PAPEIS_MODELO[a.papel]} — {CONDICOES_MODELO[a.condicao]}</li>)}</ul></div>
          </>}
          {m.decisao ? <div className="border-t pt-3"><p>{m.decisao.aprovada ? "Publicada" : "Rejeitada"} por {m.decisao.decisor.nome}, em {m.decisao.criadaEm.toISOString().replace("T", " ").slice(0, 19)} UTC.</p><p className="whitespace-pre-wrap">{m.decisao.motivo}</p></div>
            : c.success && usuario.papeis.includes(Papel.ADMINISTRADOR) && usuario.id !== m.preparador.id ? <DecidirModelo modeloId={m.id} conteudoHash={m.conteudoHash} />
              : <p>Esta versão aguarda decisão de outra pessoa da Administração.</p>}
        </div>
      </details>;
    })}
    <nav aria-label="Páginas do histórico" className="flex gap-4">
      {pagina > 1 && <Link href={`?pagina=${pagina - 1}`}>Anterior</Link>}
      <span>Página {pagina}</span>{dados.temProxima && <Link href={`?pagina=${pagina + 1}`}>Próxima</Link>}
    </nav>
  </section>;
}
