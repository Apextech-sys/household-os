'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Info } from 'lucide-react'
import { clsx } from 'clsx'

const CLAIM_TYPES = [
  'Accidental damage',
  'Theft',
  'Fire',
  'Flood / water damage',
  'Vehicle accident',
  'Medical expense',
  'Death benefit',
  'Disability',
  'Legal liability',
  'Other',
]

interface ClaimWizardProps {
  policyId: string
  householdId: string
}

type Step = 1 | 2 | 3

interface FormData {
  claimType: string
  description: string
  amountClaimed: string
  supportingInfo: string
}

export function ClaimWizard({ policyId, householdId }: ClaimWizardProps) {
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormData>({
    claimType: '',
    description: '',
    amountClaimed: '',
    supportingInfo: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateForm(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  function validateStep1() {
    if (!form.claimType) return 'Please select a claim type.'
    if (!form.description.trim() || form.description.trim().length < 10)
      return 'Please provide a description of at least 10 characters.'
    return null
  }

  function validateStep2() {
    const amount = parseFloat(form.amountClaimed)
    if (!form.amountClaimed || isNaN(amount) || amount <= 0)
      return 'Please enter a valid claim amount greater than zero.'
    return null
  }

  function handleNext() {
    const err = step === 1 ? validateStep1() : step === 2 ? validateStep2() : null
    if (err) {
      setError(err)
      return
    }
    setStep(prev => (prev + 1) as Step)
  }

  function handleBack() {
    setError(null)
    setStep(prev => (prev - 1) as Step)
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/insurance/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_id: policyId,
          household_id: householdId,
          claim_type: form.claimType,
          description: [form.description, form.supportingInfo].filter(Boolean).join('\n\nAdditional info: '),
          amount_claimed: parseFloat(form.amountClaimed),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Failed to submit claim.')
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">Claim submitted for review</p>
          <p className="text-sm text-gray-500 mt-1">
            Your claim has been saved as a draft and is pending human review before formal submission.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSubmitted(false)
            setStep(1)
            setForm({ claimType: '', description: '', amountClaimed: '', supportingInfo: '' })
          }}
        >
          Submit another claim
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as Step[]).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={clsx(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold',
                step === s
                  ? 'bg-blue-600 text-white'
                  : step > s
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
              )}
            >
              {step > s ? '✓' : s}
            </div>
            <span
              className={clsx(
                'text-xs hidden sm:inline',
                step === s ? 'text-blue-700 font-medium' : 'text-gray-400'
              )}
            >
              {s === 1 ? 'Claim details' : s === 2 ? 'Amount & info' : 'Review & submit'}
            </span>
            {s < 3 && <ChevronRight className="h-4 w-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* HITL notice */}
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
        <p>
          All claims are reviewed by a household administrator before being formally submitted to your insurer.
          You will be notified once the review is complete.
        </p>
      </div>

      {/* Step 1: Claim type + description */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Claim type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CLAIM_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateForm('claimType', type)}
                  className={clsx(
                    'rounded-lg border px-3 py-2 text-sm text-left transition-colors',
                    form.claimType === type
                      ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(required)</span>
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={e => updateForm('description', e.target.value)}
              placeholder="Describe what happened, when it occurred, and the circumstances…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      )}

      {/* Step 2: Amount + supporting info */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount claimed (ZAR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amountClaimed}
                onChange={e => updateForm('amountClaimed', e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supporting information <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={form.supportingInfo}
              onChange={e => updateForm('supportingInfo', e.target.value)}
              placeholder="List any supporting documents, reference numbers, or additional context…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      )}

      {/* Step 3: Review + submit */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Please review your claim before submitting.</p>
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-gray-500">Claim type</span>
              <span className="font-medium text-gray-900">{form.claimType}</span>
            </div>
            <div className="px-4 py-3 text-sm">
              <span className="text-gray-500 block mb-1">Description</span>
              <p className="text-gray-900 whitespace-pre-wrap">{form.description}</p>
            </div>
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-gray-500">Amount claimed</span>
              <span className="font-medium text-gray-900">
                {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(
                  parseFloat(form.amountClaimed) || 0
                )}
              </span>
            </div>
            {form.supportingInfo && (
              <div className="px-4 py-3 text-sm">
                <span className="text-gray-500 block mb-1">Supporting info</span>
                <p className="text-gray-900 whitespace-pre-wrap">{form.supportingInfo}</p>
              </div>
            )}
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-gray-500">Status after submit</span>
              <Badge variant="secondary">Draft — pending review</Badge>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        {step > 1 ? (
          <Button variant="outline" size="sm" onClick={handleBack} disabled={isSubmitting}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <Button size="sm" onClick={handleNext}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit claim'}
          </Button>
        )}
      </div>
    </div>
  )
}
