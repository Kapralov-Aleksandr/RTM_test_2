// ============================================================
// 📜 История изменений требования (requirement_history):
// таймлайн «поле: старое → новое» с датами.
// ============================================================

import { History } from 'lucide-react';
import { useMemo } from 'react';
import { Dialog, EmptyState } from '../components/ui';
import { FIELD_LABEL, fmtDateTime } from '../domain/logic';
import type { Requirement } from '../domain/types';
import { useApp } from '../services/db';

export function HistoryDialog({ req, onClose }: { req: Requirement | null; onClose: () => void }) {
  const state = useApp();
  const entries = useMemo(
    () => (req ? state.history.filter((h) => h.requirementId === req.id) : []),
    [state.history, req],
  );

  return (
    <Dialog
      open={!!req}
      onClose={onClose}
      title={req ? `📜 История · ${req.reqKey}` : 'История'}
      width={560}
    >
      {req && entries.length === 0 ? (
        <EmptyState
          icon={<History size={22} />}
          title="Изменений пока не было"
          sub="Сохраните правку в форме редактирования — изменённые поля появятся здесь со старым и новым значениями."
        />
      ) : (
        <div className="flex max-h-[420px] flex-col gap-0 overflow-y-auto pr-1">
          {entries.map((h, i) => (
            <div key={h.id} className="relative flex gap-3.5 pb-5">
              {/* вертикальная линия таймлайна */}
              {i < entries.length - 1 && <span className="absolute left-[7px] top-5 h-full w-px bg-line" />}
              <span className="relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-teal bg-bg0" />
              <div className="min-w-0 flex-1 rounded-lg border border-line/70 bg-bg2/40 px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal">
                    {FIELD_LABEL[h.fieldChanged] ?? h.fieldChanged}
                  </span>
                  <span className="font-mono text-[10.5px] text-faint">{fmtDateTime(h.changedAt)}</span>
                </div>
                <div className="mt-1.5 flex flex-col gap-1 text-[12.5px]">
                  <p className="text-coral/90 line-through decoration-coral/40">{h.oldValue || '(пусто)'}</p>
                  <p className="text-ink">{h.newValue || '(пусто)'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
