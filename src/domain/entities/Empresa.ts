import type { Empresa as EmpresaDTO } from '@/types/database'

export interface EmpresaProps {
  id: string
  nome: string
  slug: string | null
  cnpj?: string | null
  createdAt: string
}

/** Entidade de domínio — Empresa (tenant). */
export class Empresa {
  readonly id: string
  readonly nome: string
  readonly slug: string | null
  readonly cnpj: string | null
  readonly createdAt: string

  constructor(props: EmpresaProps) {
    this.id = props.id
    this.nome = props.nome
    this.slug = props.slug
    this.cnpj = props.cnpj ?? null
    this.createdAt = props.createdAt
  }

  toDTO(): EmpresaDTO {
    return {
      id: this.id,
      nome: this.nome,
      slug: this.slug,
      cnpj: this.cnpj,
      created_at: this.createdAt,
    }
  }
}
