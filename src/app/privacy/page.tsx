import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | HouseholdOS',
  description: 'HouseholdOS Privacy Policy — POPIA compliant',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="mt-4 text-gray-600">
            HouseholdOS is committed to protecting your personal information in accordance with the{' '}
            <strong>Protection of Personal Information Act (POPIA), Act 4 of 2013</strong> (South Africa).
            This Privacy Notice explains what data we collect, why, and your rights.
          </p>
        </div>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Who We Are (Responsible Party)</h2>
          <p className="text-gray-600">
            HouseholdOS is the responsible party for personal information processed through this platform.
            For data-related enquiries, contact us at{' '}
            <a href="mailto:privacy@householdos.app" className="text-blue-600 hover:underline">
              privacy@householdos.app
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Personal Information We Collect</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li><strong>Identity data:</strong> Full name, email address, household name</li>
            <li><strong>Account data:</strong> Login credentials (password stored as a secure hash), authentication tokens</li>
            <li><strong>Household data:</strong> Documents, receipts, warranties, and financial records you upload</li>
            <li><strong>Financial data:</strong> Bank statement transactions, budget categories, spending summaries extracted from uploaded documents</li>
            <li><strong>Communication data:</strong> Emails received at your HouseholdOS inbox address</li>
            <li><strong>Usage data:</strong> Audit logs of actions performed in the system (e.g., file uploads, logins)</li>
            <li><strong>Device data:</strong> IP address, browser type (collected automatically via server logs)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Purpose of Processing</h2>
          <p className="text-gray-600 mb-2">We process your personal information for the following purposes:</p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Creating and managing your HouseholdOS account</li>
            <li>Providing household document management and organisation services</li>
            <li>Extracting and categorising financial data from uploaded statements to power budgeting features</li>
            <li>Delivering AI-assisted document search and Q&amp;A functionality</li>
            <li>Processing emails sent to your household inbox</li>
            <li>Security monitoring and audit trail maintenance</li>
            <li>Compliance with applicable laws and regulations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Legal Basis for Processing</h2>
          <p className="text-gray-600">
            We process your personal information on the basis of your explicit consent given at account registration,
            and where necessary for the performance of our service agreement with you. You may withdraw consent at
            any time by deleting your account, which will trigger erasure of your personal data (see Section 7).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Data Retention</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li><strong>Account data:</strong> Retained for the duration of your account and deleted within 30 days of account closure</li>
            <li><strong>Uploaded documents and receipts:</strong> Retained until you delete them or close your account</li>
            <li><strong>Audit logs:</strong> Retained for 12 months for security and compliance purposes</li>
            <li><strong>Email messages:</strong> Retained for 90 days unless manually deleted earlier</li>
            <li><strong>Backups:</strong> Purged within 90 days after the primary data is deleted</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Sharing of Personal Information</h2>
          <p className="text-gray-600 mb-2">
            We do not sell your personal information. We share it only with:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li><strong>Supabase Inc.</strong> — cloud database and storage infrastructure (data processed under a data processing agreement)</li>
            <li><strong>Anthropic / AI providers</strong> — document text may be sent for AI processing; no personal identifiers are intentionally included</li>
            <li><strong>Postmark</strong> — email delivery infrastructure</li>
            <li>Law enforcement or regulators where required by applicable law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Your Rights Under POPIA</h2>
          <p className="text-gray-600 mb-2">As a data subject, you have the right to:</p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>
              <strong>Access:</strong> Request a copy of the personal information we hold about you.
              Email <a href="mailto:privacy@householdos.app" className="text-blue-600 hover:underline">privacy@householdos.app</a>.
            </li>
            <li>
              <strong>Correction:</strong> Request correction of inaccurate or incomplete personal information.
            </li>
            <li>
              <strong>Erasure (Right to be Forgotten):</strong> Request deletion of your personal information.
              You may delete your account in Settings, which initiates erasure of all personal data.
            </li>
            <li>
              <strong>Objection:</strong> Object to the processing of your personal information in certain circumstances.
            </li>
            <li>
              <strong>Withdraw consent:</strong> Withdraw consent at any time without affecting the lawfulness of
              prior processing.
            </li>
            <li>
              <strong>Lodge a complaint:</strong> You may lodge a complaint with the{' '}
              <a
                href="https://inforegulator.org.za"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Information Regulator of South Africa
              </a>{' '}
              if you believe your rights have been infringed.
            </li>
          </ul>
          <p className="text-gray-600 mt-3">
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:privacy@householdos.app" className="text-blue-600 hover:underline">
              privacy@householdos.app
            </a>. We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Security</h2>
          <p className="text-gray-600">
            We implement appropriate technical and organisational measures to protect your personal information,
            including encryption at rest and in transit, access controls, and audit logging. However, no system
            is completely secure; please use a strong, unique password and keep your credentials safe.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Changes to This Policy</h2>
          <p className="text-gray-600">
            We may update this Privacy Policy from time to time. We will notify you of significant changes
            via email or an in-app notice. Continued use of HouseholdOS after notification constitutes
            acceptance of the updated policy.
          </p>
        </section>

        <div className="border-t pt-6">
          <Link href="/" className="text-blue-600 hover:underline text-sm">← Back to HouseholdOS</Link>
        </div>
      </div>
    </div>
  )
}
