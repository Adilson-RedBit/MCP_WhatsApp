/**
 * Save-time validation for flows.
 *
 * Run before activation (not on every draft save) — drafts are
 * intentionally allowed to be incomplete so users can save progress
 * mid-build. The builder calls these from BOTH client (so the user
 * sees issues live) and server (so a broken POST/PUT can't slip in
 * via direct API call).
 *
 * Three rule categories:
 *   1. Trigger sanity — keyword flows need keywords, etc.
 *   2. Graph integrity — entry node exists, all next_node_key
 *      references resolve, no unreachable nodes, non-terminal nodes
 *      have an outgoing edge.
 *   3. Meta API limits — button title ≤20 chars, ≤3 buttons per
 *      send_buttons, ≤10 list rows total, ≤24 chars per list row
 *      title. Mirrors the runtime checks inside
 *      `src/lib/whatsapp/meta-api.ts` so save-time and send-time
 *      can never disagree.
 *
 * Issues carry enough field info that the builder can highlight the
 * exact input that triggered them. Node-scoped issues include
 * `node_key`; trigger-scoped use `scope: 'trigger'`.
 */

import { INTERACTIVE_LIMITS } from "@/lib/whatsapp/meta-api";

export interface ValidationIssue {
  severity: "error" | "warning";
  scope: "flow" | "trigger" | "node";
  /** Stable node_key the issue is attached to, when scope === 'node'. */
  node_key?: string;
  /** Dotted path to the bad field, e.g. 'buttons.0.title'. */
  field?: string;
  message: string;
}

interface FlowInput {
  name: string;
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: Record<string, unknown>;
  entry_node_id: string | null;
}

interface NodeInput {
  node_key: string;
  node_type: string;
  config: Record<string, unknown>;
}

/** English fallback for validation messages when no `t` is supplied
 *  (e.g. unit tests, server routes without a request-scoped locale) —
 *  keeps the pre-i18n literal values as the default. */
