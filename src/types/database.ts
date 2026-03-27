export interface Household {
  id: string
  name: string
  slug: string
  subscription_tier: 'essential' | 'household' | 'premium' | 'enterprise'
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  household_id: string
  email: string
  full_name: string
  role: 'primary' | 'secondary' | 'view_only' | 'admin'
  avatar_url: string | null
  created_at: string
}

export interface UserPreference {
  id: string
  user_id: string
  household_id: string
  key: string
  value: Record<string, unknown>
}

export interface Document {
  id: string
  household_id: string
  uploaded_by: string
  filename: string
  file_path: string
  file_size: number
  mime_type: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  ocr_text: string | null
  extracted_data: Record<string, unknown> | null
  embedding: number[] | null
  created_at: string
}

export interface DocumentQaSession {
  id: string
  document_id: string
  user_id: string
  household_id: string
  created_at: string
}

export interface DocumentQaMessage {
  id: string
  session_id: string
  household_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface InboxAddress {
  id: string
  household_id: string
  email_address: string
  label: string | null
  is_active: boolean
  created_at: string
}

export interface InboxMessage {
  id: string
  household_id: string
  inbox_address_id: string
  from_email: string
  subject: string | null
  body: string | null
  raw_payload: Record<string, unknown> | null
  status: 'received' | 'processing' | 'parsed' | 'error'
  parsed_data: Record<string, unknown> | null
  received_at: string
  created_at: string
}

export interface InboxAttachment {
  id: string
  message_id: string
  household_id: string
  filename: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

export interface Receipt {
  id: string
  household_id: string
  uploaded_by: string
  image_path: string
  ocr_text: string | null
  retailer: string | null
  purchase_date: string | null
  total_amount: number | null
  currency: string
  items: Record<string, unknown>[] | null
  status: 'uploading' | 'processing' | 'ready' | 'error'
  created_at: string
}

export interface Warranty {
  id: string
  receipt_id: string
  household_id: string
  product_name: string
  warranty_months: number
  expiry_date: string
  alert_sent: boolean
  created_at: string
}

export interface BudgetTransaction {
  id: string
  household_id: string
  source: 'manual' | 'statement' | 'bank_api'
  description: string
  amount: number
  category: string | null
  transaction_date: string
  is_income: boolean
  statement_ref: string | null
  created_at: string
}

export interface BudgetCategory {
  id: string
  household_id: string
  name: string
  icon: string | null
  is_income: boolean
  created_at: string
}

export interface BudgetSummary {
  id: string
  household_id: string
  month: string
  total_income: number
  total_expenses: number
  by_category: Record<string, number> | null
  created_at: string
}

export interface HitlAction {
  id: string
  household_id: string
  user_id: string
  action_type: string
  module: string
  title: string
  description: string | null
  proposed_action: Record<string, unknown> | null
  status: 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed'
  approved_at: string | null
  executed_at: string | null
  result: Record<string, unknown> | null
  created_at: string
}

export interface Notification {
  id: string
  household_id: string
  user_id: string
  type: string
  title: string
  body: string | null
  module: string | null
  reference_id: string | null
  is_read: boolean
  created_at: string
}

export interface AiUsageLog {
  id: string
  household_id: string
  user_id: string
  model: string
  endpoint: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  latency_ms: number | null
  created_at: string
}

export interface AuditLog {
  id: string
  household_id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface Subscription {
  id: string
  household_id: string
  stripe_subscription_id: string | null
  tier: 'essential' | 'household' | 'premium' | 'enterprise'
  status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
}
