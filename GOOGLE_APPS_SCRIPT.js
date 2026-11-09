// ═══════════════════════════════════════════════════════════════════════
// CST Portal — Google Apps Script
// ⚠️ এই নতুন code দিয়ে REDEPLOY করুন:
//    Deploy → Manage deployments → Edit → New version → Deploy
//    Execute as: Me | Access: Anyone
// ═══════════════════════════════════════════════════════════════════════

const FOLDER_NAME = 'CST_Portal_Files'

function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME)
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME)
}

function doGet(e) {
  const fileId = e && e.parameter && e.parameter.fileId
  if (fileId) {
    try {
      const file = DriveApp.getFileById(fileId)
      const blob = file.getBlob()
      return ContentService
        .createTextOutput(Utilities.base64Encode(blob.getBytes()))
        .setMimeType(ContentService.MimeType.TEXT)
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: err.message }))
        .setMimeType(ContentService.MimeType.JSON)
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents)

    // ── DELETE action ────────────────────────────────────────────────
    if (params.action === 'delete') {
      try {
        const file = DriveApp.getFileById(params.fileId)
        file.setTrashed(true) // Drive এ Trash এ পাঠাবে
      } catch (err) {
        // file না থাকলে ignore করব
      }
      return ContentService
        .createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    // ── DOWNLOAD proxy action ────────────────────────────────────────
    if (params.action === 'download') {
      const file = DriveApp.getFileById(params.fileId)
      const blob = file.getBlob()
      return ContentService
        .createTextOutput(JSON.stringify({
          success:  true,
          base64:   Utilities.base64Encode(blob.getBytes()),
          mimeType: file.getMimeType(),
          name:     file.getName(),
        }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    // ── UPLOAD action ────────────────────────────────────────────────
    const base64   = params.file
    const fileName = params.name
    const mimeType = params.mimeType || 'application/octet-stream'

    const bytes  = Utilities.base64Decode(base64)
    const blob   = Utilities.newBlob(bytes, mimeType, fileName)
    const folder = getOrCreateFolder()
    const saved  = folder.createFile(blob)

    saved.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

    const fileId = saved.getId()

    return ContentService
      .createTextOutput(JSON.stringify({
        success:     true,
        fileId:      fileId,
        downloadUrl: `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
      }))
      .setMimeType(ContentService.MimeType.JSON)

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}
