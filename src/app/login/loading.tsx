import { EsqueletoAcesso } from "@/components/Esqueleto";

// /login (docs/43 §6 item 10): fora do shell, o cartão de acesso no centro da tela.
export default function LoadingLogin() {
  return <EsqueletoAcesso rotulo="acesso" />;
}
