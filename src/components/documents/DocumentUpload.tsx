'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function DocumentUpload() {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/documents', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Upload failed')

        const { id } = await res.json()

        // Trigger processing
        await fetch(`/api/documents/${id}/process`, { method: 'POST' })
      }
      router.refresh()
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }, [router])

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => { e.preventDefault(); setDragActive(false); handleUpload(e.dataTransfer.files) }}
    >
      <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
      <p className="text-sm text-gray-600 mb-3">
        Drag and drop files here, or click to select
      </p>
      <Button
        variant="outline"
        disabled={uploading}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.multiple = true
          input.accept = '.pdf,.png,.jpg,.jpeg'
          input.onchange = () => handleUpload(input.files)
          input.click()
        }}
      >
        {uploading ? 'Uploading...' : 'Select files'}
      </Button>
    </div>
  )
}
