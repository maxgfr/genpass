import { useId } from 'react'
import { FORMAT_LABEL, KIND_LABEL, outputOptionsFor, type OutputFormat } from '../../lib/fileKind'
import { Button, IconButton } from '../ui/Button'
import { Select } from '../ui/Select'
import { DownloadIcon, TrashIcon } from '../ui/icons'
import type { WatermarkJob } from './useWatermarkQueue'

const STATUS_LABEL: Record<WatermarkJob['status'], string> = {
  queued: 'Ready to watermark',
  processing: 'Working…',
  done: 'Watermarked',
  error: 'Failed',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface WatermarkFileRowProps {
  job: WatermarkJob
  selected: boolean
  onPreview: (id: string) => void
  onFormatChange: (id: string, format: OutputFormat) => void
  onDownload: (id: string) => void
  onRemove: (id: string) => void
}

export function WatermarkFileRow({
  job,
  selected,
  onPreview,
  onFormatChange,
  onDownload,
  onRemove,
}: WatermarkFileRowProps) {
  const radioId = useId()
  const options = job.kind ? outputOptionsFor(job.kind) : []

  return (
    <li
      className={
        [
          'wm__row',
          job.status === 'error' && 'wm__row--error',
          selected && 'wm__row--selected',
        ]
          .filter(Boolean)
          .join(' ')
      }
      aria-busy={job.status === 'processing' || undefined}
    >
      {/* A real radio, so arrow keys move between documents and the current
          one is announced — "one of N is shown" is exactly a radiogroup. */}
      <input
        type="radio"
        id={radioId}
        className="wm__row-radio"
        name="wm-preview"
        checked={selected}
        disabled={!job.kind}
        onChange={() => onPreview(job.id)}
      />
      <label className="wm__row-main" htmlFor={radioId}>
        <span className="wm__row-name">{job.name}</span>
        {/* Status as words, not colour: 1.4.1 Use of Colour. */}
        <span className="wm__row-meta">
          {formatSize(job.size)}
          {job.kind && ` · ${KIND_LABEL[job.kind]}`}
          {' · '}
          {STATUS_LABEL[job.status]}
        </span>
        {job.error && (
          <span className="wm__row-error" role="alert">
            {job.error}
          </span>
        )}
      </label>

      {options.length > 1 && job.kind && (
        <div className="wm__row-format">
          <Select
            label="Save as"
            value={job.format}
            disabled={job.status === 'processing'}
            onChange={(e) => onFormatChange(job.id, e.target.value as OutputFormat)}
          >
            {options.map((format) => (
              <option key={format} value={format}>
                {FORMAT_LABEL[format]}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="wm__row-actions">
        {job.status === 'done' && job.output && (
          <Button small onClick={() => onDownload(job.id)}>
            <DownloadIcon size={14} />
            Download
          </Button>
        )}
        <IconButton label={`Remove ${job.name}`} onClick={() => onRemove(job.id)}>
          <TrashIcon />
        </IconButton>
      </div>
    </li>
  )
}
