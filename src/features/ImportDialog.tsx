// ============================================================
// Импорт требований из Excel/CSV с маппингом колонок:
// файл → автоподбор соответствий → предпросмотр → импорт
// (ID генерируются автоматически).
// ============================================================

import { ArrowRight, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Dialog, InfoNote, Select, toast } from '../components/ui';
import type { RequirementDraft } from '../domain/types';
import {
  guessMapping, IMPORT_FIELDS, parseImportFile, rowsToDrafts, type ImportField, type ParsedFile,
} from '../lib/excel';
import { importRequirements, useApp } from '../services/db';

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useApp();
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>>>({});
  const [reading, setReading] = useState(false);

  const drafts = useMemo<RequirementDraft[]>(
    () => (parsed ? rowsToDrafts(parsed, mapping) : []),
    [parsed, mapping],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const p = await parseImportFile(file);
      setParsed(p);
      setMapping(guessMapping(p.headers));
      toast(`Файл прочитан: ${p.rows.length} строк, ${p.headers.length} колонок`, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось прочитать файл', 'err');
    } finally {
      setReading(false);
    }
  };

  const doImport = () => {
    if (!mapping.title !== undefined && mapping.title === undefined) {
      toast('Укажите, какая колонка содержит «Название»', 'err');
      return;
    }
    if (drafts.length === 0) {
      toast('Нет строк для импорта: проверьте маппинг колонки «Название»', 'err');
      return;
    }
    const created = importRequirements(state.activeProjectId, drafts);
    toast(`Импортировано ${created.length} требований (первое: ${created[0]?.reqKey})`, 'ok');
    setParsed(null);
    setMapping({});
    onClose();
  };

  const close = () => { setParsed(null); setMapping({}); onClose(); };

  return (
    <Dialog open={open} onClose={close} title="⬆ Импорт из Excel / CSV" width={680}>
      <div className="flex flex-col gap-4">
        <InfoNote>
          Первая строка файла — заголовки. Соответствие колонок полям подбирается автоматически и может быть поправлено вручную.
          ID (REQ-…-NNNN) генерируются автоматически.
        </InfoNote>

        {/* Шаг 1: файл */}
        {!parsed ? (
          <label className="group flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-line2 bg-bg2/40 px-6 py-10 text-center transition-all hover:border-teal/60 hover:bg-teal/[0.04]">
            {reading ? <Loader2 size={26} className="spin text-teal" /> : <FileSpreadsheet size={26} className="text-teal transition-transform group-hover:scale-110" />}
            <span className="text-[13.5px] font-semibold text-ink">Выберите файл .xlsx / .xls / .csv</span>
            <span className="text-[12px] text-faint">Например: выгрузка из старой таблицы трассировки</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        ) : (
          <>
            <div className="flex items-center gap-2.5 rounded-lg border border-line/70 bg-bg2/40 px-3.5 py-2.5">
              <FileSpreadsheet size={16} className="text-teal" />
              <span className="truncate text-[12.5px] font-semibold text-ink">{parsed.fileName}</span>
              <span className="ml-auto font-mono text-[11px] text-faint">{parsed.rows.length} строк</span>
            </div>

            {/* Шаг 2: маппинг */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {IMPORT_FIELDS.map((f) => (
                <label key={f.field} className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint">
                    {f.label}
                    {f.required && <Badge tone="coral">обязательно</Badge>}
                  </span>
                  <Select
                    className="px-2.5 py-1.5 text-[12px]"
                    value={mapping[f.field] ?? -1}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.field]: Number(e.target.value) }))}
                  >
                    <option value={-1}>— не импортировать —</option>
                    {parsed.headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Колонка ${i + 1}`}</option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>

            {/* Предпросмотр */}
            <div className="max-h-[180px] overflow-auto rounded-lg border border-line/70">
              <table className="w-full text-left">
                <thead className="sticky top-0">
                  <tr className="bg-bg2 text-[10px] font-bold uppercase tracking-[0.12em] text-faint">
                    <th className="px-3 py-2">Название</th>
                    <th className="px-3 py-2">Тип</th>
                    <th className="px-3 py-2">Релиз</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.slice(0, 5).map((d, i) => (
                    <tr key={i} className="border-t border-line/50">
                      <td className="max-w-[260px] truncate px-3 py-2 text-[12px] text-ink">{d.title}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-teal">{d.reqType}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-dim">{d.release}</td>
                    </tr>
                  ))}
                  {drafts.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-[12px] text-faint">Нет строк с заполненным «Названием»</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-faint">
                К импорту: <span className="font-mono font-bold text-teal">{drafts.length}</span> из {parsed.rows.length}
              </span>
              <div className="flex gap-2">
                <Button onClick={close}>Отмена</Button>
                <Button variant="primary" onClick={doImport} disabled={drafts.length === 0}>
                  <Upload size={14} />
                  Импортировать <ArrowRight size={13} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
