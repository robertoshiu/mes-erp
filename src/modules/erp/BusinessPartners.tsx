import { useMemo } from 'react'
import { Contact } from 'lucide-react'
import { MasterDataModule } from '../../components/MasterDataModule'
import type { Column } from '../../components/DenseDataTable'
import { cn } from '../../lib/utils'
import type { BusinessPartner } from '../../data/erp/types'
import type { ErpModuleProps } from './types'

type Role = BusinessPartner['role']

const ROLE_META: Record<Role, { label: string; cls: string }> = {
  customer: { label: 'Customer', cls: 'bg-accent-2/15 text-accent-2 border-accent-2/30' },
  vendor: { label: 'Vendor', cls: 'bg-warn/15 text-warn border-warn/30' },
  both: { label: 'Both', cls: 'bg-accent-3/15 text-accent-3 border-accent-3/30' },
}

/** Pill chip for a partner role — colour-keyed to the locked palette. */
function RoleChip({ role }: { role: Role }) {
  const m = ROLE_META[role]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm border',
        m.cls,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden />
      {m.label}
    </span>
  )
}

/** Label/value pair in the drill-in detail grid (mirrors Production's DetailField). */
function DetailField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">{label}</div>
      <div className={cn('text-ink-1 truncate', mono && 'font-mono')}>{value}</div>
    </div>
  )
}

const USD = (n: number) => `$${n.toLocaleString('en-US')}`

export function BusinessPartnersModule({ erpData }: ErpModuleProps) {
  const partners = erpData.businessPartners

  const { customerCount, vendorCount, bothCount } = useMemo(() => {
    let customerCount = 0
    let vendorCount = 0
    let bothCount = 0
    for (const p of partners) {
      if (p.role === 'customer') customerCount++
      else if (p.role === 'vendor') vendorCount++
      else bothCount++
    }
    return { customerCount, vendorCount, bothCount }
  }, [partners])

  const columns: Column<BusinessPartner>[] = useMemo(
    () => [
      {
        key: 'bpNo',
        header: 'BP No.',
        width: 110,
        mono: true,
        render: r => r.bpNo,
        sortFn: (a, b) => a.bpNo.localeCompare(b.bpNo),
      },
      {
        key: 'role',
        header: 'Role',
        width: 110,
        render: r => <RoleChip role={r.role} />,
        sortFn: (a, b) => a.role.localeCompare(b.role),
      },
      {
        key: 'name',
        header: 'Name',
        width: 240,
        render: r => r.name,
        sortFn: (a, b) => a.name.localeCompare(b.name),
      },
      {
        key: 'country',
        header: 'Country',
        width: 90,
        mono: true,
        render: r => r.country,
        sortFn: (a, b) => a.country.localeCompare(b.country),
      },
      {
        key: 'paymentTerms',
        header: 'Terms',
        width: 90,
        mono: true,
        render: r => r.paymentTerms,
        sortFn: (a, b) => a.paymentTerms.localeCompare(b.paymentTerms),
      },
      {
        key: 'incoterms',
        header: 'Incoterms',
        width: 90,
        mono: true,
        render: r => r.incoterms,
        sortFn: (a, b) => a.incoterms.localeCompare(b.incoterms),
      },
    ],
    [],
  )

  const headerRight = (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-[10px] text-accent-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-2" aria-hidden />
        {customerCount} Customers
      </span>
      <span className="flex items-center gap-1.5 text-[10px] text-warn">
        <span className="w-1.5 h-1.5 rounded-full bg-warn" aria-hidden />
        {vendorCount} Vendors
      </span>
      <span className="flex items-center gap-1.5 text-[10px] text-accent-3">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-3" aria-hidden />
        {bothCount} Both
      </span>
    </div>
  )

  const renderDetail = (r: BusinessPartner) => (
    <div className="space-y-5 text-xs">
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <div className="col-span-2">
          <DetailField label="Name" value={r.name} />
        </div>
        <DetailField label="Role" value={<RoleChip role={r.role} />} />
        <DetailField label="Country" value={r.country} mono />
        <DetailField label="Payment Terms" value={r.paymentTerms} mono />
        <DetailField label="Incoterms" value={r.incoterms} mono />
        <div className="col-span-2">
          <DetailField label="Credit Limit" value={<span className="tabular-nums">{USD(r.creditLimit)}</span>} mono />
        </div>
      </div>
    </div>
  )

  return (
    <MasterDataModule
      title="Business Partners"
      subtitle={`${partners.length.toLocaleString()} customers & vendors`}
      icon={<Contact size={15} strokeWidth={1.9} />}
      data={partners}
      columns={columns}
      rowKey={r => r.bpNo}
      entityType="businessPartner"
      headerRight={headerRight}
      renderDetail={renderDetail}
      detailTitle={r => r.name}
      detailSubtitle={r => `${r.bpNo} · ${ROLE_META[r.role].label}`}
    />
  )
}
