import {
  AlertTriangle,
  Bike,
  KeyRound,
  Pencil,
  Plus,
  Power,
  PowerOff,
  SearchX,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { DangerButton, IconButton, SecondaryButton } from '../../components/ui/Button'
import { primaryButtonClasses } from '../../components/ui/buttonStyles'
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { FormSelect } from '../../components/ui/FormSelect'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { SearchBar } from '../../components/ui/SearchBar'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useToast } from '../../hooks/useToast'
import {
  bulkDeleteRiders,
  deleteRider,
  fetchRiders,
  resetRiderCredentials,
  setRiderActive,
  type RiderStatusFilter,
} from '../../services/rider.service'
import type { Rider, RiderListItem } from '../../types/user'
import { getErrorMessage } from '../../utils/apiError'
import { TemporaryPasswordDialog } from './TemporaryPasswordDialog'

const PAGE_SIZE = 10

type PendingAction = { type: 'status' | 'reset'; rider: RiderListItem }

export default function RidersPage() {
  const showToast = useToast()
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [status, setStatus] = useState<RiderStatusFilter>('all')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [newCredentials, setNewCredentials] = useState<{ rider: Rider; temporaryPassword: string } | null>(null)

  // Selection & Deletion State
  const [selectedRiderIds, setSelectedRiderIds] = useState<string[]>([])
  const [riderToDelete, setRiderToDelete] = useState<RiderListItem | null>(null)
  const [isDeletingSingle, setIsDeletingSingle] = useState(false)
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)

  const search = useDebouncedValue(searchText.trim())
  const [appliedSearch, setAppliedSearch] = useState(search)

  if (search !== appliedSearch) {
    setAppliedSearch(search)
    setPage(1)
  }

  const { data, error, isLoading, reload } = useAsyncData(
    (signal) => fetchRiders({ page, pageSize: PAGE_SIZE, search, status }, signal),
    [page, search, status],
  )

  const ridersList = data?.riders ?? []
  const allCurrentIds = ridersList.map((r) => r.id)
  const isAllRidersSelected = allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedRiderIds.includes(id))

  function toggleSelectAllRiders() {
    if (isAllRidersSelected) {
      setSelectedRiderIds(selectedRiderIds.filter((id) => !allCurrentIds.includes(id)))
    } else {
      setSelectedRiderIds(Array.from(new Set([...selectedRiderIds, ...allCurrentIds])))
    }
  }

  function toggleSelectOneRider(id: string) {
    if (selectedRiderIds.includes(id)) {
      setSelectedRiderIds(selectedRiderIds.filter((item) => item !== id))
    } else {
      setSelectedRiderIds([...selectedRiderIds, id])
    }
  }

  async function confirmPendingAction() {
    if (!pending) return

    setIsWorking(true)
    try {
      if (pending.type === 'status') {
        const result = await setRiderActive(pending.rider.id, !pending.rider.isActive)
        showToast(result.message)
      } else {
        setNewCredentials(await resetRiderCredentials(pending.rider.id))
      }
      setPending(null)
      reload()
    } catch (actionError) {
      showToast(getErrorMessage(actionError), 'error')
    } finally {
      setIsWorking(false)
    }
  }

  async function handleConfirmDeleteSingle() {
    if (!riderToDelete) return
    setIsDeletingSingle(true)
    try {
      await deleteRider(riderToDelete.id)
      showToast(`Rider "${riderToDelete.fullName}" deleted permanently from database.`, 'success')
      setSelectedRiderIds(selectedRiderIds.filter((id) => id !== riderToDelete.id))
      setRiderToDelete(null)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete rider.'), 'error')
    } finally {
      setIsDeletingSingle(false)
    }
  }

  async function handleConfirmDeleteBulk() {
    if (selectedRiderIds.length === 0) return
    setIsDeletingBulk(true)
    try {
      await bulkDeleteRiders(selectedRiderIds)
      showToast(`Deleted ${selectedRiderIds.length} rider(s) permanently from database.`, 'success')
      setSelectedRiderIds([])
      setIsBulkDeleteModalOpen(false)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete riders.'), 'error')
    } finally {
      setIsDeletingBulk(false)
    }
  }

  const columns: DataTableColumn<RiderListItem>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={isAllRidersSelected}
          onChange={toggleSelectAllRiders}
          className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
          title="Select all on this page"
        />
      ),
      render: (rider) => (
        <input
          type="checkbox"
          checked={selectedRiderIds.includes(rider.id)}
          onChange={() => toggleSelectOneRider(rider.id)}
          className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
        />
      ),
    },
    {
      key: 'rider',
      header: 'Rider',
      render: (rider) => (
        <div>
          <p className="font-semibold text-text">{rider.fullName}</p>
          <p className="text-xs text-text-secondary">{rider.riderProfile.riderId}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (rider) => (
        <div>
          <p className="text-text">{rider.phone}</p>
          {rider.email && <p className="text-xs break-all text-text-secondary">{rider.email}</p>}
        </div>
      ),
    },
    { key: 'vehicle', header: 'Vehicle', render: (rider) => rider.riderProfile.vehicleNumber ?? 'Not added' },
    { key: 'assigned', header: 'Assigned', align: 'right', render: (rider) => rider.deliveryStats.assigned },
    { key: 'completed', header: 'Completed', align: 'right', render: (rider) => rider.deliveryStats.completed },
    {
      key: 'status',
      header: 'Status',
      render: (rider) => (
        <StatusBadge tone={rider.isActive ? 'success' : 'neutral'}>{rider.isActive ? 'Active' : 'Inactive'}</StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (rider) => (
        <div className="flex justify-end gap-1">
          <IconButton
            icon={Pencil}
            label={`Edit ${rider.fullName}`}
            onClick={() => navigate(`/admin/riders/${rider.id}/edit`)}
          />
          <IconButton
            icon={KeyRound}
            label={`Reset password for ${rider.fullName}`}
            onClick={() => setPending({ type: 'reset', rider })}
          />
          <IconButton
            icon={rider.isActive ? PowerOff : Power}
            label={`${rider.isActive ? 'Deactivate' : 'Activate'} ${rider.fullName}`}
            tone={rider.isActive ? 'danger' : 'default'}
            onClick={() => setPending({ type: 'status', rider })}
          />
          <IconButton
            icon={Trash2}
            label={`Delete ${rider.fullName}`}
            tone="danger"
            onClick={() => setRiderToDelete(rider)}
          />
        </div>
      ),
    },
  ]

  const isFiltered = search !== '' || status !== 'all'
  const isDeactivating = pending?.type === 'status' && pending.rider.isActive

  return (
    <>
      <PageHeader
        title="Rider Management"
        description="Create rider logins, edit details, and manage delivery accounts."
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Rider Management' }]}
        actions={
          <Link to="/admin/riders/new" className={primaryButtonClasses}>
            <Plus className="size-4" aria-hidden="true" />
            Add rider
          </Link>
        }
      />

      <DashboardCard>
        <div className="mb-4 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <SearchBar
            value={searchText}
            onChange={setSearchText}
            label="Search riders"
            placeholder="Search by name, mobile, email or rider ID"
          />
          <FormSelect
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as RiderStatusFilter)
              setPage(1)
            }}
          >
            <option value="all">All riders</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FormSelect>
        </div>

        {/* Select All and Bulk Actions Toolbar */}
        {ridersList.length > 0 && selectedRiderIds.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-surface px-4 py-2.5 shadow-xs">
            <span className="text-xs font-medium text-text-secondary">
              <strong className="text-text">{selectedRiderIds.length}</strong> rider(s) selected
            </span>
            <DangerButton
              icon={Trash2}
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="text-xs py-1.5 px-3"
            >
              Delete Selected ({selectedRiderIds.length})
            </DangerButton>
          </div>
        )}

        {error ? (
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        ) : isLoading && !data ? (
          <LoadingState label="Loading riders..." />
        ) : data?.riders.length === 0 ? (
          isFiltered ? (
            <EmptyState icon={SearchX} title="No riders match" message="Try a different search or status." />
          ) : (
            <EmptyState
              icon={Bike}
              title="No riders yet"
              message="Add your first rider to create their login."
              action={
                <Link to="/admin/riders/new" className={primaryButtonClasses}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add rider
                </Link>
              }
            />
          )
        ) : (
          data && (
            <>
              <DataTable caption="Riders" columns={columns} rows={data.riders} getRowKey={(rider) => rider.id} />
              <Pagination
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                totalItems={data.meta.totalItems}
                onPageChange={setPage}
              />
            </>
          )
        )}
      </DashboardCard>

      {/* Delete Single Rider Modal */}
      <Modal
        isOpen={Boolean(riderToDelete)}
        onClose={() => setRiderToDelete(null)}
        title="Delete Delivery Rider"
        footer={
          <div className="flex items-center justify-end gap-3">
            <SecondaryButton onClick={() => setRiderToDelete(null)}>Cancel</SecondaryButton>
            <DangerButton onClick={handleConfirmDeleteSingle} isLoading={isDeletingSingle}>
              Delete Permanently
            </DangerButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle p-3 text-xs text-danger">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Permanently delete rider "{riderToDelete?.fullName}"?</p>
              <p className="mt-1 text-danger/90">
                This will delete the rider account ({riderToDelete?.riderProfile.riderId}) from MongoDB Atlas and log them out immediately.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Riders Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title="Delete Selected Riders"
        footer={
          <div className="flex items-center justify-end gap-3">
            <SecondaryButton onClick={() => setIsBulkDeleteModalOpen(false)}>Cancel</SecondaryButton>
            <DangerButton onClick={handleConfirmDeleteBulk} isLoading={isDeletingBulk}>
              Yes, Delete {selectedRiderIds.length} Riders
            </DangerButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle p-3 text-xs text-danger">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Permanently delete {selectedRiderIds.length} selected rider(s)?</p>
              <p className="mt-1 text-danger/90">
                This will delete the selected rider accounts from MongoDB Atlas and disconnect their sessions.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmationDialog
        isOpen={pending?.type === 'status'}
        title={isDeactivating ? 'Deactivate this rider?' : 'Activate this rider?'}
        confirmLabel={isDeactivating ? 'Deactivate rider' : 'Activate rider'}
        isDestructive={isDeactivating}
        isLoading={isWorking}
        onConfirm={confirmPendingAction}
        onCancel={() => setPending(null)}
      >
        {isDeactivating
          ? `${pending?.rider.fullName} will be logged out immediately and will not be able to log in. Their delivery history stays safe.`
          : `${pending?.rider.fullName} will be able to log in again.`}
      </ConfirmationDialog>

      <ConfirmationDialog
        isOpen={pending?.type === 'reset'}
        title="Reset this rider's password?"
        confirmLabel="Reset password"
        isDestructive
        isLoading={isWorking}
        onConfirm={confirmPendingAction}
        onCancel={() => setPending(null)}
      >
        {pending?.rider.fullName} will be logged out and their current password will stop working. You will get a new
        temporary password to give them.
      </ConfirmationDialog>

      <TemporaryPasswordDialog
        title="New temporary password"
        rider={newCredentials?.rider ?? null}
        temporaryPassword={newCredentials?.temporaryPassword ?? null}
        onClose={() => setNewCredentials(null)}
      />
    </>
  )
}
