import { PortalPanel } from './PortalPanel'

export function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <PortalPanel tone="dark" className="rounded-[20px] bg-white/[0.06] px-3 py-3">
      <div className="text-[11px] text-white/50">{label}</div>
      <div className="mt-2 text-[16px] font-semibold text-white">{value}</div>
    </PortalPanel>
  )
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <PortalPanel tone="muted" className="rounded-[22px] px-3 py-4">
      <div className="text-[12px] text-[#707070]">{label}</div>
      <div className="mt-2 text-[17px] font-semibold text-[#090A0B]">{value}</div>
    </PortalPanel>
  )
}
