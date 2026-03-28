export async function logAudit(
  supabase: any,
  {
    household_id,
    user_id,
    action,
    entity_type,
    entity_id,
    details,
    ip_address,
  }: {
    household_id: string
    user_id: string | null
    action: string
    entity_type: string
    entity_id?: string | null
    details?: Record<string, unknown> | null
    ip_address?: string | null
  }
) {
  const { error } = await supabase.from('audit_logs').insert({
    household_id,
    user_id,
    action,
    entity_type,
    entity_id: entity_id ?? null,
    details: details ?? null,
    ip_address: ip_address ?? null,
  })

  if (error) {
    console.error('[Audit] Failed to write audit log:', error)
  }
}
