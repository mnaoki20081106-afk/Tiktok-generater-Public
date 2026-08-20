/** ADMIN_EMAILS(カンマ区切り)に含まれるメールアドレスかどうかを判定する */
export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && adminEmails.includes(email.toLowerCase());
}
