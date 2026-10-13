import { EsqueletoTabela } from "@/components/Esqueleto";

// Configuração (docs/42 /configuracao #1, L2324): o layout da área já desenha o h1 "Configuração", a linha
// de apoio e as sub-abas, e continua montado na troca de sub-aba — aqui só a tabela da sub-aba.
export default function LoadingConfiguracao() {
  return <EsqueletoTabela rotulo="configuração" />;
}