const VALIDATE_FALLBACK: Record<string, string> = {
  "flow.validate.nameRequired": "Flow name is required.",
  "flow.validate.entryRequired": "Pick an entry node before activating.",
  "flow.validate.noNodes": "A flow needs at least one node before activation.",
  "flow.validate.entryNotFound": 'Entry node "{key}" doesn\'t exist.',
  "flow.validate.duplicateNodeKey": 'Duplicate node_key "{key}".',
  "flow.validate.unreachable": 'Node "{key}" is unreachable from the entry node.',
  "flow.validate.trigger.keywordRequired":
    "Keyword triggers need at least one keyword.",
  "flow.validate.trigger.blankKeywordsSingular":
    "{count} keyword is blank — it won't match anything.",
  "flow.validate.trigger.blankKeywordsPlural":
    "{count} keywords are blank — they won't match anything.",
  "flow.validate.start.needsNext": "Start node must point to a next node.",
  "flow.validate.start.nextNotFound":
    'Start points to non-existent node "{key}".',
  "flow.validate.sendMessage.needsText": "Send-message node needs a text body.",
  "flow.validate.sendMessage.needsNext":
    "Send-message node must point to a next node.",
  "flow.validate.sendMessage.nextNotFound":
    'Send-message points to non-existent node "{key}".',
  "flow.validate.sendMedia.needsType":
    "Send-media node needs a media type (image, video, or document).",
  "flow.validate.sendMedia.needsFile":
    "Send-media node needs a file (upload one before activating).",
  "flow.validate.sendMedia.captionTooLong":
    "Caption exceeds {limit} chars (WhatsApp limit).",
  "flow.validate.sendMedia.needsNext":
    "Send-media node must point to a next node.",
  "flow.validate.sendMedia.nextNotFound":
    'Send-media points to non-existent node "{key}".',
  "flow.validate.sendButtons.needsText": "Send-buttons node needs a text body.",
  "flow.validate.sendButtons.needsOne": "Send-buttons needs at least one button.",
  "flow.validate.sendButtons.tooMany":
    "WhatsApp allows at most {limit} buttons per message.",
  "flow.validate.sendButtons.needsReplyId": "Button {n} needs a reply id.",
  "flow.validate.sendButtons.dupReplyId": 'Duplicate button reply id "{id}".',
  "flow.validate.sendButtons.needsTitle": "Button {n} needs a title.",
  "flow.validate.sendButtons.titleTooLong":
    "Button {n} title is over {limit} chars (WhatsApp limit).",
  "flow.validate.sendButtons.needsNext": "Button {n} needs a next node.",
  "flow.validate.sendButtons.nextNotFound":
    'Button {n} points to non-existent node "{key}".',
  "flow.validate.sendList.needsText": "Send-list node needs a text body.",
  "flow.validate.sendList.needsButtonLabel":
    "Send-list needs a button label (the tap-to-expand text).",
  "flow.validate.sendList.needsOneRow": "Send-list needs at least one row.",
  "flow.validate.sendList.tooManyRows":
    "Send-list allows at most {limit} rows total across sections.",
  "flow.validate.sendList.rowNeedsReplyId":
    "Row {n} in section {section} needs a reply id.",
  "flow.validate.sendList.dupRowId": 'Duplicate list row id "{id}".',
  "flow.validate.sendList.rowNeedsTitle": "Row {n} needs a title.",
  "flow.validate.sendList.rowTitleTooLong": "Row {n} title exceeds {limit} chars.",
  "flow.validate.sendList.rowDescTooLong":
    "Row {n} description exceeds {limit} chars.",
  "flow.validate.sendList.rowNeedsNext": "Row {n} needs a next node.",
  "flow.validate.sendList.rowNextNotFound":
    'Row {n} points to non-existent node "{key}".',
  "flow.validate.collectInput.needsPrompt":
    "Collect-input needs a prompt to send the customer.",
  "flow.validate.collectInput.needsVarKey":
    "Collect-input needs a var_key to store the answer under.",
  "flow.validate.collectInput.badVarKey":
    'var_key "{key}" must be alphanumeric+underscore and start with a letter or underscore.',
  "flow.validate.collectInput.needsNext":
    "Collect-input must point to a next node.",
  "flow.validate.collectInput.nextNotFound":
    'Collect-input points to non-existent node "{key}".',
  "flow.validate.condition.needsSubject":
    "Condition needs a subject (var / tag / contact_field).",
  "flow.validate.condition.needsSubjectKey":
    "Condition needs a subject_key (var name, tag id, or field name).",
  "flow.validate.condition.needsOperator": "Condition needs an operator.",
  "flow.validate.condition.emptyValueWarning":
    'Operator "{operator}" usually expects a comparison value — empty value will only match empty subjects.',
  "flow.validate.condition.branchNeedsNode":
    'Condition needs a node for the "{branch}" branch.',
  "flow.validate.condition.branchNotFound":
    'Condition\'s "{branch}" points to non-existent node "{key}".',
  "flow.validate.condition.branchTrue": "true",
  "flow.validate.condition.branchFalse": "false",
  "flow.validate.setTag.needsMode": "Set-tag needs a mode (add or remove).",
  "flow.validate.setTag.needsTag": "Set-tag needs a tag to apply.",
  "flow.validate.setTag.needsNext": "Set-tag must point to a next node.",
  "flow.validate.setTag.nextNotFound":
    'Set-tag points to non-existent node "{key}".',
  "flow.validate.unknownNodeType": 'Unknown node type "{type}".',
};

function defaultValidateT(key: string): string {
  return VALIDATE_FALLBACK[key] ?? key;
}

export function validateFlowForActivation(
  flow: FlowInput,
  nodes: NodeInput[],
  t: (key: string) => string = defaultValidateT,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // ---- name ----
  if (!flow.name || !flow.name.trim()) {
    issues.push({
      severity: "error",
      scope: "flow",
      field: "name",
      message: t("flow.validate.nameRequired"),
    });
  }

  // ---- trigger ----
  issues.push(...validateTrigger(flow.trigger_type, flow.trigger_config, t));

  // ---- graph integrity ----
  if (!flow.entry_node_id) {
    issues.push({
      severity: "error",
      scope: "flow",
      field: "entry_node_id",
      message: t("flow.validate.entryRequired"),
    });
  }

  const keys = new Set(nodes.map((n) => n.node_key));
  if (nodes.length === 0) {
    issues.push({
      severity: "error",
      scope: "flow",
      message: t("flow.validate.noNodes"),
    });
  }

  if (flow.entry_node_id && !keys.has(flow.entry_node_id)) {
    issues.push({
      severity: "error",
      scope: "flow",
      field: "entry_node_id",
      message: t("flow.validate.entryNotFound").replace(
        "{key}",
        flow.entry_node_id,
      ),
    });
  }

  // Duplicate node_key (the DB UNIQUE constraint catches this on save
  // too, but surfacing it client-side gives a friendlier error path).
  const seen = new Set<string>();
  for (const n of nodes) {
    if (seen.has(n.node_key)) {
      issues.push({
        severity: "error",
        scope: "node",
        node_key: n.node_key,
        message: t("flow.validate.duplicateNodeKey").replace("{key}", n.node_key),
      });
    }
    seen.add(n.node_key);
  }

  // Per-node rules (Meta limits + dead-end + edge resolution).
  for (const n of nodes) {
    issues.push(...validateNode(n, keys, t));
  }

  // Reachability — every non-orphan node must be reachable from the
  // entry. Done after per-node validation so we don't double-report
  // when a node has bad config AND is unreachable.
  if (flow.entry_node_id && keys.has(flow.entry_node_id)) {
    const reached = reachableFromEntry(flow.entry_node_id, nodes);
    for (const n of nodes) {
      if (!reached.has(n.node_key)) {
        issues.push({
          severity: "warning",
          scope: "node",
          node_key: n.node_key,
          message: t("flow.validate.unreachable").replace("{key}", n.node_key),
        });
      }
    }
  }

  return issues;
}

