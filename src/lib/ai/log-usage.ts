import { SupabaseClient } from '@supabase/supabase-js'

export async function logAiUsage(
  supabase: SupabaseClient,
  params: {
    householdId: string
    userId: string
    model: string
    endpoint: string
    promptTokens: number
    completionTokens: number
    latencyMs?: number
  }
) {
  await supabase.from('ai_usage_log').insert({
    household_id: params.householdId,
    user_id: params.userId,
    model: params.model,
    endpoint: params.endpoint,
    prompt_tokens: params.promptTokens ?? 0,
    completion_tokens: params.completionTokens ?? 0,
    total_tokens: (params.promptTokens ?? 0) + (params.completionTokens ?? 0),
    latency_ms: params.latencyMs ?? null,
  })
}
