// CST Portal — Cloudflare Worker for R2 Upload

export default {
  async fetch(request, env) {

    // CORS — সব request এ থাকবে
    const cors = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-File-Name, X-File-Type',
      'Access-Control-Max-Age':       '86400',
    }

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    // R2 binding check
    if (!env.BUCKET) {
      return Response.json(
        { error: 'R2 bucket not bound. Run: npx wrangler deploy' },
        { status: 500, headers: cors }
      )
    }

    const url = new URL(request.url)

    // ── POST /upload ───────────────────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        const formData  = await request.formData()
        const file      = formData.get('file')

        if (!file) {
          return Response.json({ error: 'No file found in request' }, { status: 400, headers: cors })
        }

        const ext       = (file.name || 'file').split('.').pop().toLowerCase()
        const key       = `files/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const buffer    = await file.arrayBuffer()
        const mimeType  = file.type || 'application/octet-stream'

        await env.BUCKET.put(key, buffer, {
          httpMetadata: { contentType: mimeType },
        })

        const publicUrl = `https://pub-ddebc4d9132440929089ea028c059b27.r2.dev/${key}`

        return Response.json(
          { success: true, key, publicUrl, size: buffer.byteLength },
          { headers: cors }
        )
      } catch (err) {
        return Response.json(
          { error: 'Upload failed: ' + err.message },
          { status: 500, headers: cors }
        )
      }
    }

    // ── DELETE /delete?key=... ─────────────────────────────────────────────
    if (request.method === 'DELETE' && url.pathname === '/delete') {
      try {
        const key = url.searchParams.get('key')
        if (!key) return Response.json({ error: 'No key provided' }, { status: 400, headers: cors })
        await env.BUCKET.delete(key)
        return Response.json({ success: true }, { headers: cors })
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: cors })
      }
    }

    // ── GET / — health check ───────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json(
        { status: 'ok', bucket: env.BUCKET ? 'connected' : 'NOT CONNECTED' },
        { headers: cors }
      )
    }

    return new Response('Not found', { status: 404, headers: cors })
  }
}
