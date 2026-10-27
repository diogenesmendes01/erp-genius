export const SHADES_FUNDO_DA_MARCA = ["brand-500", "brand-600", "brand-solid", "success"] as const;

export const SUPERFICIES = ["--bg-page", "--neutral-muted", "--surface", "--surface-muted"] as const;

export const SUPERFICIES_DA_SELECAO = ["--bg-page", "--neutral-muted", "--surface", "--surface-muted"] as const;

export const FUNDOS_SOLIDOS = ["--ai-solid", "--brand-solid", "--danger-solid", "--success-solid"] as const;

export const TEXTO_SOBRE_SOLIDO = {
  "--brand-solid": "--on-brand-solid",
  "--success-solid": "--on-brand-solid",
  "--danger-solid": "white",
  "--ai-solid": "white",
  "--avatar-1": "white",
  "--avatar-2": "white",
  "--avatar-3": "white",
  "--avatar-4": "white",
  "--avatar-5": "white",
  "--avatar-6": "white",
  "--avatar-7": "white",
  "--avatar-8": "white",
} as const;

export const FUNDOS_DA_MARCA_SEM_TEXTO: readonly { arquivo: string; trecho: string; motivo: string }[] = [];

export const EXCECOES_CONTRASTE: readonly { arquivo: string; trecho: string; motivo: string }[] = [];
