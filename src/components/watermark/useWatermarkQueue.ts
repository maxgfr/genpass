import { useCallback, useRef, useState } from 'react'
import { downloadBlob } from '../../lib/download'
import {
  defaultOutputFor,
  mimeFor,
  outputFilename,
  sniffKind,
  type FileKind,
  type OutputFormat,
} from '../../lib/fileKind'
import { decodeHeic } from '../../lib/heic'
import { decodeImage, watermarkImage } from '../../lib/imageWatermark'
import { imageToPdf, watermarkPdf } from '../../lib/pdfWatermark'
import type { WatermarkConfig } from '../../lib/watermark'
import { zipStore } from '../../lib/zip'

export interface WatermarkJob {
  id: string
  file: File
  name: string
  size: number
  /** null when the file is of a kind this app cannot open. */
  kind: FileKind | null
  format: OutputFormat
  status: 'queued' | 'processing' | 'done' | 'error'
  output?: { blob: Blob; name: string }
  error?: string
}

/** Beyond this, a browser tab is likely to die rather than produce a file. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024

const UNSUPPORTED = 'Not a supported document — PDF, PNG, JPEG, WebP and HEIC only.'

function messageFor(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'This file could not be watermarked.'
}

/** Let React paint and let the previous file's buffers be collected. */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function decode(file: File, kind: FileKind): Promise<ImageBitmap> {
  return kind === 'heic' ? decodeHeic(file) : decodeImage(file)
}

async function runJob(job: WatermarkJob, cfg: WatermarkConfig): Promise<{ blob: Blob; name: string }> {
  const bytes = () => job.file.arrayBuffer().then((buffer) => new Uint8Array(buffer))

  if (job.kind === 'pdf') {
    const out = await watermarkPdf(await bytes(), cfg)
    return {
      blob: new Blob([out as BlobPart], { type: mimeFor('pdf') }),
      name: outputFilename(job.name, 'pdf'),
    }
  }

  const bitmap = await decode(job.file, job.kind!)
  try {
    if (job.format === 'pdf') {
      // pdf-lib embeds only PNG and JPEG, so an image-sourced PDF goes through
      // the canvas either way. Watermarking in that same pass is what keeps the
      // PDF identical to what the preview showed.
      const image = await watermarkImage(bitmap, cfg, 'png')
      const out = await imageToPdf(new Uint8Array(await image.arrayBuffer()), 'png')
      return {
        blob: new Blob([out as BlobPart], { type: mimeFor('pdf') }),
        name: outputFilename(job.name, 'pdf'),
      }
    }

    const blob = await watermarkImage(bitmap, cfg, job.format)
    // toBlob quietly falls back to PNG when a browser cannot encode the
    // requested type. Name the file after what actually came back.
    const actual = blob.type === mimeFor(job.format) ? job.format : 'png'
    return { blob, name: outputFilename(job.name, actual) }
  } finally {
    bitmap.close?.()
  }
}

let sequence = 0

export function useWatermarkQueue(cfg: WatermarkConfig) {
  const [jobs, setJobs] = useState<WatermarkJob[]>([])
  const [running, setRunning] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const jobsRef = useRef<WatermarkJob[]>([])
  jobsRef.current = jobs

  const patch = useCallback((id: string, changes: Partial<WatermarkJob>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...changes } : job)))
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
    const added: WatermarkJob[] = []
    for (const file of files) {
      const kind = file.size > MAX_FILE_BYTES ? null : await sniffKind(file)
      added.push({
        id: `wm-${++sequence}`,
        file,
        name: file.name,
        size: file.size,
        kind,
        format: kind ? defaultOutputFor(kind) : 'png',
        status: kind ? 'queued' : 'error',
        error: kind
          ? undefined
          : file.size > MAX_FILE_BYTES
            ? `Larger than the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit.`
            : UNSUPPORTED,
      })
    }
    setJobs((current) => [...current, ...added])

    const usable = added.filter((job) => job.kind).length
    const rejected = added.length - usable
    setAnnouncement(
      `${usable} ${usable === 1 ? 'document' : 'documents'} added` +
        (rejected > 0 ? `, ${rejected} not supported` : '') +
        '.',
    )
  }, [])

  const remove = useCallback((id: string) => {
    setJobs((current) => current.filter((job) => job.id !== id))
  }, [])

  const clear = useCallback(() => {
    setJobs([])
    setAnnouncement('')
  }, [])

  const setFormat = useCallback(
    (id: string, format: OutputFormat) => {
      // The existing output was written in the old format, so it is stale.
      patch(id, { format, status: 'queued', output: undefined, error: undefined })
    },
    [patch],
  )

  /**
   * Re-queue finished work when the watermark itself changes: a Download
   * button that hands out a file the preview no longer matches is a lie.
   */
  const invalidate = useCallback(() => {
    setJobs((current) =>
      current.map((job) =>
        job.status === 'done' ? { ...job, status: 'queued', output: undefined } : job,
      ),
    )
  }, [])

  const run = useCallback(async () => {
    const pending = jobsRef.current.filter((job) => job.status === 'queued' && job.kind)
    if (!pending.length || running) return

    setRunning(true)
    let done = 0
    let failed = 0
    // Strictly sequential: a 12 MP photo is ~100 MB of live buffers while it is
    // being processed, and running a batch in parallel multiplies that by the
    // batch size for no gain — encode and decode are already off-thread.
    for (const [index, job] of pending.entries()) {
      patch(job.id, { status: 'processing', error: undefined })
      setAnnouncement(`Watermarking ${index + 1} of ${pending.length}.`)
      try {
        const output = await runJob(job, cfg)
        patch(job.id, { status: 'done', output })
        done += 1
      } catch (err) {
        patch(job.id, { status: 'error', error: messageFor(err) })
        failed += 1
      }
      await yieldToBrowser()
    }
    setRunning(false)
    setAnnouncement(
      `${done} of ${pending.length} watermarked` + (failed > 0 ? `, ${failed} failed` : '') + '.',
    )
  }, [cfg, patch, running])

  const download = useCallback((id: string) => {
    const job = jobsRef.current.find((candidate) => candidate.id === id)
    if (job?.output) downloadBlob(job.output.blob, job.output.name)
  }, [])

  const downloadAll = useCallback(async () => {
    const finished = jobsRef.current.filter((job) => job.output)
    if (!finished.length) return
    const files = await Promise.all(
      finished.map(async (job) => ({
        name: job.output!.name,
        data: new Uint8Array(await job.output!.blob.arrayBuffer()),
      })),
    )
    downloadBlob(zipStore(files), 'genpass-watermarked.zip')
  }, [])

  const finished = jobs.filter((job) => job.status === 'done').length
  const pending = jobs.filter((job) => job.status === 'queued' && job.kind).length

  return {
    jobs,
    running,
    announcement,
    finished,
    pending,
    addFiles,
    remove,
    clear,
    setFormat,
    invalidate,
    run,
    download,
    downloadAll,
  }
}
