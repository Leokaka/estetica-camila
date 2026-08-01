import type { VariantProps } from 'class-variance-authority'
import type { badgeVariants } from '@/components/ui/badge'
import type { Agendamento } from '@/types'

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

export const STATUS_LABELS: Record<Agendamento['status'], string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

export const STATUS_BADGE_VARIANT: Record<Agendamento['status'], BadgeVariant> = {
  agendado: 'warning',
  confirmado: 'success',
  realizado: 'info',
  cancelado: 'danger',
}

export const FORMA_PAGAMENTO_LABELS: Record<NonNullable<Agendamento['forma_pagamento']>, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_debito: 'Cartão Débito',
  cartao_credito: 'Cartão Crédito',
  transferencia: 'Transferência',
}

export const STATUS_PAGAMENTO_LABELS: Record<Agendamento['status_pagamento'], string> = {
  pago: 'Pago',
  parcial: 'Pago parcial',
  pendente: 'Pagamento pendente',
}

export const STATUS_PAGAMENTO_BADGE_VARIANT: Record<Agendamento['status_pagamento'], BadgeVariant> = {
  pago: 'success',
  parcial: 'warning',
  pendente: 'danger',
}
