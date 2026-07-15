import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { parseBody } from '../../utils/validation'
import { estimateConsequenceSchema } from '../../consequences/schemas'
import { getConsequenceProvider } from '../../consequences/registry'
import { validateUserConsequenceInput } from '../../utils/consequences-service'
import { isMonetaryProvider, type ConsequenceProviderKey } from '../../consequences/types'
import {
  enrichMonetaryEstimate,
  getUserPaymentMethodSummary,
} from '../../utils/user-payment-method'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const body = await readBody(event)
  const data = parseBody(estimateConsequenceSchema, body)

  const type = data.type as ConsequenceProviderKey
  const config = await validateUserConsequenceInput(type, data.amount, data.config)

  const provider = getConsequenceProvider(type)
  let estimate = await provider.estimate(config, data.amount)

  if (isMonetaryProvider(type)) {
    const paymentMethod = await getUserPaymentMethodSummary(user.id)
    if (paymentMethod) {
      estimate = enrichMonetaryEstimate(estimate, paymentMethod)
    }
  }

  return { estimate }
})