// ============================================================
// Trigger
// ============================================================

function validateTrigger(
  trigger_type: FlowInput["trigger_type"],
  trigger_config: Record<string, unknown>,
  t: (key: string) => string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (trigger_type === "keyword") {
    const keywords = Array.isArray(trigger_config.keywords)
      ? (trigger_config.keywords as unknown[])
      : null;
    if (!keywords || keywords.length === 0) {
      issues.push({
        severity: "error",
        scope: "trigger",
        field: "trigger_config.keywords",
        message: t("flow.validate.trigger.keywordRequired"),
      });
    } else {
      // Empty / whitespace-only keywords are silent no-ops at match
      // time — call them out so the user doesn't think they configured
      // a keyword that never fires.
      const blanks = keywords.filter(
        (k) => typeof k !== "string" || !k.trim(),
      ).length;
      if (blanks > 0) {
        issues.push({
          severity: "warning",
          scope: "trigger",
          field: "trigger_config.keywords",
          message: t(
            blanks === 1
              ? "flow.validate.trigger.blankKeywordsSingular"
              : "flow.validate.trigger.blankKeywordsPlural",
          ).replace("{count}", String(blanks)),
        });
      }
    }
  }
  // first_inbound_message / manual have no config; nothing to validate.

  return issues;
}

// ============================================================
// Per-node
// ============================================================

