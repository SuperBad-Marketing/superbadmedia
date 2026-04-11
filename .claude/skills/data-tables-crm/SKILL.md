---
name: data-tables-crm
description: Patterns for building CRM data tables and complex UI components — TanStack Table v8, sortable columns, filters, pagination, row selection, inline editing, kanban boards, and status pipelines. Covers both the component logic and the superbad-hq visual style.
---

# Data Tables & CRM Components — SuperBad HQ Reference

CRMs live and die by their data tables. This skill covers the patterns for building performant, feature-rich tabular interfaces that match superbad-hq's dark design system.

**Primary library:** TanStack Table v8 (headless — we own all the markup and styles)

---

## 1. Core TanStack Table Setup

### Install check
```bash
# Check package.json first — never assume it's installed
# If missing: npm install @tanstack/react-table
```

### Basic column + table definition
```tsx
'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useState } from 'react'

type Client = {
  id: string
  name: string
  tier: 'retainer' | 'flagship' | 'trial'
  revenue: number
  status: 'active' | 'paused' | 'churned'
  lastContact: string
}

const columns: ColumnDef<Client>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <input
        type="checkbox"
        aria-label="Select all rows"
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => {
          if (el) el.indeterminate = table.getIsSomePageRowsSelected()
        }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label={`Select ${row.original.name}`}
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
    size: 40,
    enableSorting: false,
  },
  {
    accessorKey: 'name',
    header: 'Business',
    cell: ({ row }) => (
      <a href={`/clients/${row.original.id}`} className="font-medium text-sb-cream hover:text-sb-accent transition-colors">
        {row.original.name}
      </a>
    ),
  },
  {
    accessorKey: 'tier',
    header: 'Tier',
    cell: ({ getValue }) => <TierBadge tier={getValue<Client['tier']>()} />,
    filterFn: 'equals',
  },
  {
    accessorKey: 'revenue',
    header: 'Revenue',
    cell: ({ getValue }) => formatCurrency(getValue<number>()),
    meta: { align: 'right' },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={getValue<Client['status']>()} />,
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions client={row.original} />,
    enableSorting: false,
  },
]
```

---

## 2. Full Table Component with Sort, Filter, Pagination

