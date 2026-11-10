/** Branded HTML + plain-text bodies for password-reset emails. */

const COLORS = {
  espresso: '#2F1B10',
  roast: '#6F4E37',
  honey: '#C4A484',
  cream: '#F7F1E8',
  parchment: '#FFFBF5',
  muted: '#746355',
  border: '#E0D3C2',
  white: '#FFFFFF',
} as const;

export function buildPasswordResetEmail(opts: {
  fullName: string;
  resetUrl: string;
  minutes: number;
}) {
  const name = opts.fullName?.trim() || 'there';
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(opts.resetUrl);
  const minutes = opts.minutes;

  const subject = 'Reset your Efnan Business password';

  const text = [
    `Hello ${name},`,
    '',
    'We received a request to reset your Efnan Business password.',
    '',
    `Click the link below (or copy it into your browser) within ${minutes} minutes:`,
    opts.resetUrl,
    '',
    'If you did not request this, you can ignore this email. Your password will stay the same.',
    '',
    '— Efnan Business',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.cream};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.cream};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${COLORS.parchment};border-radius:16px;overflow:hidden;border:1px solid ${COLORS.border};box-shadow:0 8px 24px rgba(47,27,16,0.08);">
          <tr>
            <td style="background:linear-gradient(160deg, ${COLORS.espresso} 0%, #3d2416 45%, ${COLORS.roast} 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.honey};">Efnan Business</p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:${COLORS.white};">Password reset</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;color:${COLORS.espresso};">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hello <strong>${safeName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${COLORS.muted};">
                We received a request to reset your password for your Efnan Business account.
                Use the button below to choose a new password.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 32px 24px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" stroke="f" fillcolor="${COLORS.roast}">
                <w:anchorlock/>
                <center style="color:${COLORS.white};font-family:Segoe UI,sans-serif;font-size:15px;font-weight:700;">
                  Reset your password
                </center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${safeUrl}"
                 style="display:inline-block;background-color:${COLORS.roast};color:${COLORS.white};font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.01em;mso-hide:all;">
                Reset your password
              </a>
              <!--<![endif]-->
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.cream};border-radius:10px;border:1px solid ${COLORS.border};">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;line-height:1.5;color:${COLORS.muted};">
                    This link expires in <strong style="color:${COLORS.espresso};">${minutes} minutes</strong>.
                    For your security, it can only be used once.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${COLORS.muted};">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="${safeUrl}" style="color:${COLORS.roast};text-decoration:underline;">${safeUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;border-top:1px solid ${COLORS.border};">
              <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:${COLORS.muted};">
                If you did not request a password reset, you can safely ignore this email.
                Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:${COLORS.espresso};padding:18px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.honey};">
                © ${new Date().getFullYear()} Efnan Business
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:rgba(196,164,132,0.75);">
                Stock &amp; warehouse management
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
