"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmarIndisponibilidadeOperacional,
  liberarEntregaOperacional,
  prorrogarEtapaOperacional,
  publicarMaterialOperacional,
  retomarIndisponibilidadeOperacional,
} from "@/server/diario/reposicao-entrega-operacional";
import { descartarRelatoIndisponibilidadeEquipe } from "@/server/diario/reposicao-operacoes-relatos";
import { RelatarIndisponibilidadeReposicao } from "./RelatarIndisponibilidadeReposicao";

export type OperacaoEntrega = {
  reposicaoId: string;
  matriculaStatus: string;
  fuso: string;
  material: { publicadoEm: string; disponivel: boolean } | null;
  etapa: { correcaoId: string | null; prazoAte: string | null; prazoInicialAte: string | null };
  liberacao: { podeLiberar: boolean; expiraEm: string | null };
  indisponibilidade: { id: string; inicio: string; motivo: string } | null;
  relatosAbertos: Array<{ id: string; descricao: string; criadaEm: string }>;
};

const data = (valor: string | null, fuso: string) => {
  if (!valor) return "Não definido";
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(valor)); }
  catch { return valor; }
};

type Resultado = { ok: boolean; erro?: string };

/** Gestão operacional da gravação. O painel não abre Drive nem revela a conta do aluno. */
export function OperacaoEntregaReposicao({ operacao }: { operacao: OperacaoEntrega }) {
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const router = useRouter();
  const executar = (acao: () => Promise<Resultado>) => iniciar(async () => {
    setErro("");
    try {
      const resultado = await acao();
      if (!resultado.ok) { setErro(resultado.erro ?? "A operação não foi confirmada. Atualize a consulta antes de tentar novamente."); return; }
      router.refresh();
    } catch { setErro("A operação não foi confirmada. Atualize a consulta antes de tentar novamente."); }
  });
  return <section className="space-y-3 border-t pt-4" aria-label="Material e entregas da reposição gravada">
    <h3 className="font-medium">Material e entregas gravadas</h3>
    <p className="text-sm">O material usa uma fonte institucional identificada. Esta tela não reproduz conteúdo nem expõe conta, contato ou link do portal.</p>
    {!operacao.material && <button type="button" disabled={ocupado} className="rounded border px-3 py-2" onClick={() => executar(() => publicarMaterialOperacional({ reposicaoId: operacao.reposicaoId, usarGravacaoAulaOriginal: true }))}>Usar gravação da aula original e abrir prazo</button>}
    {!operacao.material ? <form className="space-y-2 rounded border p-3" onSubmit={(evento) => { evento.preventDefault(); const dados = new FormData(evento.currentTarget); executar(() => publicarMaterialOperacional({ reposicaoId: operacao.reposicaoId, arquivoOficialId: String(dados.get("arquivoOficialId") ?? "") })); }}>
      <p className="font-medium">Publicar material</p>
      <label className="block">ID oficial do arquivo no Drive<input name="arquivoOficialId" required minLength={3} maxLength={500} autoComplete="off" className="block w-full rounded border p-2" /></label>
      <p className="text-sm text-gray-600">Informe somente o identificador institucional do arquivo, nunca URL pública.</p>
      <button disabled={ocupado} className="rounded border px-3 py-2">Publicar e abrir prazo</button>
    </form> : <p role="status">Material publicado em {data(operacao.material.publicadoEm, operacao.fuso)} ({operacao.fuso}). Situação: {operacao.material.disponivel ? "disponível" : "indisponível"}.</p>}
    <p role="status">{operacao.etapa.correcaoId ? "Etapa atual: correção solicitada." : "Etapa atual: primeira entrega."} Prazo vigente: {data(operacao.etapa.prazoAte, operacao.fuso)} ({operacao.fuso}).</p>
    {operacao.material && operacao.etapa.prazoAte && <form className="space-y-2 rounded border p-3" onSubmit={(evento) => { evento.preventDefault(); const dados = new FormData(evento.currentTarget); executar(() => prorrogarEtapaOperacional({ reposicaoId: operacao.reposicaoId, solicitacaoCorrecaoId: operacao.etapa.correcaoId, prazoAnterior: operacao.etapa.prazoAte, novoPrazo: new Date(String(dados.get("novoPrazo") ?? "")).toISOString(), motivo: String(dados.get("motivo") ?? "") })); }}>
      <p className="font-medium">Prorrogar etapa vigente</p>
      <label className="block">Novo prazo (horário local)<input name="novoPrazo" type="datetime-local" required className="block rounded border p-2" /></label>
      <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
      <button disabled={ocupado} className="rounded border px-3 py-2">Prorrogar prazo conferido</button>
    </form>}
    {operacao.liberacao.podeLiberar && <form className="space-y-2 rounded border p-3" onSubmit={(evento) => { evento.preventDefault(); const dados = new FormData(evento.currentTarget); executar(() => liberarEntregaOperacional({ reposicaoId: operacao.reposicaoId, expiraEm: new Date(String(dados.get("expiraEm") ?? "")).toISOString(), motivo: String(dados.get("motivo") ?? "") })); }}>
      <p className="font-medium">Liberação específica para matrícula {operacao.matriculaStatus.toLowerCase()}</p>
      {operacao.liberacao.expiraEm && <p className="text-sm">Liberação vigente até {data(operacao.liberacao.expiraEm, operacao.fuso)} ({operacao.fuso}).</p>}
      <label className="block">Expira em (horário local)<input name="expiraEm" type="datetime-local" required className="block rounded border p-2" /></label>
      <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
      <button disabled={ocupado} className="rounded border px-3 py-2">Liberar entrega específica</button>
    </form>}
    {operacao.material && <RelatarIndisponibilidadeReposicao reposicaoId={operacao.reposicaoId} />}
    {operacao.relatosAbertos.map((relato) => <form key={relato.id} className="space-y-2 rounded border p-3" onSubmit={(evento) => { evento.preventDefault(); const dados = new FormData(evento.currentTarget); const motivo = String(dados.get("motivo") ?? ""); executar(() => dados.get("decisao") === "DESCARTAR" ? descartarRelatoIndisponibilidadeEquipe({ reposicaoId: operacao.reposicaoId, relatoId: relato.id, motivo }) : confirmarIndisponibilidadeOperacional({ reposicaoId: operacao.reposicaoId, relatoId: relato.id, motivo })); }}>
      <p className="font-medium">Relato de indisponibilidade em {data(relato.criadaEm, operacao.fuso)} ({operacao.fuso})</p><p className="whitespace-pre-wrap text-sm">{relato.descricao}</p>
      <label className="block">Motivo da decisão<textarea name="motivo" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
      <div className="flex flex-wrap gap-2"><button name="decisao" value="CONFIRMAR" disabled={ocupado} className="rounded border px-3 py-2">Confirmar indisponibilidade e pausar prazo</button><button name="decisao" value="DESCARTAR" disabled={ocupado} className="rounded border px-3 py-2">Descartar relato sem pausar</button></div>
    </form>)}
    {operacao.indisponibilidade && <form className="space-y-2 rounded border p-3" onSubmit={(evento) => { evento.preventDefault(); const dados = new FormData(evento.currentTarget); executar(() => retomarIndisponibilidadeOperacional({ reposicaoId: operacao.reposicaoId, indisponibilidadeId: operacao.indisponibilidade!.id, motivo: String(dados.get("motivo") ?? "") })); }}>
      <p className="font-medium">Prazo pausado desde {data(operacao.indisponibilidade.inicio, operacao.fuso)} ({operacao.fuso})</p><p className="whitespace-pre-wrap text-sm">{operacao.indisponibilidade.motivo}</p>
      <label className="block">Motivo da retomada<textarea name="motivo" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
      <button disabled={ocupado} className="rounded border px-3 py-2">Retomar material e prazo</button>
    </form>}
    {erro && <p role="alert">{erro}</p>}
  </section>;
}
