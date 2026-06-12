import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { getCroppedBlob } from '@/lib/crop-image'
import { removeStudentPhoto, uploadStudentPhoto } from '@/lib/student-photo'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
// Original picks may be large camera files — they're cropped + compressed in
// the browser and only the <1 MB result is uploaded. This just bounds memory.
const MAX_SOURCE_BYTES = 15 * 1024 * 1024

const VISIBILITY_NOTE =
  'This photo appears on your ID card, profile, and to classmates in chat (unless hidden in Privacy settings).'

type Step = 'pick' | 'crop' | 'preview'

export function PhotoUploadDialog({
  open,
  onOpenChange,
  hasPhoto,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasPhoto: boolean
  onUploaded: (photoUrl: string | null) => void
}) {
  const [step, setStep] = useState<Step>('pick')
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [cropPixels, setCropPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Object URLs leak until revoked. The effect cleanup fires both when the
  // URL is replaced and on unmount, so no manual revokes are needed anywhere.
  useEffect(() => {
    if (!sourceUrl) return
    return () => URL.revokeObjectURL(sourceUrl)
  }, [sourceUrl])
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const reset = useCallback(() => {
    setStep('pick')
    setSourceUrl(null)
    setPreviewUrl(null)
    setCroppedBlob(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCropPixels(null)
    setConfirmingRemove(false)
  }, [])

  const handleOpenChange = (next: boolean) => {
    if (busy) return
    if (!next) reset()
    onOpenChange(next)
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Unsupported image type. Use a JPEG, PNG, or WebP photo.')
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error('That photo is too large. Pick one under 15 MB.')
      return
    }
    setSourceUrl(URL.createObjectURL(file))
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCropPixels(null)
    setStep('crop')
  }

  const handleCropDone = async () => {
    if (!sourceUrl || !cropPixels) return
    setBusy(true)
    try {
      const blob = await getCroppedBlob(sourceUrl, cropPixels)
      setCroppedBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
      setStep('preview')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not crop that image.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleUpload = async () => {
    if (!croppedBlob) return
    setBusy(true)
    try {
      const { photo_url } = await uploadStudentPhoto(croppedBlob)
      toast.success('Profile photo updated')
      onUploaded(photo_url)
      reset()
      onOpenChange(false)
    } catch (err) {
      // Stay on the preview so the cropped photo isn't lost on a network blip.
      toast.error(
        err instanceof ApiError ? err.message : 'Upload failed. Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    try {
      await removeStudentPhoto()
      toast.success('Profile photo removed')
      onUploaded(null)
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not remove the photo.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'pick' && (
          <>
            <DialogHeader>
              <DialogTitle>Profile photo</DialogTitle>
              <DialogDescription>{VISIBILITY_NOTE}</DialogDescription>
            </DialogHeader>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <ImagePlus className="size-8" />
              <span className="text-sm font-medium">Choose a photo</span>
              <span className="text-xs">JPEG, PNG, or WebP</span>
            </button>
            {hasPhoto && (
              <DialogFooter className="sm:justify-start">
                {confirmingRemove ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Remove your photo everywhere?
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleRemove()}
                    >
                      {busy && <Loader2 className="animate-spin" />}
                      Remove
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setConfirmingRemove(false)}
                    >
                      Keep it
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmingRemove(true)}
                  >
                    <Trash2 />
                    Remove current photo
                  </Button>
                )}
              </DialogFooter>
            )}
          </>
        )}

        {step === 'crop' && sourceUrl && (
          <>
            <DialogHeader>
              <DialogTitle>Adjust your photo</DialogTitle>
              <DialogDescription>
                Drag to reposition and use the slider to zoom.
              </DialogDescription>
            </DialogHeader>
            <div className="relative h-72 overflow-hidden rounded-lg bg-muted">
              <Cropper
                image={sourceUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPixels) => setCropPixels(areaPixels)}
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-muted-foreground">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label="Zoom"
              />
            </label>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  reset()
                }}
              >
                Back
              </Button>
              <Button
                disabled={busy || !cropPixels}
                onClick={() => void handleCropDone()}
              >
                {busy && <Loader2 className="animate-spin" />}
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'preview' && previewUrl && (
          <>
            <DialogHeader>
              <DialogTitle>Use this photo?</DialogTitle>
              <DialogDescription>{VISIBILITY_NOTE}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-2">
              <img
                src={previewUrl}
                alt="New profile photo preview"
                className="size-40 rounded-full border object-cover shadow-md"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setStep('crop')}
              >
                Back
              </Button>
              <Button disabled={busy} onClick={() => void handleUpload()}>
                {busy && <Loader2 className="animate-spin" />}
                Upload photo
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
