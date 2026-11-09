// ── Cloudflare R2 Upload — Google Drive এর বদলে ──────────────────────────────
// তোমার Cloudflare Worker URL এখানে বসাও
const WORKER_URL = 'https://cst-upload.mohammedfaisal6764.workers.dev'

// File upload to R2 via Worker
export async function uploadToR2(file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Progress tracking
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 85)
        onProgress(pct)
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText)
        if (res.success) {
          resolve({ fileId: res.key, downloadUrl: res.publicUrl })
        } else {
          reject(new Error(res.error || 'Upload failed'))
        }
      } else {
        reject(new Error('HTTP ' + xhr.status))
      }
    }

    xhr.onerror = () => reject(new Error('Network error'))

    xhr.open('POST', WORKER_URL + '/upload')
    xhr.send(formData)
  })
}

// File delete from R2
export async function deleteFromR2(key) {
  if (!key) return
  try {
    await fetch(`${WORKER_URL}/delete?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
    })
  } catch {}
}
