// ============================================================
// Resend — envio de emails transacionais
//
// Docs: https://resend.com/docs/api-reference/emails/send-email
//
// Variáveis de ambiente necessárias:
//   RESEND_API_KEY=re_xxxxxxxxxxxx
//   RESEND_FROM_EMAIL=crm@seudominio.com.br   (domínio verificado no Resend)
// ============================================================

const RESEND_API = "https://api.resend.com/emails";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendEmailResult {
  id: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "RedBit CRM <noreply@redbitcrm.com>";

  if (!apiKey) throw new Error("RESEND_API_KEY não configurada");

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<SendEmailResult>;
}

// ── Template de email de prospecção ──────────────────────────

export function buildProspectingEmailHtml({
  businessName,
  senderName,
  message,
  siteUrl,
}: {
  businessName: string;
  senderName: string;
  message: string;
  siteUrl?: string;
}): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const escapedMessage = escapeHtml(message).replace(/\n/g, "<br>");
  const escapedBusinessName = escapeHtml(businessName);
  const escapedSenderName = escapeHtml(senderName);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mensagem via RedBit CRM</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <!-- Header -->
          <tr>
            <td style="background:#25D366;padding:24px 32px;">
              <span style="color:#fff;font-size:20px;font-weight:bold;">RedBit CRM</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#111;">Olá, <strong>${escapedBusinessName}</strong>!</p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${escapedMessage}</p>
              <p style="margin:0;font-size:14px;color:#6b7280;">
                Atenciosamente,<br/>
                <strong>${escapedSenderName}</strong>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                Enviado via RedBit CRM${siteUrl ? ` · <a href="${siteUrl}" style="color:#25D366;">${siteUrl}</a>` : ""}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
