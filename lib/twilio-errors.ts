const TWILIO_ERROR_MAP: Record<string, string> = {
  '30001': 'Twilioのキュー容量超過。時間をおいて再送してください',
  '30002': 'Twilioアカウントが停止されています',
  '30003': '宛先に到達できません（電源OFF/圏外の可能性）',
  '30004': 'メッセージがブロックされました（キャリアまたは受信者の設定）',
  '30005': '電話番号が存在しないか解約済みです',
  '30006': '固定電話または到達不能なキャリアです',
  '30007': 'キャリアのポリシー違反（メッセージ内容が拒否された可能性）',
  '30008': 'キャリアが配信を拒否しました（海外SMS受信拒否/スパムフィルタの可能性）',
  '30009': 'メッセージの一部が欠落しました',
  '30010': '送信料金が上限を超えています',
  '30034': 'メッセージのフィルタリングにより拒否されました',
  '21211': '無効な電話番号形式です',
  '21214': 'トライアルアカウントの検証済み番号ではありません',
  '21608': '未検証の電話番号への送信は許可されていません（トライアル制限）',
}

export function describeTwilioError(errorCode: string | number | null | undefined, fallback?: string): string {
  if (!errorCode) return fallback || '不明なエラー'
  const code = String(errorCode)
  return TWILIO_ERROR_MAP[code] || `Twilioエラー ${code}${fallback ? `: ${fallback}` : ''}`
}
