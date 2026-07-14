// ============================================================
// POST /api/prospecting/import
//
// Importa candidatos selecionados como contatos no CRM e
// opcionalmente dispara mensagens WhatsApp e/ou email.
//
// O disparo WhatsApp é feito DIRETO via Meta API (mesmo caminho
// do /broadcast) — nunca via fetch interno para /api/whatsapp/send,
// que exigiria cookies de sessão e payload de conversa.
// ============================================================

import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { sendEmail, buildProspectingEmailHtml } from "@/lib/resend";
import { sendTextMessage } from "@/lib/whatsapp/meta-api";
import { decrypt } from "@/lib/whatsapp/encryption";
import {
  normalizeBrazilPhone,
  phoneVariants,
  isRecipientNotAllowedError,
} from "@/lib/whatsapp/phone-utils";

interface ImportPayload {
  candidateIds: string[];
  pipelineId?: string;
  sendWhatsapp: boolean;
  sendEmailMsg: boolean;
  whatsappMessage?: string;
  emailSubject?: string;
  emailMessage?: string;
  senderName?: string;
}

interface ImportResult {
  id: string;
  name: string;
  contactId?: string;
  whatsapp?: "sent" | "failed" | "no_phone";
  email?: "sent" | "failed" | "no_email";
  error?: string;
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("agent");

    const body = (await request.json()) as ImportPayload;
    const {
      candidateIds,
      pipelineId,
      sendWhatsapp,
      sendEmailMsg,
      whatsappMessage,
      emailSubject,
      emailMessage,
      senderName = "Equipe RedBit CRM",
    } = body;

    if (!candidateIds?.length) {
      return NextResponse.json(
        { error: "Selecione ao menos um candidato." },
        { status: 400 }
      );
    }

    // Busca os candidatos
    const { data: candidates, error: candErr } = await ctx.supabase
      .from("lead_candidates")
      .select("*")
      .in("id", candidateIds)
      .eq("account_id", ctx.accountId)
      .eq("imported", false);

    if (candErr) throw candErr;
    if (!candidates?.length) {
      return NextResponse.json(
        { error: "Nenhum candidato válido encontrado." },
        { status: 404 }
      );
    }

    // Config WhatsApp da conta — carregada uma única vez, apenas se
    // o disparo estiver habilitado. Falta de config não bloqueia a
    // importação; os disparos ficam marcados como "failed".
    let waConfig: { phone_number_id: string; accessToken: string } | null = null;
    let waConfigError: string | null = null;
    if (sendWhatsapp && whatsappMessage) {
      const { data: config } = await ctx.supabase
        .from("whatsapp_config")
        .select("*")
        .eq("account_id", ctx.accountId)
        .single();
      if (config) {
        try {
          waConfig = {
            phone_number_id: config.phone_number_id,
            accessToken: decrypt(config.access_token),
          };
        } catch {
          waConfigError = "Falha ao descriptografar o token do WhatsApp.";
        }
      } else {
        waConfigError =
          "WhatsApp não configurado — os leads foram importados sem disparo.";
      }
    }

    const results: ImportResult[] = [];

