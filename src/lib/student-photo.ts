import { apiFetch, apiUpload } from './api'
import { withAuth } from './student-auth'

/**
 * Upload the cropped profile photo. The server compresses it further
 * (square WebP) and returns a fresh presigned URL so the avatar can update
 * without refetching the whole profile.
 */
export function uploadStudentPhoto(
  blob: Blob,
): Promise<{ photo_url: string }> {
  return withAuth((token) => {
    const form = new FormData()
    form.append('file', blob, 'photo.jpg')
    return apiUpload<{ photo_url: string }>('/student/profile/photo', form, token)
  })
}

export function removeStudentPhoto(): Promise<void> {
  return withAuth((token) =>
    apiFetch<void>('/student/profile/photo', { method: 'DELETE', token }),
  )
}
