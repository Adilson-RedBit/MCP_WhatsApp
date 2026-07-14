"use client";

import { useState } from "react";
import { useLocale } from "@/hooks/use-locale";
import {
  Search,
  MapPin,
  Phone,
  Globe,
  Star,
  Mail,
  MessageSquare,
  Download,
  Loader2,
  CheckCircle2,
  Building2,
  History,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Constantes ───────────────────────────────────────────────

const ESTADOS = [
  { uf: "AC", nome: "Acre" },
  { uf: "AL", nome: "Alagoas" },
  { uf: "AM", nome: "Amazonas" },
  { uf: "AP", nome: "Amapá" },
  { uf: "BA", nome: "Bahia" },
  { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" },
  { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" },
  { uf: "MG", nome: "Minas Gerais" },
  { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MT", nome: "Mato Grosso" },
  { uf: "PA", nome: "Pará" },
  { uf: "PB", nome: "Paraíba" },
  { uf: "PE", nome: "Pernambuco" },
  { uf: "PI", nome: "Piauí" },
  { uf: "PR", nome: "Paraná" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RO", nome: "Rondônia" },
  { uf: "RR", nome: "Roraima" },
  { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "SC", nome: "Santa Catarina" },
  { uf: "SE", nome: "Sergipe" },
  { uf: "SP", nome: "São Paulo" },
  { uf: "TO", nome: "Tocantins" },
];

const RAIOS = [
  { value: "5", label: "5 km" },
  { value: "10", label: "10 km" },
  { value: "20", label: "20 km" },
  { value: "50", label: "50 km" },
];

// ── Tipos ────────────────────────────────────────────────────

interface Candidate {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  rating: number | null;
  category: string | null;
  imported: boolean;
}

interface SearchHistoryItem {
  id: string;
  query: string;
  location: string | null;
  total_found: number;
  imported_count: number;
  created_at: string;
}

interface ImportStats {
  imported: number;
  failed: number;
  whatsappSent: number;
  whatsappFailed: number;
  emailSent: number;
  warning: string | null;
  firstError: string | null;
}

// ── Componente principal ──────────────────────────────────────

export default function ProspeccaoPage() {
  const { t } = useLocale();

  // Formulário de busca
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState("10");

  // Resultados
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Modal de importação
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportStats | null>(null);

  // Histórico de buscas
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Opções de disparo
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [sendEmailMsg, setSendEmailMsg] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState(
    "Olá {{nome}}! Somos a RedBit CRM. Gostaríamos de apresentar nossas soluções para o seu negócio. Podemos conversar?"
  );
  const [emailSubject, setEmailSubject] = useState(
    "Olá! Gostaríamos de nos apresentar"
  );
  const [emailMessage, setEmailMessage] = useState(
    "Prezado(a) {{nome}},\n\nEntramos em contato para apresentar nossas soluções e verificar se podemos agregar valor ao seu negócio.\n\nFicamos à disposição para uma conversa."
  );

  // ── Handlers ───────────────────────────────────────────────

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearchError(null);
    setCandidates([]);
    setSelected(new Set());
    setImportResult(null);

    try {
      const res = await fetch("/api/prospecting/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          state: state || undefined,
          city: city || undefined,
          radiusKm: Number(radius),
          maxResults: 20,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = [data.error, data.detail].filter(Boolean).join(" — ");
        throw new Error(msg || t("prospect.search.defaultError"));
      }
      setCandidates(data.candidates ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : t("prospect.search.errorFallback"));
    } finally {
      setSearching(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function loadHistory() {
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/prospecting/history");
      const data = await res.json();
      if (res.ok) setHistory(data.searches ?? []);
    } catch {
      // silencioso — painel mostra estado vazio
    } finally {
      setLoadingHistory(false);
    }
  }

  function toggleAll() {
    const available = candidates.filter((c) => !c.imported).map((c) => c.id);
    if (selected.size === available.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(available));
    }
  }

  async function handleImport() {
    if (!selected.size) return;
    setImporting(true);
    setImportError(null);

    try {
      const res = await fetch("/api/prospecting/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateIds: Array.from(selected),
          sendWhatsapp,
          sendEmailMsg,
          whatsappMessage: sendWhatsapp ? whatsappMessage : undefined,
          emailSubject: sendEmailMsg ? emailSubject : undefined,
          emailMessage: sendEmailMsg ? emailMessage : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("prospect.import.errorFallback"));

      const firstFailure = (data.results ?? []).find(
        (r: { error?: string }) => r.error
      );
      setImportResult({
        imported: data.imported ?? 0,
        failed: data.failed ?? 0,
        whatsappSent: data.whatsappSent ?? 0,
        whatsappFailed: data.whatsappFailed ?? 0,
        emailSent: data.emailSent ?? 0,
        warning: data.warning ?? null,
        firstError: firstFailure?.error ?? null,
      });

      // Marca como importado na UI
      setCandidates((prev) =>
        prev.map((c) =>
          selected.has(c.id) && !data.results?.find((r: { id: string; error?: string }) => r.id === c.id && r.error)
            ? { ...c, imported: true }
            : c
        )
      );
      setSelected(new Set());
      setShowImportModal(false);
    } catch (err) {
      // Erro exibido DENTRO do modal — antes ia para searchError,
      // que fica escondido atrás do overlay.
      setImportError(err instanceof Error ? err.message : t("prospect.import.errorFallback"));
    } finally {
      setImporting(false);
    }
  }

  const availableCount = candidates.filter((c) => !c.imported).length;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {t("page.prospecting")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("prospect.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (showHistory ? setShowHistory(false) : loadHistory())}
          className="border-border text-muted-foreground hover:text-foreground"
        >
          <History className="mr-2 h-4 w-4" />
          {showHistory ? t("prospect.history.hide") : t("prospect.history.show")}
        </Button>
      </div>

      {/* Painel de histórico */}
      {showHistory && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              {t("prospect.history.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingHistory ? (
              <div className="flex items-center gap-2 px-6 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : history.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground">
                {t("prospect.history.empty")}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-4 px-6 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">
                        {h.query}
                      </span>
                      {h.location && (
                        <span className="text-muted-foreground">
                          {" "}
                          — {h.location}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {h.imported_count}/{h.total_found} {t("prospect.history.importedLabel")} ·{" "}
                      {new Date(h.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Formulário de busca */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            {t("prospect.search.title")}
          </CardTitle>
          <CardDescription>
            {t("prospect.search.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="query">{t("prospect.search.queryLabel")}</Label>
              <Input
                id="query"
                placeholder={t("prospect.search.queryPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("prospect.search.stateLabel")}</Label>
              <Select value={state} onValueChange={(v) => setState(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder={t("prospect.search.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e.uf} value={e.uf}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">{t("prospect.search.cityLabel")}</Label>
              <Input
                id="city"
                placeholder={t("prospect.search.cityPlaceholder")}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("prospect.search.radiusLabel")}</Label>
              <Select value={radius} onValueChange={(v) => setRadius(v ?? "10")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RAIOS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex items-end">
              <Button
                type="submit"
                disabled={searching || !query.trim()}
                className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {searching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("prospect.search.searching")}
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    {t("prospect.search.button")}
                  </>
                )}
              </Button>
            </div>
          </form>

          {searchError && (
            <p className="mt-3 text-sm text-destructive">{searchError}</p>
          )}
        </CardContent>
      </Card>

      {/* Resultado de importação */}
      {importResult && (
        <div className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span>
              <strong>{importResult.imported}</strong>{" "}
              {importResult.imported === 1
                ? t("prospect.import.resultSingular")
                : t("prospect.import.resultPlural")}
              {importResult.failed > 0 && (
                <span className="text-destructive ml-2">
                  {t("prospect.import.errorCount").replace(
                    "{count}",
                    String(importResult.failed)
                  )}
                </span>
              )}
            </span>
          </div>
          {(importResult.whatsappSent > 0 ||
            importResult.whatsappFailed > 0 ||
            importResult.emailSent > 0) && (
            <p className="ml-7 text-xs text-muted-foreground">
              {t("prospect.import.whatsappLabel")} {importResult.whatsappSent}{" "}
              {importResult.whatsappSent === 1
                ? t("prospect.import.sentSingular")
                : t("prospect.import.sentPlural")}
              {importResult.whatsappFailed > 0 &&
                t("prospect.import.failedInline").replace(
                  "{count}",
                  String(importResult.whatsappFailed)
                )}{" "}
              · {t("prospect.import.emailLabel")} {importResult.emailSent}{" "}
              {importResult.emailSent === 1
                ? t("prospect.import.sentSingular")
                : t("prospect.import.sentPlural")}
            </p>
          )}
          {importResult.warning && (
            <p className="ml-7 text-xs text-amber-500">{importResult.warning}</p>
          )}
          {importResult.firstError && (
            <p className="ml-7 text-xs text-destructive">
              {t("prospect.import.reasonPrefix")} {importResult.firstError}
            </p>
          )}
        </div>
      )}

      {/* Tabela de resultados */}
      {candidates.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base">
                  {candidates.length}{" "}
                  {candidates.length === 1
                    ? t("prospect.results.foundSingular")
                    : t("prospect.results.foundPlural")}
                </CardTitle>
                <CardDescription>
                  {selected.size}{" "}
                  {selected.size === 1
                    ? t("prospect.results.selectedSingular")
                    : t("prospect.results.selectedPlural")}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {availableCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAll}
                    className="border-border text-muted-foreground hover:text-foreground"
                  >
                    {selected.size === availableCount
                      ? t("prospect.results.deselectAll")
                      : t("prospect.results.selectAll")}
                  </Button>
                )}
                {selected.size > 0 && (
                  <Button
                    size="sm"
                    onClick={() => setShowImportModal(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {t("prospect.results.importButton").replace(
                      "{count}",
                      String(selected.size)
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {candidates.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-start gap-4 px-6 py-4 transition-colors ${
                    c.imported
                      ? "opacity-50"
                      : selected.has(c.id)
                      ? "bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    disabled={c.imported}
                    onChange={() => toggleSelect(c.id)}
                    className="mt-1 h-4 w-4 rounded border-border accent-primary"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">
                        {c.name}
                      </span>
                      {c.rating && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                          <Star className="h-3 w-3 fill-amber-400" />
                          {c.rating}
                        </span>
                      )}
                      {c.category && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {c.category}
                        </span>
                      )}
                      {c.imported && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {t("prospect.results.importedBadge")}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {c.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {c.address}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          {c.phone}
                        </span>
                      )}
                      {c.website && (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          <Globe className="h-3 w-3 shrink-0" />
                          {c.website.replace(/^https?:\/\//, "").slice(0, 40)}
                        </a>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0" />
                          {c.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado vazio */}
      {!searching && candidates.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
          <Building2 className="h-12 w-12 opacity-20" />
          <p className="text-sm">
            {t("prospect.empty.prefix")} <strong>{t("prospect.search.button")}</strong>{" "}
            {t("prospect.empty.suffix")}
          </p>
        </div>
      )}

      {/* ── Modal de importação ── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="font-semibold text-foreground">
                {(selected.size === 1
                  ? t("prospect.modal.titleSingular")
                  : t("prospect.modal.titlePlural")
                ).replace("{count}", String(selected.size))}
              </h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportError(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5 max-h-[70vh] overflow-y-auto">
              {/* Disparo WhatsApp */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendWhatsapp}
                    onChange={(e) => setSendWhatsapp(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    {t("prospect.modal.waLabel")}
                  </span>
                </label>

                {sendWhatsapp && (
                  <div className="ml-7 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {t("prospect.modal.messageHint")}
                    </Label>
                    <Textarea
                      value={whatsappMessage}
                      onChange={(e) => setWhatsappMessage(e.target.value)}
                      rows={3}
                      className="resize-none text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Disparo Email */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmailMsg}
                    onChange={(e) => setSendEmailMsg(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <Mail className="h-4 w-4 text-primary" />
                    {t("prospect.modal.emailLabel")}
                  </span>
                </label>

                {sendEmailMsg && (
                  <div className="ml-7 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        {t("prospect.modal.subjectLabel")}
                      </Label>
                      <Input
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        {t("prospect.modal.messageHint")}
                      </Label>
                      <Textarea
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        rows={4}
                        className="resize-none text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                {t("prospect.modal.disclaimerPrefix")} <strong>{t("nav.contacts")}</strong>{" "}
                {t("prospect.modal.disclaimerSuffix")}
              </p>

              {importError && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {importError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setImportError(null);
                }}
                className="border-border"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("prospect.modal.importing")}
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    {t("prospect.modal.confirmButton")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
