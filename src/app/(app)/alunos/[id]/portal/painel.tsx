"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { decidirTrocaEmailPortalAluno, prepararConvitePortalAluno, prepararTrocaEmailPortalAluno } from "@/server/portal-aluno/actions";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { MensagemStatus } from "@/components/MensagemStatus";

type Troca = { id: string; novoEmail: string; situacao: string; preparadorId: string; criadaEm: string; novoEmailVerificadoEm: string | null; decisao: { aprovada: boolean; motivo: string; criadaEm: string } | null };

export function PainelAcessoPortalAluno({ alunoId, emailCadastro, conta, trocas, podeDecidir, preferenciaFusoExibicao }: {
  alunoId: string; emailCadastro: string | null; conta: { emailVerificado: string | null; temSenha: boolean; ativa: boolean } | null; trocas: Troca[]; podeDecidir: boolean; preferenciaFusoExibicao: string | null;
}) {
  const router = useRouter(); const [erro, setErro] = useState<string | null>(null); const [aviso, setAviso] = useState<string | null>(null);
  const instanteAdministrativo = (valor: string) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };
  async function convite() {
    setErro(null); setAviso(null); const resultado = await prepararConvitePortalAluno({ alunoId });
    if (!resultado.ok) setErro(resultado.erro); else setAviso(resultado.dado?.situacao === "PENDENTE_EMAIL" ? "Acesso pendente: cadastre e confirme um e-mail individual." : "Convite preparado. O envio depende da configuração institucional.");
    router.refresh();
  }
  async function troca(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); setErro(null); setAviso(null);
    // O SyntheticEvent não deve ser consultado depois do await. O formulário
    // permanece válido como referência para limpar somente após o sucesso.
    const formulario = evento.currentTarget;
    const form = new FormData(formulario);
    const resultado = await prepararTrocaEmailPortalAluno({ alunoId, novoEmail: String(form.get("novoEmail") ?? ""), motivo: String(form.get("motivo") ?? ""), evidencia: String(form.get("evidencia") ?? "") });
    if (!resultado.ok) setErro(resultado.erro); else { setAviso("Validação do novo endereço preparada. Uma pessoa diferente da Administração decide depois da validação."); formulario.reset(); }
    router.refresh();
  }
  async function decidir(solicitacaoId: string, aprovar: boolean, motivo: string) {
    setErro(null); setAviso(null);
    const resultado = await decidirTrocaEmailPortalAluno({ solicitacaoId, aprovar, motivo });
    if (!resultado.ok) setErro(resultado.erro); else setAviso(aprovar ? "Troca aplicada; sessões e links anteriores foram revogados. A recuperação foi preparada para o novo endereço." : "Troca de e-mail rejeitada.");
    router.refresh();
  }
  return <div className="space-y-5"><section className="rounded border bg-surface p-4"><h2 className="font-medium">Situação</h2><dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-gray-500">E-mail cadastrado</dt><dd>{emailCadastro ?? "Ausente"}</dd></div><div><dt className="text-gray-500">Identidade de portal</dt><dd>{conta ? conta.ativa ? conta.temSenha ? "Ativa" : "Aguardando definição de senha" : "Bloqueada" : "Ainda não preparada"}</dd></div><div><dt className="text-gray-500">E-mail verificado do portal</dt><dd>{conta?.emailVerificado ?? "Ainda não confirmado pelo convite"}</dd></div></dl></section>
    <section className="rounded border bg-surface p-4"><h2 className="font-medium">Convite individual</h2><p className="mt-1 text-sm text-gray-600">Não há senha nem link para copiar nesta tela.</p><button onClick={convite} className="mt-3 rounded bg-brand-solid px-3 py-2 text-sm text-white">Preparar convite</button></section>
    <section className="rounded border bg-surface p-4"><h2 className="font-medium">Troca assistida de e-mail</h2><form onSubmit={troca} className="mt-3 grid gap-3"><label className="text-sm">Novo e-mail<input required name="novoEmail" type="email" className="mt-1 w-full rounded border px-3 py-2" /></label><label className="text-sm">Motivo<textarea required minLength={5} name="motivo" className="mt-1 w-full rounded border px-3 py-2" /></label><label className="text-sm">Evidência de identidade e vínculo<textarea required minLength={5} name="evidencia" className="mt-1 w-full rounded border px-3 py-2" /></label><button className="justify-self-start rounded border px-3 py-2 text-sm">Preparar validação</button></form></section>
    <section className="rounded border bg-surface p-4"><h2 className="font-medium">Solicitações de troca</h2>{!trocas.length ? <p className="mt-2 text-sm text-gray-600">Nenhuma solicitação.</p> : <div className="mt-3 space-y-3">{trocas.map((troca) => <article key={troca.id} className="rounded border p-3 text-sm"><p>{troca.novoEmail} · {troca.situacao}</p><p className="mt-1 text-gray-600">Preparada em {instanteAdministrativo(troca.criadaEm)}</p>{troca.novoEmailVerificadoEm && <p className="mt-1 text-gray-600">Novo endereço confirmado em {instanteAdministrativo(troca.novoEmailVerificadoEm)}</p>}{troca.decisao && <p className="mt-1">Decisão {troca.decisao.aprovada ? "aprovada" : "rejeitada"} em {instanteAdministrativo(troca.decisao.criadaEm)}.</p>}{podeDecidir && troca.situacao === "PENDENTE_DECISAO" && <form onSubmit={(evento) => { evento.preventDefault(); void decidir(troca.id, true, String(new FormData(evento.currentTarget).get("motivo") ?? "")); }} className="mt-3 flex flex-wrap gap-2"><input required name="motivo" placeholder="Motivo da decisão" className="min-w-48 flex-1 rounded border px-2 py-1" /><button className="rounded bg-brand-solid px-2 py-1 text-white">Aprovar e aplicar</button><button type="button" onClick={(evento) => { const formulario = evento.currentTarget.form; if (formulario) void decidir(troca.id, false, String(new FormData(formulario).get("motivo") ?? "")); }} className="rounded border px-2 py-1">Rejeitar</button></form>}</article>)}</div>}</section>
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}<MensagemStatus texto={aviso} className="text-sm text-green-700" />
  </div>;
}
