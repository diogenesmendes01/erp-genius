"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Botao, botaoClasses } from "@/components/Botao";
import { Campo, CONTROLE_INVALIDO, focarPrimeiroComErro, type ErrosDeCampos } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { MSG_ATIVACAO_INCERTA } from "@/lib/mensagens";
import { ERRO_LINK_INDISPONIVEL, definirSenhaPortalAluno } from "../requisicoes";
import {
  MAXIMO_BYTES_SENHA, MINIMO_CARACTERES_SENHA, armazenamentoDaAba, bytesDaSenha, capturarTokenAtivacao, esquecerTokenAtivacao, validarSenhas,
  type CampoSenha,
} from "./ativacao";

// Definir a senha do portal pelo link do convite ou da recuperação (docs/42 /portal-aluno/ativar; docs/43 §6
// item 8). O link sobrevive ao F5 (cópia na aba, ver ./ativacao.ts); sem link, a tela não mostra o formulário
// e diz o que fazer. A regra da senha está escrita, a confirmação bloqueia o envio enquanto as duas não
// coincidem, e erro e sucesso saem separados (useAcaoCliente + FeedbackAcao). Os campos não têm maxLength:
// ele conta caracteres, e o limite é de 72 bytes; quem avisa é a validarSenhas, no envio (#172).

const IDS: Record<CampoSenha, string> = { senha: "ativar-senha", confirmacao: "ativar-confirmacao" };
const CONTROLE = `w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${CONTROLE_INVALIDO}`;
const MSG_ACESSO_CONFIRMADO = "Senha definida. Abrindo a sua área do aluno…";
const MSG_EMAIL_VALIDADO = "Seu novo e-mail foi validado. A escola vai liberar o acesso com ele; você receberá um aviso.";

function Moldura({ children }: { children: ReactNode }) {
  return <section className="mx-auto flex min-h-screen max-w-md items-center px-5"><div className="w-full rounded-xl border bg-surface p-7"><h1 className="text-2xl font-medium">Definir senha</h1>{children}</div></section>;
}

/** Saídas de quem não tem (ou já não tem) um link válido nesta aba. */
function SemLink({ indisponivel }: { indisponivel: boolean }) {
  return <>
    <p className="mt-3 text-sm text-gray-700">{indisponivel ? ERRO_LINK_INDISPONIVEL : "Não encontramos o link de acesso nesta aba."}</p>
    <p className="mt-2 text-sm text-gray-600">Abra de novo o link que a escola enviou para o seu e-mail. Se ele já foi usado ou expirou, peça um novo.</p>
    <div className="mt-5 flex flex-wrap gap-3">
      <Link href="/portal-aluno/recuperar" className={botaoClasses({ tamanho: "lg" })}>Pedir um novo link</Link>
      <Link href="/portal-aluno/entrar" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Já tenho senha: entrar</Link>
    </div>
  </>;
}

export default function AtivarPortalAlunoPage() {
  const router = useRouter();
  // undefined: lendo o link (o efeito ainda não rodou); null: não há link nesta aba; texto: o segredo.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [indisponivel, setIndisponivel] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [errosCampos, setErrosCampos] = useState<ErrosDeCampos<CampoSenha>>({});
  // A ativação consome o link: não há chave de idempotência (a falha de rede tem instrução própria abaixo).
  const acao = useAcaoCliente({ idempotente: false });

  useEffect(() => {
    const lido = capturarTokenAtivacao(window.location.hash, armazenamentoDaAba());
    // O segredo vive no fragmento, que não alcança logs HTTP, e some da barra; a cópia da aba fica para o F5.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    setToken(lido);
  }, []);

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!token || acao.ocupado) return;
    const erros = validarSenhas(senha, confirmacao);
    setErrosCampos(erros);
    if (focarPrimeiroComErro(erros, IDS)) return;
    const desfecho = await acao.executar(
      () => definirSenhaPortalAluno(token, senha),
      (dado) => (dado?.conclusao === "EMAIL_VALIDADO" ? MSG_EMAIL_VALIDADO : MSG_ACESSO_CONFIRMADO),
    );
    if (desfecho?.tipo === "ok") {
      esquecerTokenAtivacao(armazenamentoDaAba());
      if (desfecho.dado?.conclusao !== "EMAIL_VALIDADO") { router.replace("/portal-aluno"); router.refresh(); }
    } else if (desfecho?.tipo === "erro" && desfecho.mensagem === ERRO_LINK_INDISPONIVEL) {
      // O link não serve mais: some com o formulário e mostra as saídas.
      esquecerTokenAtivacao(armazenamentoDaAba());
      setIndisponivel(true);
      setToken(null);
    } else if (desfecho?.tipo === "incerto") {
      acao.setErro(MSG_ATIVACAO_INCERTA);
    }
  }

  if (token === undefined) return <Moldura><p className="mt-3 text-sm text-gray-600">Conferindo o link de acesso…</p></Moldura>;
  if (token === null) return <Moldura><SemLink indisponivel={indisponivel} /></Moldura>;

  const concluido = acao.sucesso !== null;
  return <Moldura>
    {!concluido && <form onSubmit={confirmar} noValidate className="mt-5 space-y-4">
      <p className="text-sm text-gray-600">Crie uma senha que só você conhece. Ela vale para entrar na área do aluno.</p>
      <Campo rotulo="Nova senha" obrigatorio id={IDS.senha} erro={errosCampos.senha} dica={`Mínimo de ${MINIMO_CARACTERES_SENHA} caracteres (até ${MAXIMO_BYTES_SENHA} bytes). Digitados: ${senha.length} caracteres (${bytesDaSenha(senha)} bytes).`}>
        {(campo) => <input {...campo} name="senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={CONTROLE} />}
      </Campo>
      <Campo rotulo="Repita a senha" obrigatorio id={IDS.confirmacao} erro={errosCampos.confirmacao} dica="Digite a mesma senha de novo. O envio só acontece quando as duas coincidem.">
        {(campo) => <input {...campo} name="confirmacao" type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} className={CONTROLE} />}
      </Campo>
      <Botao type="submit" tamanho="lg" className="w-full" disabled={acao.ocupado}>{acao.ocupado ? "Confirmando…" : "Confirmar acesso"}</Botao>
    </form>}
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-4" />
    <Link href="/portal-aluno/entrar" className="mt-5 block text-sm text-brand-700 underline">Já tenho senha: entrar</Link>
  </Moldura>;
}
