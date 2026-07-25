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
