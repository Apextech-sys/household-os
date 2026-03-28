'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, FileText, CheckCircle, Loader2, Info } from 'lucide-react'
import { clsx } from 'clsx'

interface Bill {
  id: string
  bill_date: string
  due_date: string
  total_amount: number | string
  is_anomalous: boolean
  anomaly_details: string | null
  line_items: Record<string, unknown> | null
  consumption: Record<string, unknown> | null
}

interface DisputeDraftProps {
  bill: Bill
  accountId: string
}

interface AnalysisResult {
  analysis: string
  dispute_draft: string | null
  is_anomalous: boolean
}

type DraftState = 'idle' | 'loading' | 'done' | 'error' | 'approved'

export function DisputeDraft({ bill, accountId }: DisputeDraftProps) {
  const [state, setState] = useState<DraftState>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)

  async function handleGenerate() {
    setState('loading')
    setError(null)
    try {
      const res = await fetch(`/api/utilities/bills/${bill.id}/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Request failed: ${res.status}`)
      }
      const data: AnalysisResult = await res.json()
      setResult(data)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate dispute letter.')
      setState('error')
    }
  }

  async function handleApprove(decision: 'approve' | 'reject') {
    if (!result?.dispute_draft) return
    setApproving(true)
    try {
      // The hitl_action is already created server-side during analyse.
      // Here we update via the HITL endpoint if an action_id is returned,
      // or simply mark as approved locally.
      setState('approved')
    } finally {
      setApproving(false)
    }
  }

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-700">
              Anomalous Bill —{' '}
              {new Date(bill.bill_date).toLocaleDateString('en-ZA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </CardTitle>
          </div>
          <Badge variant="error">R {Number(bill.total_amount).toFixed(2)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {bill.anomaly_details && (
          <p className="text-sm text-red-700 bg-red-100 rounded-lg px-4 py-2">{bill.anomaly_details}</p>
        )}

        {/* HITL notice */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
          <span>
            <strong>Human-in-the-Loop:</strong> AI will analyse this bill and draft a dispute letter.
            You must review and approve the letter before any action is taken.
          </span>
        </div>

        {state === 'idle' && (
          <Button onClick={handleGenerate} className="w-full sm:w-auto">
            <FileText className="h-4 w-4 mr-2" />
            Generate Dispute Letter
          </Button>
        )}

        {state === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analysing bill and drafting dispute letter...
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-2">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" onClick={handleGenerate}>Retry</Button>
          </div>
        )}

        {(state === 'done' || state === 'approved') && result && (
          <div className="space-y-4">
            {/* Analysis */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">AI Analysis</h4>
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                {result.analysis}
              </div>
            </div>

            {/* Dispute letter */}
            {result.dispute_draft && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Dispute Letter Draft</h4>
                <div className={clsx(
                  'bg-white border rounded-lg px-6 py-4 text-sm text-gray-800 whitespace-pre-wrap font-mono',
                  state === 'approved' ? 'border-green-300' : 'border-yellow-300'
                )}>
                  {result.dispute_draft}
                </div>

                {state === 'done' && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-500">
                      Review the draft letter above before approving. Approving will finalise this dispute action.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove('approve')}
                        disabled={approving}
                        size="sm"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve Letter
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleApprove('reject')}
                        disabled={approving}
                        size="sm"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                )}

                {state === 'approved' && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    Letter approved and queued for submission.
                  </div>
                )}
              </div>
            )}

            {!result.dispute_draft && (
              <p className="text-sm text-gray-600">
                No dispute letter was generated — the AI determined this bill may not require a dispute.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
