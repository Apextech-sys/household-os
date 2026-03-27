import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-blue-600">HouseholdOS</h1>
        <div className="flex gap-3">
          <Link
            href="/auth/login"
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-6">
          Your household, intelligently managed
        </h2>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Upload documents, scan receipts, track warranties, manage your budget — all powered by AI
          that understands your household.
        </p>
        <Link
          href="/auth/signup"
          className="inline-block px-8 py-3 text-lg font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Start for free
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 text-left">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2">Document Intelligence</h3>
            <p className="text-sm text-gray-600">
              Upload contracts, policies, and municipal bills. AI extracts key data and answers your questions.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2">Receipt & Warranty Vault</h3>
            <p className="text-sm text-gray-600">
              Snap a photo of any receipt. We track warranties and alert you before they expire.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2">Smart Budget</h3>
            <p className="text-sm text-gray-600">
              Auto-import bank statements, categorise spending, and see where your money goes each month.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
