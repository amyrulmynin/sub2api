import { formatPaymentAmount } from '@/components/payment/currency'

interface BatchImageCost {
  status: string
  hold_amount: number
  actual_cost: number | null
  currency: string
}

export function batchImageCostLabel(job: BatchImageCost): string {
  if (job.actual_cost !== null) return formatPaymentAmount(job.actual_cost, job.currency)
  if (job.status === 'failed' || job.status === 'cancelled') return formatPaymentAmount(0, job.currency)
  return `冻结 ${formatPaymentAmount(job.hold_amount, job.currency)}`
}