```tsx
export function ClientTable({ data }: { data: Client[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState({})
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  const selectedCount = Object.keys(rowSelection).length

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <TableToolbar
        table={table}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        selectedCount={selectedCount}
      />

      {/* Table */}
      <div className="rounded-lg border border-sb-cream/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Clients">
            <caption className="sr-only">
              {`${table.getFilteredRowModel().rows.length} clients`}
            </caption>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="border-b border-sb-cream/10 bg-sb-card">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      scope="col"
                      className={`px-4 py-3 text-left text-xs font-medium text-sb-cream/50 uppercase tracking-wider ${
                        header.column.getCanSort() ? 'cursor-pointer select-none hover:text-sb-cream' : ''
                      }`}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                      aria-sort={
                        header.column.getIsSorted() === 'asc' ? 'ascending' :
                        header.column.getIsSorted() === 'desc' ? 'descending' :
                        header.column.getCanSort() ? 'none' : undefined
                      }
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <SortIndicator sorted={header.column.getIsSorted()} />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-16 text-center">
                    <EmptyState filter={globalFilter} />
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className={`border-b border-sb-cream/5 transition-colors hover:bg-sb-card/50 ${
                      row.getIsSelected() ? 'bg-sb-accent/5' : ''
                    }`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className={`px-4 py-3 text-sb-cream/80 ${
                          (cell.column.columnDef.meta as any)?.align === 'right' ? 'text-right font-mono' : ''
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <TablePagination table={table} />
    </div>
  )
}
```

---

## 3. Toolbar with Search + Filters

```tsx
function TableToolbar({ table, globalFilter, onGlobalFilterChange, selectedCount }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 flex-1">
        {/* Global search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sb-cream/30 w-4 h-4" aria-hidden="true" />
          <input
            type="search"
            value={globalFilter}
            onChange={e => onGlobalFilterChange(e.target.value)}
            placeholder="Search clients..."
            aria-label="Search all clients"
            className="pl-9 pr-4 py-2 bg-sb-card border border-sb-cream/10 rounded-lg text-sm text-sb-cream placeholder:text-sb-cream/30 focus:outline-none focus:ring-2 focus:ring-sb-accent/50 w-64"
          />
        </div>

        {/* Column filter: Tier */}
        <select
          value={(table.getColumn('tier')?.getFilterValue() as string) ?? ''}
          onChange={e => table.getColumn('tier')?.setFilterValue(e.target.value || undefined)}
          aria-label="Filter by tier"
          className="px-3 py-2 bg-sb-card border border-sb-cream/10 rounded-lg text-sm text-sb-cream focus:outline-none focus:ring-2 focus:ring-sb-accent/50"
        >
          <option value="">All tiers</option>
          <option value="flagship">Flagship</option>
          <option value="retainer">Retainer</option>
          <option value="trial">Trial</option>
        </select>

        {/* Active filter count */}
        {table.getState().columnFilters.length > 0 && (
          <button
            onClick={() => table.resetColumnFilters()}
            className="text-xs text-sb-accent hover:text-sb-accent/80"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk actions */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2" role="status" aria-live="polite">
          <span className="text-sm text-sb-cream/50">{selectedCount} selected</span>
          <button className="px-3 py-1.5 text-xs bg-sb-card border border-sb-cream/10 rounded hover:border-sb-cream/30 text-sb-cream">
            Export
          </button>
          <button className="px-3 py-1.5 text-xs bg-sb-danger/10 border border-sb-danger/20 rounded hover:bg-sb-danger/20 text-sb-danger">
            Archive
          </button>
        </div>
      )}

      {/* Results count */}
      <span className="text-xs text-sb-cream/30" aria-live="polite" aria-atomic="true">
        {table.getFilteredRowModel().rows.length} results
      </span>
    </div>
  )
}
```

---

## 4. Pagination Component

```tsx
function TablePagination({ table }) {
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const totalRows = table.getFilteredRowModel().rows.length
  const from = pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, totalRows)

  return (
    <div className="flex items-center justify-between text-sm text-sb-cream/50">
      <span>{`${from}–${to} of ${totalRows}`}</span>

      <nav aria-label="Table pagination" className="flex items-center gap-1">
        <button
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          aria-label="First page"
          className="p-1.5 rounded hover:bg-sb-card disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronsLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Previous page"
          className="p-1.5 rounded hover:bg-sb-card disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>

        <span className="px-3 py-1 text-sb-cream">
          {`${pageIndex + 1} / ${pageCount}`}
        </span>

        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Next page"
          className="p-1.5 rounded hover:bg-sb-card disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={!table.getCanNextPage()}
          aria-label="Last page"
          className="p-1.5 rounded hover:bg-sb-card disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronsRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </nav>

      <select
        value={pageSize}
        onChange={e => table.setPageSize(Number(e.target.value))}
        aria-label="Rows per page"
        className="bg-sb-card border border-sb-cream/10 rounded px-2 py-1 text-sb-cream focus:outline-none focus:ring-2 focus:ring-sb-accent/50"
      >
        {[10, 25, 50, 100].map(size => (
          <option key={size} value={size}>{size} per page</option>
        ))}
      </select>
    </div>
  )
}
```

---

## 5. Inline Cell Editing

```tsx
function EditableCell({ getValue, row, column, table }) {
  const initialValue = getValue<string>()
  const [value, setValue] = useState(initialValue)
  const [isEditing, setIsEditing] = useState(false)

  const onSave = () => {
    if (value !== initialValue) {
      table.options.meta?.updateData(row.index, column.id, value)
    }
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={onSave}
        onKeyDown={e => {
          if (e.key === 'Enter') onSave()
          if (e.key === 'Escape') { setValue(initialValue); setIsEditing(false) }
        }}
        aria-label={`Edit ${column.id}`}
        className="w-full bg-sb-bg border border-sb-accent/50 rounded px-2 py-1 text-sm text-sb-cream focus:outline-none focus:ring-2 focus:ring-sb-accent/50"
      />
    )
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      aria-label={`Edit ${column.id}: ${value}`}
      className="w-full text-left px-2 py-1 rounded hover:bg-sb-card/50 group"
    >
      {value}
      <Pencil className="inline ml-2 w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" aria-hidden="true" />
    </button>
  )
}
```

---

## 6. Server-Side Sorting & Filtering

For large datasets — pass `manualSorting` and `manualFiltering`:

```tsx
const [sorting, setSorting] = useState<SortingState>([])
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 })

// Fetch data based on table state
const { data, isLoading } = useSWR(
  ['/api/clients', sorting, columnFilters, pagination],
  ([url, sort, filters, page]) => fetchClients({ url, sort, filters, page })
)

const table = useReactTable({
  data: data?.rows ?? [],
  columns,
  pageCount: data?.pageCount ?? -1,
  state: { sorting, columnFilters, pagination },
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  onPaginationChange: setPagination,
  manualSorting: true,
  manualFiltering: true,
  manualPagination: true,
  getCoreRowModel: getCoreRowModel(),
})
```

---

## 7. Status Badge Components

```tsx
const tierConfig = {
  flagship: { label: 'Flagship', className: 'bg-sb-accent/10 text-sb-accent border-sb-accent/20' },
  retainer: { label: 'Retainer', className: 'bg-sb-info/10 text-sb-info border-sb-info/20' },
  trial: { label: 'Trial', className: 'bg-sb-cream/5 text-sb-cream/50 border-sb-cream/10' },
}

function TierBadge({ tier }: { tier: Client['tier'] }) {
  const config = tierConfig[tier]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  )
}

const statusConfig = {
  active: { label: 'Active', dot: 'bg-sb-success', className: 'text-sb-success' },
  paused: { label: 'Paused', dot: 'bg-sb-warning', className: 'text-sb-warning' },
  churned: { label: 'Churned', dot: 'bg-sb-danger', className: 'text-sb-danger' },
}

