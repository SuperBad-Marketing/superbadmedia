/**
 * Branded HTML email wrapper. Wraps body content in a SuperBad-branded
 * shell with header wordmark, tagline, and footer. Applied at the
 * transport layer in sendEmail() so all outbound email gets consistent
 * branding.
 */

export function wrapEmailHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>SuperBad</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif !important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#1a1a18;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#FDF5E6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1a18;">
    <tr>
      <td align="center" style="padding:40px 16px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <!-- Header -->
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <p style="margin:0 0 6px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;font-weight:800;letter-spacing:6px;text-transform:uppercase;color:#FDF5E6;">SUPERBAD</p>
              <p style="margin:0;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:9px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#F4A0B0;">MARKETING THAT DOESN'T APOLOGISE</p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid rgba(253,245,230,0.12);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 8px 32px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.65;color:#e8e0d0;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer divider -->
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid rgba(253,245,230,0.08);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="text-align:center;padding:0 0 8px;">
              <p style="margin:0 0 4px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(253,245,230,0.35);">SUPERBAD</p>
              <p style="margin:0;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:11px;color:rgba(253,245,230,0.25);line-height:1.5;">Melbourne</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