function validateNode(
  node: NodeInput,
  knownKeys: Set<string>,
  t: (key: string) => string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  switch (node.node_type) {
    case "start": {
      const cfg = node.config as { next_node_key?: string };
      if (!cfg.next_node_key) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "next_node_key",
          message: t("flow.validate.start.needsNext"),
        });
      } else if (!knownKeys.has(cfg.next_node_key)) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "next_node_key",
          message: t("flow.validate.start.nextNotFound").replace(
            "{key}",
            cfg.next_node_key,
          ),
        });
      }
      break;
    }

    case "send_message": {
      const cfg = node.config as { text?: string; next_node_key?: string };
      if (!cfg.text?.trim()) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "text",
          message: t("flow.validate.sendMessage.needsText"),
        });
      }
      if (!cfg.next_node_key) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "next_node_key",
          message: t("flow.validate.sendMessage.needsNext"),
        });
      } else if (!knownKeys.has(cfg.next_node_key)) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "next_node_key",
          message: t("flow.validate.sendMessage.nextNotFound").replace(
            "{key}",
            cfg.next_node_key,
          ),
        });
      }
      break;
    }

    case "send_media": {
      const cfg = node.config as {
        media_type?: "image" | "video" | "document";
        media_url?: string;
        caption?: string;
        next_node_key?: string;
      };
      if (
        !cfg.media_type ||
        !["image", "video", "document"].includes(cfg.media_type)
      ) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "media_type",
          message: t("flow.validate.sendMedia.needsType"),
        });
      }
      if (!cfg.media_url?.trim()) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "media_url",
          message: t("flow.validate.sendMedia.needsFile"),
        });
      }
      // Caption cap mirrors Meta's interactive body cap; documented as a
      // hard limit in the WhatsApp Cloud API media-message reference.
      if (cfg.caption && cfg.caption.length > INTERACTIVE_LIMITS.bodyMaxLength) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "caption",
          message: t("flow.validate.sendMedia.captionTooLong").replace(
            "{limit}",
            String(INTERACTIVE_LIMITS.bodyMaxLength),
          ),
        });
      }
      if (!cfg.next_node_key) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "next_node_key",
          message: t("flow.validate.sendMedia.needsNext"),
        });
      } else if (!knownKeys.has(cfg.next_node_key)) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "next_node_key",
          message: t("flow.validate.sendMedia.nextNotFound").replace(
            "{key}",
            cfg.next_node_key,
          ),
        });
      }
      break;
    }

    case "send_buttons": {
      const cfg = node.config as {
        text?: string;
        buttons?: Array<{
          reply_id?: string;
          title?: string;
          next_node_key?: string;
        }>;
      };
      if (!cfg.text?.trim()) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "text",
          message: t("flow.validate.sendButtons.needsText"),
        });
      }
      const btns = cfg.buttons ?? [];
      if (btns.length < 1) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "buttons",
          message: t("flow.validate.sendButtons.needsOne"),
        });
      }
      if (btns.length > INTERACTIVE_LIMITS.maxButtons) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "buttons",
          message: t("flow.validate.sendButtons.tooMany").replace(
            "{limit}",
            String(INTERACTIVE_LIMITS.maxButtons),
          ),
        });
      }
      const seenIds = new Set<string>();
      btns.forEach((b, i) => {
        const field = `buttons.${i}`;
        if (!b.reply_id?.trim()) {
          issues.push({
            severity: "error",
            scope: "node",
            node_key: node.node_key,
            field: `${field}.reply_id`,
            message: t("flow.validate.sendButtons.needsReplyId").replace(
              "{n}",
              String(i + 1),
            ),
          });
        } else if (seenIds.has(b.reply_id)) {
          issues.push({
            severity: "error",
            scope: "node",
            node_key: node.node_key,
            field: `${field}.reply_id`,
            message: t("flow.validate.sendButtons.dupReplyId").replace(
              "{id}",
              b.reply_id,
            ),
          });
        }
        if (b.reply_id) seenIds.add(b.reply_id);

        if (!b.title?.trim()) {
          issues.push({
            severity: "error",
            scope: "node",
            node_key: node.node_key,
            field: `${field}.title`,
            message: t("flow.validate.sendButtons.needsTitle").replace(
              "{n}",
              String(i + 1),
            ),
          });
        } else if (b.title.length > INTERACTIVE_LIMITS.buttonTitleMaxLength) {
          issues.push({
            severity: "error",
            scope: "node",
            node_key: node.node_key,
            field: `${field}.title`,
            message: t("flow.validate.sendButtons.titleTooLong")
              .replace("{n}", String(i + 1))
              .replace("{limit}", String(INTERACTIVE_LIMITS.buttonTitleMaxLength)),
          });
        }

        if (!b.next_node_key) {
          issues.push({
            severity: "error",
            scope: "node",
            node_key: node.node_key,
            field: `${field}.next_node_key`,
            message: t("flow.validate.sendButtons.needsNext").replace(
              "{n}",
              String(i + 1),
            ),
          });
        } else if (!knownKeys.has(b.next_node_key)) {
          issues.push({
            severity: "error",
            scope: "node",
            node_key: node.node_key,
            field: `${field}.next_node_key`,
            message: t("flow.validate.sendButtons.nextNotFound")
              .replace("{n}", String(i + 1))
              .replace("{key}", b.next_node_key),
          });
        }
      });
      break;
    }

    case "send_list": {
      const cfg = node.config as {
        text?: string;
        button_label?: string;
        sections?: Array<{
          title?: string;
          rows?: Array<{
            reply_id?: string;
            title?: string;
            description?: string;
            next_node_key?: string;
          }>;
        }>;
      };
      if (!cfg.text?.trim()) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "text",
          message: t("flow.validate.sendList.needsText"),
        });
      }
      if (!cfg.button_label?.trim()) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "button_label",
          message: t("flow.validate.sendList.needsButtonLabel"),
        });
      }
      const sections = cfg.sections ?? [];
      const totalRows = sections.reduce(
        (sum, s) => sum + (s.rows?.length ?? 0),
        0,
      );
      if (totalRows < 1) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "sections",
          message: t("flow.validate.sendList.needsOneRow"),
        });
      }
      if (totalRows > INTERACTIVE_LIMITS.maxListRowsTotal) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "sections",
          message: t("flow.validate.sendList.tooManyRows").replace(
            "{limit}",
            String(INTERACTIVE_LIMITS.maxListRowsTotal),
          ),
        });
      }
      const seenIds = new Set<string>();
      sections.forEach((section, si) => {
        const rows = section.rows ?? [];
        rows.forEach((row, ri) => {
          const field = `sections.${si}.rows.${ri}`;
          if (!row.reply_id?.trim()) {
            issues.push({
              severity: "error",
              scope: "node",
              node_key: node.node_key,
              field: `${field}.reply_id`,
              message: t("flow.validate.sendList.rowNeedsReplyId")
                .replace("{n}", String(ri + 1))
                .replace("{section}", String(si + 1)),
            });
          } else if (seenIds.has(row.reply_id)) {
            issues.push({
              severity: "error",
              scope: "node",
              node_key: node.node_key,
              field: `${field}.reply_id`,
              message: t("flow.validate.sendList.dupRowId").replace(
                "{id}",
                row.reply_id,
              ),
            });
          }
          if (row.reply_id) seenIds.add(row.reply_id);

          if (!row.title?.trim()) {
            issues.push({
              severity: "error",
              scope: "node",
              node_key: node.node_key,
              field: `${field}.title`,
              message: t("flow.validate.sendList.rowNeedsTitle").replace(
                "{n}",
                String(ri + 1),
              ),
            });
          } else if (
            row.title.length > INTERACTIVE_LIMITS.listRowTitleMaxLength
          ) {
            issues.push({
              severity: "error",
              scope: "node",
              node_key: node.node_key,
              field: `${field}.title`,
              message: t("flow.validate.sendList.rowTitleTooLong")
                .replace("{n}", String(ri + 1))
                .replace("{limit}", String(INTERACTIVE_LIMITS.listRowTitleMaxLength)),
            });
          }
          if (
            row.description &&
            row.description.length >
              INTERACTIVE_LIMITS.listRowDescriptionMaxLength
          ) {
            issues.push({
              severity: "error",
              scope: "node",
              node_key: node.node_key,
              field: `${field}.description`,
              message: t("flow.validate.sendList.rowDescTooLong")
                .replace("{n}", String(ri + 1))
                .replace(
                  "{limit}",
                  String(INTERACTIVE_LIMITS.listRowDescriptionMaxLength),
                ),
            });
          }
          if (!row.next_node_key) {
            issues.push({
              severity: "error",
              scope: "node",
              node_key: node.node_key,
              field: `${field}.next_node_key`,
              message: t("flow.validate.sendList.rowNeedsNext").replace(
                "{n}",
                String(ri + 1),
              ),
            });
          } else if (!knownKeys.has(row.next_node_key)) {
            issues.push({
              severity: "error",
              scope: "node",
              node_key: node.node_key,
              field: `${field}.next_node_key`,
              message: t("flow.validate.sendList.rowNextNotFound")
                .replace("{n}", String(ri + 1))
                .replace("{key}", row.next_node_key),
            });
          }
        });
      });
      break;
    }

    case "collect_input": {
      const cfg = node.config as {
        prompt_text?: string;
        var_key?: string;
        next_node_key?: string;
      };
      if (!cfg.prompt_text?.trim()) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "prompt_text",
          message: t("flow.validate.collectInput.needsPrompt"),
        });
      }
      if (!cfg.var_key?.trim()) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "var_key",
          message: t("flow.validate.collectInput.needsVarKey"),
        });
      } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(cfg.var_key)) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "var_key",
          message: t("flow.validate.collectInput.badVarKey").replace(
            "{key}",
            cfg.var_key,
          ),
        });
      }
      if (!cfg.next_node_key) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "next_node_key",
          message: t("flow.validate.collectInput.needsNext"),
        });
      } else if (!knownKeys.has(cfg.next_node_key)) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "next_node_key",
          message: t("flow.validate.collectInput.nextNotFound").replace(
            "{key}",
            cfg.next_node_key,
          ),
        });
      }
      break;
    }

    case "condition": {
      const cfg = node.config as {
        subject?: "var" | "tag" | "contact_field";
        subject_key?: string;
        operator?: "equals" | "contains" | "present" | "absent";
        value?: string;
        true_next?: string;
        false_next?: string;
      };
      if (!cfg.subject || !["var", "tag", "contact_field"].includes(cfg.subject)) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "subject",
          message: t("flow.validate.condition.needsSubject"),
        });
      }
      if (!cfg.subject_key?.trim()) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "subject_key",
          message: t("flow.validate.condition.needsSubjectKey"),
        });
      }
      if (
        !cfg.operator ||
        !["equals", "contains", "present", "absent"].includes(cfg.operator)
      ) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "operator",
          message: t("flow.validate.condition.needsOperator"),
        });
      } else if (
        (cfg.operator === "equals" || cfg.operator === "contains") &&
        (cfg.value === undefined || cfg.value === "")
      ) {
        issues.push({
          severity: "warning",
          scope: "node",
          node_key: node.node_key,
          field: "value",
          message: t("flow.validate.condition.emptyValueWarning").replace(
            "{operator}",
            cfg.operator,
          ),
        });
      }
      for (const branch of ["true_next", "false_next"] as const) {
        const key = cfg[branch];
        const branchWord =
          branch === "true_next"
            ? t("flow.validate.condition.branchTrue")
            : t("flow.validate.condition.branchFalse");
        if (!key) {
          issues.push({
            severity: "error",
            scope: "node",
            node_key: node.node_key,
            field: branch,
            message: t("flow.validate.condition.branchNeedsNode").replace(
              "{branch}",
              branchWord,
            ),
          });
        } else if (!knownKeys.has(key)) {
          issues.push({
            severity: "error",
            scope: "node",
            node_key: node.node_key,
            field: branch,
            message: t("flow.validate.condition.branchNotFound")
              .replace("{branch}", branch)
              .replace("{key}", key),
          });
        }
      }
      break;
    }

    case "set_tag": {
      const cfg = node.config as {
        mode?: "add" | "remove";
        tag_id?: string;
        next_node_key?: string;
      };
      if (!cfg.mode || !["add", "remove"].includes(cfg.mode)) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "mode",
          message: t("flow.validate.setTag.needsMode"),
        });
      }
      if (!cfg.tag_id) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "tag_id",
          message: t("flow.validate.setTag.needsTag"),
        });
      }
      if (!cfg.next_node_key) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "next_node_key",
          message: t("flow.validate.setTag.needsNext"),
        });
      } else if (!knownKeys.has(cfg.next_node_key)) {
        issues.push({
          severity: "error",
          scope: "node",
          node_key: node.node_key,
          field: "next_node_key",
          message: t("flow.validate.setTag.nextNotFound").replace(
            "{key}",
            cfg.next_node_key,
          ),
        });
      }
      break;
    }

    case "handoff":
    case "end":
      // Terminal nodes have no outgoing edges; nothing to validate
      // beyond their existence.
      break;

    default:
      issues.push({
        severity: "error",
        scope: "node",
        node_key: node.node_key,
        message: t("flow.validate.unknownNodeType").replace(
          "{type}",
          node.node_type,
        ),
      });
  }

  return issues;
}

