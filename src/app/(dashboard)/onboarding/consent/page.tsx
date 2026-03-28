'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PopiaConsentPage() {
  const router = useRouter()
  const [consent, setConsent] = useState({
    data_collection: false,
    ai_processing: false,
    third_party: false,
    marketing: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requiredConsents = consent.data_collection && consent.ai_processing && consent.third_party

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!requiredConsents) return

    setSubmitting(true)
    setError(null)

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated')
      setSubmitting(false)
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      setError('No household found')
      setSubmitting(false)
      return
    }

    const consentValue = {
      ...consent,
      consented_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: user.id,
          household_id: profile.household_id,
          key: 'popia_consent',
          value: consentValue,
        },
        { onConflict: 'user_id,key' }
      )

    if (upsertError) {
      setError('Failed to save consent. Please try again.')
      setSubmitting(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">POPIA Consent</h1>
        <p className="text-gray-600 mb-6">
          In accordance with the Protection of Personal Information Act (POPIA), we need your consent
          before processing your data. Please review and accept the following:
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent.data_collection}
              onChange={(e) => setConsent({ ...consent, data_collection: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <div>
              <span className="font-medium text-gray-900">Data Collection</span>
              <span className="ml-1 text-red-500 text-sm">*</span>
              <p className="text-sm text-gray-500">
                I consent to the collection and storage of my household documents, receipts, financial
                data, and related information for the purpose of household management.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent.ai_processing}
              onChange={(e) => setConsent({ ...consent, ai_processing: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <div>
              <span className="font-medium text-gray-900">AI Processing</span>
              <span className="ml-1 text-red-500 text-sm">*</span>
              <p className="text-sm text-gray-500">
                I consent to the use of artificial intelligence to process, analyse, and extract
                information from my uploaded documents and financial data.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent.third_party}
              onChange={(e) => setConsent({ ...consent, third_party: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <div>
              <span className="font-medium text-gray-900">Third-Party Sharing</span>
              <span className="ml-1 text-red-500 text-sm">*</span>
              <p className="text-sm text-gray-500">
                I consent to sharing necessary data with third-party service providers (bank APIs for
                transaction imports, email providers for inbox features) as required for platform
                functionality.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent.marketing}
              onChange={(e) => setConsent({ ...consent, marketing: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <div>
              <span className="font-medium text-gray-900">Marketing Communications</span>
              <span className="ml-1 text-xs text-gray-400">(optional)</span>
              <p className="text-sm text-gray-500">
                I consent to receiving marketing communications about new features, tips, and offers
                from HouseholdOS.
              </p>
            </div>
          </label>

          <p className="text-xs text-gray-400">
            <span className="text-red-500">*</span> Required fields. You can withdraw your consent at
            any time from your account settings.
          </p>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={!requiredConsents || submitting}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Saving...' : 'Accept & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