function StatusBadge({ status }: { status: Client['status'] }) {
  const config = statusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  )
}
```

---

## 8. Kanban Board (Pipeline View)

```tsx
type Stage = 'lead' | 'proposal' | 'active' | 'at-risk' | 'churned'

const STAGES: { id: Stage; label: string }[] = [
  { id: 'lead', label: 'Lead' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'active', label: 'Active' },
  { id: 'at-risk', label: 'At Risk' },
  { id: 'churned', label: 'Churned' },
]

function KanbanBoard({ clients }: { clients: Client[] }) {
  const grouped = useMemo(() =>
    STAGES.reduce((acc, stage) => {
      acc[stage.id] = clients.filter(c => c.stage === stage.id)
      return acc
    }, {} as Record<Stage, Client[]>),
    [clients]
  )

  return (
    <div
      className="grid gap-4 overflow-x-auto pb-4"
      style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(260px, 1fr))` }}
      role="list"
      aria-label="Client pipeline"
    >
      {STAGES.map(stage => (
        <KanbanColumn
          key={stage.id}
          stage={stage}
          clients={grouped[stage.id]}
        />
      ))}
    </div>
  )
}

function KanbanColumn({ stage, clients }) {
  return (
    <div
      role="listitem"
      aria-label={`${stage.label}: ${clients.length} clients`}
      className="flex flex-col gap-3"
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-sb-cream/50 uppercase tracking-wider">
          {stage.label}
        </span>
        <span className="text-xs text-sb-cream/30 tabular-nums">{clients.length}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {clients.length === 0 && (
          <div className="rounded-lg border border-dashed border-sb-cream/10 p-4 text-center text-xs text-sb-cream/20">
            No clients
          </div>
        )}
        {clients.map(client => (
          <KanbanCard key={client.id} client={client} />
        ))}
      </div>
    </div>
  )
}

function KanbanCard({ client }: { client: Client }) {
  return (
    <article
      className="bg-sb-card border border-sb-cream/10 rounded-lg p-3 hover:border-sb-cream/20 transition-colors cursor-pointer group"
      aria-label={client.name}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium text-sb-cream leading-tight">{client.name}</h3>
        <TierBadge tier={client.tier} />
      </div>
      <div className="flex items-center justify-between text-xs text-sb-cream/40">
        <span className="font-mono">{formatCurrency(client.revenue)}</span>
        <span>{formatRelativeDate(client.lastContact)}</span>
      </div>
    </article>
  )
}
```

---

## 9. Empty States

```tsx
function EmptyState({ filter }: { filter: string }) {
  if (filter) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Search className="w-8 h-8 text-sb-cream/20" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-sb-cream/50">No results for "{filter}"</p>
          <p className="text-xs text-sb-cream/30 mt-1">Try a different search term or clear your filters</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <Users className="w-8 h-8 text-sb-cream/20" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-sb-cream/50">No clients yet</p>
        <p className="text-xs text-sb-cream/30 mt-1">Add your first client to get started</p>
      </div>
      <a href="/clients/new" className="px-4 py-2 bg-sb-accent text-sb-cream rounded-lg text-sm hover:bg-sb-accent/90 transition-colors mt-2">
        Add client
      </a>
    </div>
  )
}
```

---

## 10. Loading Skeleton

```tsx
function TableSkeleton({ rows = 10, cols = 5 }) {
  return (
    <div role="status" aria-label="Loading table data">
      <span className="sr-only">Loading...</span>
      <table className="w-full" aria-hidden="true">
        <thead>
          <tr className="border-b border-sb-cream/10">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-3 bg-sb-card rounded animate-pulse w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-sb-cream/5">
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  <div
                    className="h-4 bg-sb-card rounded animate-pulse"
                    style={{ width: `${60 + Math.random() * 30}%`, animationDelay: `${(rowIdx * cols + colIdx) * 50}ms` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## 11. Sort Indicator

```tsx
function SortIndicator({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  return (
    <span className="ml-1 inline-flex flex-col gap-0.5" aria-hidden="true">
      <ChevronUp
        className={`w-3 h-3 -mb-1 ${sorted === 'asc' ? 'text-sb-accent' : 'text-sb-cream/20'}`}
      />
      <ChevronDown
        className={`w-3 h-3 ${sorted === 'desc' ? 'text-sb-accent' : 'text-sb-cream/20'}`}
      />
    </span>
  )
}
```

---

## 12. Performance Rules

- **Never render the full dataset in the DOM.** Use pagination (client-side or server-side) for any list > 50 rows.
- **For lists > 500 rows** that need infinite scroll: use `@tanstack/react-virtual` alongside TanStack Table.
- **Memoize column definitions** outside the component or with `useMemo` to prevent full re-renders on every keystroke.
- **Use `manualSorting` + `manualFiltering`** when data comes from an API — don't load all records to the client.
- **Debounce search input** by 300ms minimum to prevent API hammering.
