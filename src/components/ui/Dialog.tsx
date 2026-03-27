'use client'

import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (open) {
      ref.current?.showModal()
    } else {
      ref.current?.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={clsx(
        'rounded-xl p-0 backdrop:bg-black/50 open:animate-in open:fade-in',
        className
      )}
    >
      <div className="p-6">{children}</div>
    </dialog>
  )
}
