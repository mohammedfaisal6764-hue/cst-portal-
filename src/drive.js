// ── Google Drive Direct Upload (Browser → Drive, No Apps Script) ──────────────

const CLIENT_ID   = '440214753952-ka92e3kdti9ff622kfpgf0r6v3g9svqt.apps.googleusercontent.com'
const FOLDER_ID   = '1imRCWXFHkFEPn98cpVcbuEbFMk90dZFY'
const SCOPES      = 'https://www.googleapis.com/auth/drive.file'

let tokenClient   = null
let accessToken   = null
let tokenExpiry   = 0

// GIS (Google Identity Services) load করো
function loadGIS() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = resolve
    document.head.appendChild(s)
  })
}

// Access token নাও
export async function getDriveToken() {
  await loadGIS()

  // Token এখনো valid?
  if (accessToken && Date.now() < tokenExpiry - 60000) return accessToken

  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope:     SCOPES,
      callback:  (res) => {
        if (res.error) { reject(new Error(res.error)); return }
        accessToken = res.access_token
        tokenExpiry = Date.now() + (res.expires_in * 1000)
        resolve(accessToken)
      },
    })
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

// ── Fast Resumable Upload to Google Drive ──────────────────────────────────────
export async function uploadToDrive(file, onProgress) {
  const token = await getDriveToken()

  // Step 1: Resumable upload session শুরু করো
  const meta = JSON.stringify({
    name:    file.name,
    parents: [FOLDER_ID],
  })

  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method:  'POST',
      headers: {
        Authorization:   `Bearer ${token}`,
        'Content-Type':  'application/json; charset=UTF-8',
        'X-Upload-Content-Type':   file.type || 'application/octet-stream',
        'X-Upload-Content-Length': file.size,
      },
      body: meta,
    }
  )

  if (!initRes.ok) throw new Error('Drive session init failed: ' + initRes.status)
  const uploadUrl = initRes.headers.get('Location')

  // Step 2: Chunked upload (5MB chunks) — progress tracking
  const CHUNK = 5 * 1024 * 1024 // 5MB
  let offset  = 0
  let fileId  = null

  while (offset < file.size) {
    const chunk   = file.slice(offset, offset + CHUNK)
    const end     = Math.min(offset + CHUNK, file.size) - 1
    const isLast  = end === file.size - 1

    const res = await fetch(uploadUrl, {
      method:  'PUT',
      headers: {
        'Content-Range': `bytes ${offset}-${end}/${file.size}`,
        'Content-Type':  file.type || 'application/octet-stream',
      },
      body: chunk,
    })

    if (isLast && (res.status === 200 || res.status === 201)) {
      const json = await res.json()
      fileId = json.id
    } else if (res.status === 308) {
      // Continue — next chunk
    } else if (!isLast && res.status !== 308) {
      throw new Error('Upload chunk failed: ' + res.status)
    }

    offset += CHUNK
    if (onProgress) onProgress(Math.round((offset / file.size) * 80))
  }

  if (!fileId) throw new Error('Drive upload failed — no file ID')

  // Step 3: File publicly readable করো (যেন embed/download কাজ করে)
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`
  return { fileId, downloadUrl }
}

// ── Delete from Drive ──────────────────────────────────────────────────────────
export async function deleteFromDrive(fileId) {
  try {
    const token = await getDriveToken()
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {}
}
