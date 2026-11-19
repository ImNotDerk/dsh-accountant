/**
 * Per-session tag overrides, kept beside the config so a person can label any
 * session — not just every session in a folder — and have it survive restarts.
 *
 * The file is `<dataDir>/accountant.session-tags.json`:
 * `{ version: 1, tags: { "<sessionId>": "work" } }`. A missing or unreadable
 * file means no overrides. Writes are atomic, and an empty tag clears the
 * override rather than storing a blank one.
 *
 * @module accountant/session-tags
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const VERSION = 1
const MAX_TAG_LENGTH = 40

/** Where the overrides live. */
export function sessionTagsPath(dataDir) {
  return join(dataDir, 'accountant.session-tags.json')
}

/** Trim a tag and reject the empty or unprintable forms; null means "no tag". */
export function normalizeTag(raw) {
  if (typeof raw !== 'string') return null
  const tag = raw.trim()
  if (tag === '' || tag.length > MAX_TAG_LENGTH) return null
  return /[\u0000-\u001f\u007f]/.test(tag) ? null : tag
}

/** Load the overrides; a missing, corrupt, or foreign file is empty. */
export async function loadSessionTags(dataDir) {
  try {
    const parsed = JSON.parse(await readFile(sessionTagsPath(dataDir), 'utf8'))
    if (parsed?.version !== VERSION || parsed.tags === null || typeof parsed.tags !== 'object' || Array.isArray(parsed.tags)) {
      return {}
    }
    const tags = {}
    for (const [id, value] of Object.entries(parsed.tags)) {
      const tag = normalizeTag(value)
      if (typeof id === 'string' && id !== '' && tag !== null) tags[id] = tag
    }
    return tags
  } catch {
    return {}
  }
}

/**
 * Set or clear one session's tag and persist the file atomically.
 *
 * @returns {Promise<string|null>} the stored tag, or null when cleared
 */
export async function saveSessionTag(dataDir, sessionId, rawTag) {
  const tag = normalizeTag(rawTag)
  const tags = await loadSessionTags(dataDir)
  if (tag === null) delete tags[sessionId]
  else tags[sessionId] = tag
  const path = sessionTagsPath(dataDir)
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, `${JSON.stringify({ version: VERSION, tags }, null, 2)}\n`, 'utf8')
  await rename(temp, path)
  return tag
}
