"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { decidirTrocaFonteReposicaoGravacao, proporTrocaFonteReposicaoGravacao } from "@/server/gravacoes/troca-fonte-reposicao";

type Proposta = {
  id: string;
  motivo: string;
  criadaEm: string;
  versaoMaterialEsperada: number;
  fonteMaterialAnterior: { versao: number; driveRevisionId: string };
  fontePublicacao: { versao: number; driveRevisionId: string };
  preparadorId: string;
  preparador: { nome: string | null };
  podeDecidir: boolean;
  decisao: { aprovada: boolean; motivo: string; decididaEm: string; decisor: { nome: string | null } } | null;
  fonteMaterial: { versao: number; driveRevisionId: string; origemPublicacaoId: string | null } | null;
};

type Contexto = {
  reposicaoId: string;
  materialId: string;
  matriculaId: string;
  fonteMaterialAtual: { versao: number; revisao: string };
  fontePublicacaoAtual: { versao: number; revisao: string };
  materialDisponivel: boolean;
  disponibilizacaoId: string | null;
};

type Resultado = { ok: boolean; erro?: string };

/** Não recebe arquivo, revisão ou fonte do formulário: todos são resolvidos pela reposição no servidor. */
export function TrocaFonteReposicao({ contexto, propostas }: { contexto: Contexto; propostas: Proposta[] }) {
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const router = useRouter();
  const chave = useRef<string>();
  const executar = (acao: () => Promise<Resultado>, sucesso: string) => iniciar(async () => {
    setErro(""); setFeito("");
    try {
      const resultado = await acao();
      if (!resultado.ok) { setErro(resultado.erro ?? "A operação não foi confirmada."); return; }
      setFeito(sucesso); router.refresh();
    } catch { setErro("A operação não foi confirmada. Atualize a página antes de tentar novamente."); }
  });
  const propor = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const motivo = String(new FormData(evento.currentTarget).get("motivo") ?? "");
    chave.current ??= crypto.randomUUID();
    executar(async () => {
      const resultado = await proporTrocaFonteReposicaoGravacao({ reposicaoId: contexto.reposicaoId, motivo, chaveIdempotencia: chave.current });
      if (resultado.ok) chave.current = undefined;
      return resultado;
    }, "Proposta registrada para decisão independente.");
  };
  return <section className="space-y-5">
    <section className="rounded border bg-white p-4 text-sm" aria-label="Fontes atuais da reposição">
      <h2 className="font-medium">Fonte da reposição</h2>
      <p className="mt-1">Material: versão {contexto.fonteMaterialAtual.versao}, revisão fixa {contexto.fonteMaterialAtual.revisao}.</p>
      <p>Publicação corrigida da aula original: versão {contexto.fontePublicacaoAtual.versao}, revisão fixa {contexto.fontePublicacaoAtual.revisao}.</p>
      <p className="mt-1 text-gray-700">O material está {contexto.materialDisponivel ? "disponível" : "indisponível"}. A troca só cria outra versão da fonte; não altera disponibilização, entregas, avaliações ou prazos.</p>
    </section>
    <form className="space-y-3 rounded border bg-white p-4" onSubmit={propor}>
      <h2 className="font-medium">Propor adoção da publicação corrigida</h2>
      <p className="text-sm text-gray-700">A fonte publicada acima será fotografada pelo servidor. Esta tela não aceita identificador de arquivo, revisão ou URL.</p>
      <label className="block text-sm">Motivo<textarea name="motivo" required minLength={5} maxLength={4000} disabled={ocupado} className="mt-1 block w-full rounded border p-2" /></label>
      <button disabled={ocupado} className="rounded border px-3 py-2">Preparar para decisão independente</button>
    </form>
    <section className="space-y-3" aria-label="Histórico de trocas de fonte">
      <h2 className="font-medium">Histórico antes e depois</h2>
      {propostas.length === 0 ? <p className="text-sm">Nenhuma troca de fonte foi proposta para esta reposição.</p> : propostas.map((proposta) => <article key={proposta.id} className="rounded border bg-white p-4 text-sm">
        <p className="font-medium">Material v{proposta.fonteMaterialAnterior.versao} ({proposta.fonteMaterialAnterior.driveRevisionId}) → publicação v{proposta.fontePublicacao.versao} ({proposta.fontePublicacao.driveRevisionId})</p>
        <p className="mt-1 whitespace-pre-wrap">Motivo: {proposta.motivo}</p>
        <p className="mt-1 text-gray-600">Preparada por {proposta.preparador.nome ?? "Usuário"} em {new Date(proposta.criadaEm).toLocaleString("pt-BR")}.</p>
        {proposta.decisao ? <p role="status" className="mt-2">{proposta.decisao.aprovada ? "Aprovada" : "Rejeitada"} por {proposta.decisao.decisor.nome ?? "Usuário"}: {proposta.decisao.motivo}{proposta.fonteMaterial ? ` Fonte MATERIAL v${proposta.fonteMaterial.versao} fixada.` : ""}</p>
          : !proposta.podeDecidir ? <p role="status" className="mt-2">Aguardando decisão de outra pessoa autorizada.</p>
            : <form className="mt-3 space-y-2" onSubmit={(evento) => { evento.preventDefault(); const motivo = String(new FormData(evento.currentTarget).get("motivo") ?? ""); const aprovar = String((evento.nativeEvent as SubmitEvent).submitter?.getAttribute("value")) === "aprovar"; executar(() => decidirTrocaFonteReposicaoGravacao({ propostaId: proposta.id, aprovar, motivo }), "Decisão registrada."); }}>
              <label className="block">Motivo da decisão<textarea name="motivo" required minLength={5} maxLength={4000} disabled={ocupado} className="block w-full rounded border p-2" /></label>
              <button name="decisao" value="aprovar" disabled={ocupado} className="rounded border px-3 py-2">Aprovar adoção</button>
              <button name="decisao" value="rejeitar" disabled={ocupado} className="ml-2 rounded border px-3 py-2">Rejeitar</button>
            </form>}
      </article>)}
    </section>
    {feito && <p role="status">{feito}</p>}
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </section>;
}
