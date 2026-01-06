import Twilio from 'twilio'

let twilioClient: Twilio.Twilio | null = null

function getClient(): Twilio.Twilio {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials are not configured')
    }

    twilioClient = Twilio(accountSid, authToken)
  }

  return twilioClient
}

export function normalizePhoneNumber(phone: string): string {
  // 数字以外を除去
  const digits = phone.replace(/\D/g, '')

  // 先頭の0を+81に置換（日本の国番号）
  if (digits.startsWith('0')) {
    return '+81' + digits.slice(1)
  }

  // 既に81始まりなら+を付けるだけ
  if (digits.startsWith('81')) {
    return '+' + digits
  }

  return '+' + digits
}

export function validatePhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone)
  // 日本の携帯電話番号: +81 + 90/80/70 + 8桁
  return /^\+81[789]0\d{8}$/.test(normalized)
}

export interface SendSmsResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendSms(to: string, message: string): Promise<SendSmsResult> {
  try {
    const client = getClient()
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!fromNumber) {
      throw new Error('TWILIO_PHONE_NUMBER is not configured')
    }

    const normalizedTo = normalizePhoneNumber(to)

    if (!validatePhoneNumber(to)) {
      return {
        success: false,
        error: `無効な電話番号形式: ${to}`,
      }
    }

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: normalizedTo,
    })

    return {
      success: true,
      messageId: result.sid,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '不明なエラー'
    return {
      success: false,
      error: errorMessage,
    }
  }
}