// ============================================================
// Reachability — BFS from the entry, follow outgoing edges per node
// ============================================================

export function reachableFromEntry(
  entryKey: string,
  nodes: NodeInput[],
): Set<string> {
  const byKey = new Map<string, NodeInput>();
  for (const n of nodes) byKey.set(n.node_key, n);

  const visited = new Set<string>();
  const queue: string[] = [entryKey];
  while (queue.length > 0) {
    const key = queue.shift() as string;
    if (visited.has(key)) continue;
    visited.add(key);
    const node = byKey.get(key);
    if (!node) continue;
    for (const next of outgoingEdges(node)) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
}

function outgoingEdges(node: NodeInput): string[] {
  switch (node.node_type) {
    case "start":
    case "send_message":
    case "send_media":
    case "collect_input":
    case "set_tag": {
      const cfg = node.config as { next_node_key?: string };
      return cfg.next_node_key ? [cfg.next_node_key] : [];
    }
    case "condition": {
      const cfg = node.config as {
        true_next?: string;
        false_next?: string;
      };
      const out: string[] = [];
      if (cfg.true_next) out.push(cfg.true_next);
      if (cfg.false_next) out.push(cfg.false_next);
      return out;
    }
    case "send_buttons": {
      const cfg = node.config as {
        buttons?: Array<{ next_node_key?: string }>;
      };
      return (cfg.buttons ?? [])
        .map((b) => b.next_node_key)
        .filter((k): k is string => !!k);
    }
    case "send_list": {
      const cfg = node.config as {
        sections?: Array<{ rows?: Array<{ next_node_key?: string }> }>;
      };
      const out: string[] = [];
      for (const s of cfg.sections ?? []) {
        for (const r of s.rows ?? []) {
          if (r.next_node_key) out.push(r.next_node_key);
        }
      }
      return out;
    }
    case "handoff":
    case "end":
    default:
      return [];
  }
}
