'use client'
import { QRCodeSVG } from 'qrcode.react'

interface QRCodeDisplayProps {
  value: string
  size?: number
}

export function QRCodeDisplay({ value, size = 160 }: QRCodeDisplayProps) {
  return (
    <div data-testid="img-qrcode-session" className="rounded-lg bg-white p-2 shadow-sm">
      <QRCodeSVG value={value} size={size} />
    </div>
  )
}
