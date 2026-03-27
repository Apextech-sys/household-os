'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function ReceiptUpload() {
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/receipts', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Upload failed')

        const { id } = await res.json()
        await fetch(`/api/receipts/${id}/process`, { method: 'POST' })
      }
      router.refresh()
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }, [router])

  return (
    <div className="flex gap-3">
      <Button
        variant="outline"
        disabled={uploading}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.multiple = true
          input.accept = 'image/*,.pdf'
          input.onchange = () => handleUpload(input.files)
          input.click()
        }}
      >
        <Upload className="h-4 w-4 mr-2" />
        {uploading ? 'Uploading...' : 'Upload receipt'}
      </Button>
      <Button
        variant="outline"
        disabled={uploading}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.capture = 'environment'
          input.onchange = () => handleUpload(input.files)
          input.click()
        }}
      >
        <Camera className="h-4 w-4 mr-2" />
        Take photo
      </Button>
    </div>
  )
}
