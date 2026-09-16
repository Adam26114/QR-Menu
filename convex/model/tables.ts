import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { expectedError, ERROR_CODES } from "../lib/errors"
import { requireActiveMembership } from "./identity"

type DbCtx = QueryCtx | MutationCtx
const KEY_VERSION = 1

function keyMaterial(): string {
    const key = (
        globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env?.QR_TOKEN_ENCRYPTION_KEY
    if (key) return key
    throw expectedError(
        ERROR_CODES.CONFLICT,
        "QR token encryption is not configured"
    )
}
function bytesToBase64(bytes: Uint8Array): string {
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
}
function base64ToBytes(value: string): Uint8Array {
    return Uint8Array.from(atob(value), (x) => x.charCodeAt(0))
}
async function digest(value: string): Promise<string> {
    const data = new TextEncoder().encode(value)
    return bytesToBase64(
        new Uint8Array(await crypto.subtle.digest("SHA-256", data))
    )
}
async function cryptoKey() {
    const digestBytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(keyMaterial())
    )
    return crypto.subtle.importKey("raw", digestBytes, "AES-GCM", false, [
        "encrypt",
        "decrypt",
    ])
}
export async function createToken(): Promise<string> {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return bytesToBase64(bytes)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "")
}
async function encrypt(token: string) {
    const iv = new Uint8Array(12)
    crypto.getRandomValues(iv)
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await cryptoKey(),
        new TextEncoder().encode(token)
    )
    return {
        tokenHash: await digest(token),
        tokenCiphertext: bytesToBase64(new Uint8Array(ciphertext)),
        tokenIv: bytesToBase64(iv),
        tokenKeyVersion: KEY_VERSION,
    }
}
export async function hashOpaqueToken(token: string) {
    return digest(token)
}
export async function encryptOpaqueToken(token: string) {
    const value = await encrypt(token)
    return {
        tokenCiphertext: value.tokenCiphertext,
        tokenIv: value.tokenIv,
        tokenKeyVersion: value.tokenKeyVersion,
    }
}
export async function decryptOpaqueToken(row: {
    tokenCiphertext: string
    tokenIv: string
    tokenKeyVersion: number
}) {
    if (row.tokenKeyVersion !== KEY_VERSION)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Token encryption version is unsupported"
        )
    const bytes = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: base64ToBytes(row.tokenIv) as unknown as ArrayBuffer,
        },
        await cryptoKey(),
        base64ToBytes(row.tokenCiphertext) as unknown as ArrayBuffer
    )
    return new TextDecoder().decode(bytes)
}
async function decrypt(row: Doc<"restaurantTables">): Promise<string> {
    if (row.tokenKeyVersion !== KEY_VERSION)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Token encryption version is unsupported"
        )
    const bytes = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: base64ToBytes(row.tokenIv) as unknown as ArrayBuffer,
        },
        await cryptoKey(),
        base64ToBytes(row.tokenCiphertext) as unknown as ArrayBuffer
    )
    return new TextDecoder().decode(bytes)
}
export function normalizeTableName(name: string): string {
    const value = name.trim()
    if (!value || value.length > 120)
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            "Table name is invalid"
        )
    return value
}
export function normalizeTableArea(area: string): string {
    const value = area.trim()
    if (!value || value.length > 120)
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            "Table area is invalid"
        )
    return value
}
export async function tableForOwner(
    ctx: DbCtx,
    tableId: Id<"restaurantTables">,
    mutate = false
) {
    const row = await ctx.db.get("restaurantTables", tableId)
    if (!row) throw expectedError(ERROR_CODES.NOT_FOUND, "Table not found")
    await requireActiveMembership(
        ctx,
        row.restaurantId,
        mutate ? "owner" : "member"
    )
    return row
}
export async function encryptTableToken(token: string) {
    return encrypt(token)
}
export async function decryptTableToken(row: Doc<"restaurantTables">) {
    return decrypt(row)
}
