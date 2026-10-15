import { Check } from 'lucide-react'
import { PLANS, TRIAL_CARD, TRIAL_DAYS } from '../../lib/constants'
import { cn, formatPrice } from '../../lib/utils'
import Button from '../ui/Button'

/**
 * Free trial + plan cards shared by the landing page and the subscription page.
 * `renderAction(card)` lets each page decide what the button does; `card.id` is
 * 'trial', 'starter' or 'pro'.
 */
export default function PricingCards({ renderAction, currentPlanId }) {
  const cards = [TRIAL_CARD, ...PLANS]
  return (
    <div className="mx-auto grid max-w-5xl gap-5 pt-3 md:grid-cols-3">
      {cards.map((card) => {
        const isTrial = card.id === TRIAL_CARD.id
        const isCurrent = card.id === currentPlanId
        return (
          <div
            key={card.id}
            className={cn(
              'relative flex flex-col rounded-2xl border bg-white p-6 transition duration-200 sm:p-7',
              card.popular
                ? 'border-primary-500 shadow-[0_24px_60px_-28px_rgb(5_128_95/0.55)] ring-1 ring-primary-500/40'
                : 'border-line shadow-soft hover:shadow-lift',
            )}
          >
            {card.popular && (
              <span className="absolute -top-3 right-5 rounded-full bg-primary-600 px-3 py-1 text-xs font-bold text-white shadow-glow">Most Popular</span>
            )}
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-primary-700">{isTrial ? card.name : `${card.name}${card.id === 'pro' ? ' Plan' : ''}`}</h3>
              {isCurrent && (
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary-700 ring-1 ring-primary-200 ring-inset">Current</span>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold tracking-tight text-ink">{isTrial ? `${TRIAL_DAYS} Days` : formatPrice(card.price)}</span>
              {!isTrial && <span className="text-sm font-semibold text-primary-600">/mo</span>}
            </div>
            <p className="mt-1 text-xs text-ink-muted">{isTrial ? 'Free, then pick a plan' : 'Billed monthly · cancel anytime'}</p>
            <ul className="mt-6 flex-1 space-y-3">
              {card.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-soft">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary-600" strokeWidth={2.5} aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-7 border-t border-line pt-6">{renderAction(card)}</div>
          </div>
        )
      })}
    </div>
  )
}

export function PlanCTA({ plan }) {
  if (plan.id === TRIAL_CARD.id) {
    return (
      <Button to="/register" variant="outline-primary" className="w-full rounded-full">
        Get Started
      </Button>
    )
  }
  return (
    <Button to={`/register?plan=${plan.id}`} className="w-full rounded-full">
      Choose Plan
    </Button>
  )
}
