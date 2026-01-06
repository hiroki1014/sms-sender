import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SMS一括送信',
  description: 'SMS一括送信アプリケーション',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  )
}
