import { useEffect } from 'react'
import { useUiStore } from '../lib/uiStore'

interface DrillInPanelProps {
  children: React.ReactNode
  title: string
}

export function DrillInPanel({ children, title }: DrillInPanelProps) {
  const selectedEntity = useUiStore(s => s.selectedEntity)
  const selectEntity = useUiStore(s => s.selectEntity)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') selectEntity(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectEntity])

  if (!selectedEntity) return null

  return (
    <aside className="fixed top-12 right-0 bottom-0 w-[400px] bg-white border-l border-[#D1D5DB] shadow-lg z-50 overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
        <h2 className="text-sm font-semibold text-[#1A1A1A]">{title}</h2>
        <button
          onClick={() => selectEntity(null)}
          className="w-6 h-6 flex items-center justify-center text-[#6B7280] hover:text-[#1A1A1A] text-lg"
          aria-label="Close panel"
        >
          &times;
        </button>
      </div>
      <div className="p-4">{children}</div>
    </aside>
  )
}
