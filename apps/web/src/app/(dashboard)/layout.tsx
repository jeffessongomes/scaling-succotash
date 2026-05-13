import { DashboardLayout } from '@/components/shared/DashboardLayout'
import type { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  return <DashboardLayout>{children}</DashboardLayout>
}
