import { useRef, useState, type DragEvent } from 'react'
import { Button } from '../ui/Button'
import { UploadIcon } from '../ui/icons'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,application/pdf,image/*'

interface FileDropzoneProps {
  onFiles: (files: File[]) => void
}

/**
 * Drop target plus a real button.
 *
 * The surface itself is not focusable and carries no ARIA role: dragging is a
 * pointer-only affordance, and WCAG 2.2's 2.5.7 asks for a single-pointer
 * alternative, which the button is. Making the div a "button" too would
 * announce a control that keyboard users cannot actually drop onto.
 */
export function FileDropzone({ onFiles }: FileDropzoneProps) {
  const input = useRef<HTMLInputElement>(null)
  // A counter, not a boolean: dragenter/dragleave fire for every child element
  // the pointer crosses, and a boolean flickers the highlight off and on.
  const depth = useRef(0)
  const [over, setOver] = useState(false)

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    depth.current += 1
    setOver(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    depth.current -= 1
    if (depth.current <= 0) {
      depth.current = 0
      setOver(false)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    // Without this the browser navigates away to the dropped file.
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    depth.current = 0
    setOver(false)
    const files = [...(e.dataTransfer?.files ?? [])]
    if (files.length) onFiles(files)
  }

  return (
    <div
      className={over ? 'wm__drop wm__drop--over' : 'wm__drop'}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <UploadIcon size={22} />
      <Button variant="primary" onClick={() => input.current?.click()}>
        Choose documents
      </Button>
      <p className="wm__drop-hint">
        {over
          ? 'Release to add these documents.'
          : '…or drag them here. PDF, PNG, JPEG, WebP and HEIC. Nothing is uploaded — the watermark is applied on your device.'}
      </p>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        aria-label="Add documents to watermark"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          if (files.length) onFiles(files)
          // Reset, or picking the same file twice in a row fires no change.
          e.target.value = ''
        }}
      />
    </div>
  )
}
