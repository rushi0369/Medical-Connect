import type { ReactNode } from 'react'

export interface DataTableColumn<Row> {
  key: string
  header: ReactNode
  render: (row: Row) => ReactNode
  align?: 'left' | 'right'
}

interface DataTableProps<Row> {
  caption: string
  columns: DataTableColumn<Row>[]
  rows: Row[]
  getRowKey: (row: Row) => string
}

/**
 * Shows a table when there is room, and stacked cards when there is not, so a page
 * never scrolls sideways. It measures its own width rather than the screen's,
 * because a sidebar can leave a large screen with little room for a table.
 */
export function DataTable<Row>({ caption, columns, rows, getRowKey }: DataTableProps<Row>) {
  return (
    <div className="@container">
      <div className="hidden @3xl:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border text-left">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-3 py-3 font-semibold whitespace-nowrap text-text-secondary ${column.align === 'right' ? 'text-right' : ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="h-14 border-b border-border last:border-b-0 hover:bg-background">
                {columns.map((column) => (
                  <td key={column.key} className={`px-3 py-2 align-middle ${column.align === 'right' ? 'text-right' : ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 @xl:grid-cols-2 @3xl:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={getRowKey(row)} className="rounded-control border border-border p-4">
            <dl className="space-y-2">
              {columns.map((column) => (
                <div key={column.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  {column.header && <dt className="text-xs font-medium text-text-secondary">{column.header}</dt>}
                  <dd className="min-w-0 text-sm">{column.render(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  )
}
