/**
 * Branded HTML email wrapper. Wraps body content in a SuperBad-branded
 * shell with header wordmark and footer. Applied at the transport layer
 * in sendEmail() so all outbound email gets consistent branding.
 */

export function wrapEmailHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>SuperBad</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif !important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#FDF5E6;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#1a1a1a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF5E6;">
    <tr>
      <td align="center" style="padding:32px 16px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a18;padding:20px 32px;text-align:center;border-radius:8px 8px 0 0;">
              <span style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13px;font-weight:800;letter-spacing:5px;text-transform:uppercase;color:#FDF5E6;">SUPERBAD</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:32px 32px 28px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#ffffff;padding:0 32px 24px;border-radius:0 0 8px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e8e0d0;padding-top:16px;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#999;line-height:1.5;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;">SuperBad Marketing &middot; Melbourne</p>
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
