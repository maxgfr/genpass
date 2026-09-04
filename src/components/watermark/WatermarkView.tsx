import { useCallback, useMemo, useState } from 'react'
import '../../styles/watermark.css'
import { isWinAnsiEncodable } from '../../lib/pdfWatermark'
import { DEFAULT_WATERMARK, type WatermarkConfig } from '../../lib/watermark'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { InlineWarning } from '../ui/InlineWarning'
import { FileDropzone } from './FileDropzone'
import { WatermarkFileRow } from './WatermarkFileRow'
import { WatermarkOptions } from './WatermarkOptions'
import { WatermarkPreview } from './WatermarkPreview'
import { useWatermarkQueue } from './useWatermarkQueue'

export function WatermarkView() {
  const [config, setConfig] = useState<WatermarkConfig>(DEFAULT_WATERMARK)
  const queue = useWatermarkQueue(config)
  const { invalidate } = queue
  const [previewId, setPreviewId] = useState<string | null>(null)

  const changeConfig = useCallback(
    (next: WatermarkConfig) => {
      setConfig(next)
      invalidate()
    },
    [invalidate],
  )

  const usable = queue.jobs.filter((job) => job.kind)
  // Fall back past anything that failed: a queue whose first file is a
  // password-protected PDF should still preview the files that do work,
  // rather than parking on an error the user has already been told about.
  const previewJob =
    usable.find((job) => job.id === previewId) ??
    usable.find((job) => job.status !== 'error') ??
    usable[0] ??
    null

  const addFiles = (files: File[]) => {
    void queue.addFiles(files)
  }

  // Warn before the user presses anything, not after a batch fails at the end.
  const pdfBound = useMemo(
    () => queue.jobs.some((job) => job.kind === 'pdf' || job.format === 'pdf'),
    [queue.jobs],
  )
  const unrenderable = pdfBound && !isWinAnsiEncodable(config.text)

  return (
    <>
      <section className="panel panel--plain">
        <FileDropzone onFiles={addFiles} />
      </section>

      <section className="panel">
        <h2 className="panel__title">Watermark</h2>
        <WatermarkOptions value={config} onChange={changeConfig} />

        {unrenderable && (
          <InlineWarning>
            PDF output uses the built-in Helvetica font, which cannot draw these characters. Use
            Latin characters, or save these files as images instead.
          </InlineWarning>
        )}

        <InlineWarning>
          A text watermark is a visible marking, not protection. Anyone can crop or edit it out of
          the file — it discourages casual reuse, it does not prevent it.
        </InlineWarning>
      </section>

      <section className="panel">
        <h2 className="panel__title">Preview</h2>
        <WatermarkPreview job={previewJob} config={config} />
      </section>

      <section className="panel">
        <div className="wm__toolbar">
          <h2 className="panel__title">
            {queue.jobs.length} {queue.jobs.length === 1 ? 'document' : 'documents'}
          </h2>
          <div className="wm__actions">
            <Button
              variant="primary"
              busy={queue.running}
              disabled={queue.pending === 0}
              onClick={() => void queue.run()}
            >
              Apply watermark
            </Button>
            {queue.finished > 1 && (
              <Button onClick={() => void queue.downloadAll()}>Download all (ZIP)</Button>
            )}
            {queue.jobs.length > 0 && <Button onClick={queue.clear}>Clear</Button>}
          </div>
        </div>

        {/* One live region for the whole queue. One per row would turn a batch
            into unusable screen-reader chatter. */}
        <p className="wm__status" role="status">
          {queue.announcement}
        </p>

        {queue.jobs.length === 0 ? (
          <EmptyState title="No documents yet">
            <p>
              Add a PDF or an image above. Everything is processed on your device — no upload, no
              server.
            </p>
          </EmptyState>
        ) : (
          <ul className="wm__list">
            {queue.jobs.map((job) => (
              <WatermarkFileRow
                key={job.id}
                job={job}
                onFormatChange={queue.setFormat}
                onDownload={queue.download}
                onRemove={queue.remove}
              />
            ))}
          </ul>
        )}

        {usable.length > 1 && previewJob && (
          <p className="wm__preview-caption">
            Previewing {previewJob.name}.{' '}
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                const index = usable.findIndex((job) => job.id === previewJob.id)
                setPreviewId(usable[(index + 1) % usable.length]!.id)
              }}
            >
              Preview the next document
            </button>
          </p>
        )}

        <p className="wm__preview-caption">
          Images are re-encoded, which drops their EXIF metadata — including GPS location. PDFs keep
          their own metadata. HEIC needs one online use before it works offline.
        </p>
      </section>
    </>
  )
}
