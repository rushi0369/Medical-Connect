import { useState } from 'react'
import { NotificationPanel } from '../../components/common/NotificationPanel'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { useNotifications } from '../../hooks/useNotifications'

const PAGE_SIZE = 20

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const notifications = useNotifications({ page, pageSize: PAGE_SIZE })

  return (
    <>
      <PageHeader title="Notifications" description="Updates about your account and orders." />
      <DashboardCard>
        <NotificationPanel {...notifications} />
        {notifications.meta && (
          <Pagination
            page={notifications.meta.page}
            totalPages={notifications.meta.totalPages}
            totalItems={notifications.meta.totalItems}
            onPageChange={setPage}
          />
        )}
      </DashboardCard>
    </>
  )
}
