import { Camera, Images, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { secondaryButtonClasses } from './buttonStyles'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface FileUploaderProps {
  label: string
  files: File[]
  onChange: (files: File[]) => void
  maxFiles?: number
  maxSizeMb?: number
}

/**
 * Lets people add photos from the camera or gallery, preview them and remove them.
 * It only selects files. The form using it is responsible for uploading them.
 */
export function FileUploader({ label, files, onChange, maxFiles = 10, maxSizeMb = 8 }: FileUploaderProps) {
  const [error, setError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([])
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const created = files.map((file) => ({ file, url: URL.createObjectURL(file) }))
    // Preview URLs are held by the browser, so they must be created and released here.
    // oxlint-disable-next-line react/set-state-in-effect
    setPreviews(created)
    return () => created.forEach(({ url }) => URL.revokeObjectURL(url))
  }, [files])

  function addFiles(selected: FileList | null) {
    if (!selected) return

    const incoming = Array.from(selected)
    const problems: string[] = []
    const accepted = incoming.filter((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        problems.push(`${file.name} is not a JPG, PNG or WEBP image.`)
        return false
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        problems.push(`${file.name} is larger than ${maxSizeMb} MB.`)
        return false
      }
      return true
    })

    const room = maxFiles - files.length
    if (accepted.length > room) problems.push(`You can add up to ${maxFiles} photos.`)

    setError(problems[0] ?? null)
    if (accepted.length > 0 && room > 0) onChange([...files, ...accepted.slice(0, room)])

    // Allows the same file to be chosen again after it has been removed.
    if (cameraInput.current) cameraInput.current.value = ''
    if (galleryInput.current) galleryInput.current.value = ''
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-text">{label}</p>
      <div className="flex flex-wrap gap-2">
        <label className={`${secondaryButtonClasses} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-primary`}>
          <Camera className="size-4" aria-hidden="true" />
          Take a photo
          <input
            ref={cameraInput}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            capture="environment"
            className="sr-only"
            onChange={(event) => addFiles(event.target.files)}
          />
        </label>
        <label className={`${secondaryButtonClasses} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-primary`}>
          <Images className="size-4" aria-hidden="true" />
          Choose from gallery
          <input
            ref={galleryInput}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            className="sr-only"
            onChange={(event) => addFiles(event.target.files)}
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        JPG, PNG or WEBP, up to {maxSizeMb} MB each. {files.length} of {maxFiles} added.
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}

      {previews.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {previews.map(({ file, url }, index) => (
            <li key={url} className="relative overflow-hidden rounded-control border border-border">
              <img src={url} alt={`Preview of ${file.name}`} className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(files.filter((_, position) => position !== index))}
                aria-label={`Remove ${file.name}`}
                className="absolute top-1 right-1 flex size-9 items-center justify-center rounded-full bg-text/80 text-surface hover:bg-text"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
