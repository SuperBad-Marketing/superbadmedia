/**
 * Branded HTML email wrapper. Wraps body content in a SuperBad-branded
 * shell with header wordmark and footer. Applied at the transport layer
 * in sendEmail() so all outbound email gets consistent branding.
 *
 * Pass `preheader` to control the preview text email clients show in
 * the inbox list. Without it, clients fall back to the first visible
 * text (the wordmark).
 */

export function wrapEmailHtml(bodyHtml: string, preheader?: string): string {
  const preheaderBlock = preheader
    ? `<div style="display:none;font-size:1px;color:#1a1a18;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}${"&zwnj;&nbsp;".repeat(40)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark light" />
  <meta name="supported-color-schemes" content="dark light" />
  <title>SuperBad</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif !important;}</style>
  <![endif]-->
  <style>
    :root { color-scheme: dark light; }
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1a1a18 !important; }
    }
    a { color: #B22848; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#1a1a18;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#FDF5E6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${preheaderBlock}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1a18;">
    <tr>
      <td align="center" style="padding:48px 20px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <!-- Header -->
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <p style="margin:0;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:12px;font-weight:800;letter-spacing:8px;text-transform:uppercase;color:rgba(253,245,230,0.4);">SUPERBAD</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 0 40px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:#e8e0d0;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:0 0 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="32" style="width:32px;">
                      <tr>
                        <td style="border-top:1px solid rgba(253,245,230,0.08);font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="text-align:center;padding:0 0 8px;">
                    <p style="margin:0;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:11px;color:rgba(253,245,230,0.2);line-height:1.8;"><a href="https://superbadmedia.com.au" style="color:rgba(253,245,230,0.25);text-decoration:none;">superbadmedia.com.au</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;Melbourne</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
