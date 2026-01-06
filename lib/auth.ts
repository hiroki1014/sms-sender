import { cookies } from 'next/headers'

const AUTH_COOKIE_NAME = 'sms_sender_auth'
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24時間

export function verifyPassword(password: string): boolean {
  const correctPassword = process.env.AUTH_PASSWORD
  if (!correctPassword) {
    console.error('AUTH_PASSWORD is not set')
    return false
  }
  return password === correctPassword
}

export async function setAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAME, 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE_NAME)
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)
  return authCookie?.value === 'authenticated'
}