    for (const candidate of candidates) {
      try {
        // Normaliza telefone BR para E.164 (55 + DDD + número)
        const normalizedPhone = candidate.phone
          ? normalizeBrazilPhone(candidate.phone) ?? candidate.phone.replace(/\D/g, "")
          : null;

        // 1. Cria contato — schema: contacts(name, phone NOT NULL, email,
        // company). Não existe coluna "notes"; detalhes vão para a tabela
        // contact_notes logo abaixo.
        let contact: { id: string } | null = null;
        let alreadyExisted = false;

        const { data: created, error: contactErr } = await ctx.supabase
          .from("contacts")
          .insert({
            account_id: ctx.accountId,
            user_id: ctx.userId,
            name: candidate.name,
            phone: normalizedPhone ?? "",
            email: candidate.email ?? null,
            company: candidate.name,
          })
          .select("id")
          .single();

        if (contactErr) {
          // 23505 = telefone já cadastrado nesta conta (índice único de
          // migration 022). Reaproveita o contato existente em vez de falhar.
          if (contactErr.code === "23505" && normalizedPhone) {
            const { data: existing } = await ctx.supabase
              .from("contacts")
              .select("id")
              .eq("account_id", ctx.accountId)
              .eq("phone_normalized", normalizedPhone)
              .maybeSingle();
            if (existing) {
              contact = existing;
              alreadyExisted = true;
            }
          }
          if (!contact) throw contactErr;
        } else {
          contact = created;
        }
        if (!contact) throw new Error("Falha ao criar contato");

        // 1b. Nota com os detalhes do Google (apenas para contatos novos)
        if (!alreadyExisted) {
          const noteText = [
            candidate.address ? `Endereço: ${candidate.address}` : null,
            candidate.website ? `Site: ${candidate.website}` : null,
            candidate.category ? `Categoria: ${candidate.category}` : null,
            candidate.rating ? `Avaliação Google: ${candidate.rating}` : null,
            "Origem: Prospecção Ativa (Google Places)",
          ]
            .filter(Boolean)
            .join("\n");

          await ctx.supabase.from("contact_notes").insert({
            contact_id: contact.id,
            user_id: ctx.userId,
            note_text: noteText,
          });
        }

        const result: ImportResult = {
          id: candidate.id,
          name: candidate.name,
          contactId: contact.id,
        };

        // 2. Adiciona ao pipeline (se informado)
        if (pipelineId && contact) {
          const { data: columns } = await ctx.supabase
            .from("pipeline_columns")
            .select("id")
            .eq("pipeline_id", pipelineId)
            .order("position", { ascending: true })
            .limit(1);

          if (columns?.length) {
            await ctx.supabase.from("pipeline_cards").insert({
              account_id: ctx.accountId,
              pipeline_id: pipelineId,
              column_id: columns[0].id,
              contact_id: contact.id,
              title: candidate.name,
            });
          }
        }

        // 3. Disparo WhatsApp — direto via Meta API
        if (sendWhatsapp && whatsappMessage) {
          if (!normalizedPhone) {
            result.whatsapp = "no_phone";
          } else if (!waConfig) {
            result.whatsapp = "failed";
          } else {
            const text = whatsappMessage.replace(/\{\{\s*nome\s*\}\}/gi, candidate.name);
            let waMessageId: string | null = null;

            for (const variant of phoneVariants(normalizedPhone)) {
              try {
                const sent = await sendTextMessage({
                  phoneNumberId: waConfig.phone_number_id,
                  accessToken: waConfig.accessToken,
                  to: variant,
                  text,
                });
                waMessageId = sent.messageId;
                break;
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (!isRecipientNotAllowedError(msg)) break;
                // tenta a próxima variante (prefixo de tronco 0)
              }
            }

            if (waMessageId) {
              result.whatsapp = "sent";

              await ctx.supabase
                .from("lead_candidates")
                .update({
                  whatsapp_sent: true,
                  whatsapp_sent_at: new Date().toISOString(),
                })
                .eq("id", candidate.id);

              // Registra conversa + mensagem para aparecer na Caixa
              // de Entrada. Best-effort: falha aqui não desfaz o envio.
              try {
                const { data: existingConv } = await ctx.supabase
                  .from("conversations")
                  .select("id")
                  .eq("account_id", ctx.accountId)
                  .eq("contact_id", contact.id)
                  .maybeSingle();

                let conversationId = existingConv?.id as string | undefined;
                if (!conversationId) {
                  const { data: newConv } = await ctx.supabase
                    .from("conversations")
                    .insert({
                      account_id: ctx.accountId,
                      user_id: ctx.userId,
                      contact_id: contact.id,
                    })
                    .select("id")
                    .single();
                  conversationId = newConv?.id;
                }

                if (conversationId) {
                  await ctx.supabase.from("messages").insert({
                    conversation_id: conversationId,
                    sender_type: "agent",
                    content_type: "text",
                    content_text: text,
                    message_id: waMessageId,
                    status: "sent",
                  });
                  await ctx.supabase
                    .from("conversations")
                    .update({
                      last_message_text: text,
                      last_message_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", conversationId);
                }
              } catch (convErr) {
                console.error(
                  "[prospecting/import] falha ao registrar conversa:",
                  convErr instanceof Error ? convErr.message : convErr
                );
              }
            } else {
              result.whatsapp = "failed";
            }
          }
        }

        // 4. Disparo email (se habilitado e tem email)
        if (sendEmailMsg && emailMessage) {
          if (!candidate.email) {
            result.email = "no_email";
          } else {
            try {
              await sendEmail({
                to: candidate.email,
                subject: emailSubject ?? "Olá! Gostaríamos de nos apresentar",
                html: buildProspectingEmailHtml({
                  businessName: candidate.name,
                  senderName,
                  message: emailMessage.replace(
                    /\{\{\s*nome\s*\}\}/gi,
                    candidate.name
                  ),
                  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
                }),
              });
              result.email = "sent";

              await ctx.supabase
                .from("lead_candidates")
                .update({
                  email_sent: true,
                  email_sent_at: new Date().toISOString(),
                })
                .eq("id", candidate.id);
            } catch (err) {
              console.error(
                "[prospecting/import] falha no envio de email:",
                err instanceof Error ? err.message : err
              );
              result.email = "failed";
            }
          }
        }

        // 5. Marca como importado
        await ctx.supabase
          .from("lead_candidates")
          .update({ imported: true, contact_id: contact.id })
          .eq("id", candidate.id);

        // Atualiza contador da busca
        await ctx.supabase.rpc("increment_imported_count", {
          p_search_id: candidate.search_id,
        });

        results.push(result);
      } catch (err) {
        results.push({
          id: candidate.id,
          name: candidate.name,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    }

    const imported = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;
    const whatsappSent = results.filter((r) => r.whatsapp === "sent").length;
    const whatsappFailed = results.filter((r) => r.whatsapp === "failed").length;
    const emailSent = results.filter((r) => r.email === "sent").length;

    return NextResponse.json({
      imported,
      failed,
      whatsappSent,
      whatsappFailed,
      emailSent,
      warning: waConfigError,
      results,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
