import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useEmulation } from "@/contexts/EmulationContext";
import { EmulationBanner } from "@/components/EmulationBanner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LogOut, FileText, Gift, AlertTriangle, DollarSign, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Search, Check, Clock, HelpCircle, Info } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { getStatusStyles } from "@/lib/statusStyles";

interface TempoSubmission {
  id: string;
  technician_email: string;
  technician_name: string;
  upsell_amount: number;
  submission_date: string;
  status: string;
  gift_card_code: string | null;
  uploaded_at: string;
}

interface SendosoRecord {
  id: string;
  technician_email: string;
  technician_name: string;
  reward_amount: number;
  fulfillment_date: string;
  status: string;
  expiry_date: string | null;
  transaction_id: string | null;
  uploaded_at: string;
}

interface RewardRecord {
  id: string;
  email: string;
  amount: number;
  date: string;
  status: string;
  source: "Sendoso" | "TeMPO";
}

interface MatchedRow {
  tempoRecords?: TempoSubmission[];
  rewardRecord?: RewardRecord;
  isMatched: boolean;
  isGroupMatch?: boolean;
}

interface EmailSummary {
  email: string;
  tempoCount: number;
  tempoTotal: number;
  rewardCount: number;
  rewardTotal: number;
  difference: number;
  hasMismatch: boolean;
  reconciliationStatus: "matched" | "balanced" | "mismatch";
  tempoRecords: TempoSubmission[];
  rewardRecords: RewardRecord[];
  matchedRows: MatchedRow[];
}

export default function Dashboard() {
  const { profile, signOut, isAdmin } = useAuth();
  const { emulatedEmail } = useEmulation();
  const isEmulating = isAdmin && !!emulatedEmail;
  const [tempoSubmissions, setTempoSubmissions] = useState<TempoSubmission[]>([]);
  const [sendosoRecords, setSendosoRecords] = useState<SendosoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "mismatch" | "matched" | "balanced">("all");
  const [sortColumn, setSortColumn] = useState<keyof EmailSummary | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-expand the emulated user's row
  useEffect(() => {
    if (isEmulating && emulatedEmail) {
      setExpandedEmails(new Set([emulatedEmail]));
    }
  }, [isEmulating, emulatedEmail]);

  const fetchAllRows = async <T,>(
    table: "tempo_submissions" | "sendoso_records",
    orderColumn: "submission_date" | "fulfillment_date",
  ): Promise<T[]> => {
    const pageSize = 1000;
    let from = 0;
    const allRows: T[] = [];

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(orderColumn, { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allRows.push(...(data as T[]));
      if (data.length < pageSize) break;

      from += pageSize;
    }

    return allRows;
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tempoData, sendosoData] = await Promise.all([
        fetchAllRows<TempoSubmission>("tempo_submissions", "submission_date"),
        fetchAllRows<SendosoRecord>("sendoso_records", "fulfillment_date"),
      ]);

      setTempoSubmissions(tempoData);
      setSendosoRecords(sendosoData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isUUID = (code: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);

  const matchRecords = (tempoRecords: TempoSubmission[], rewardRecords: RewardRecord[]): MatchedRow[] => {
    const sortedTempo = [...tempoRecords].sort((a, b) => new Date(a.submission_date).getTime() - new Date(b.submission_date).getTime());
    const usedRewards = new Set<string>();
    const usedTempo = new Set<string>();
    const rows: MatchedRow[] = [];

    // Pass 1: Exact 1:1 match
    for (const t of sortedTempo) {
      let bestReward: RewardRecord | null = null;
      let bestDiff = Infinity;
      const tDate = new Date(t.submission_date).getTime();

      for (const r of rewardRecords) {
        if (usedRewards.has(r.id)) continue;
        if (Math.abs(Number(t.upsell_amount) - r.amount) > 0.01) continue;
        const rDate = new Date(r.date).getTime();
        const diff = rDate - tDate;
        if (diff >= 0 && diff <= 45 * 24 * 60 * 60 * 1000 && diff < bestDiff) {
          bestDiff = diff;
          bestReward = r;
        }
      }

      if (bestReward) {
        usedRewards.add(bestReward.id);
        usedTempo.add(t.id);
        rows.push({ tempoRecords: [t], rewardRecord: bestReward, isMatched: true });
      }
    }

    // Pass 2: Group match — find subsets of unmatched submissions that sum to an unmatched reward
    const unmatchedTempo = sortedTempo.filter(t => !usedTempo.has(t.id));
    const unmatchedRewards = rewardRecords.filter(r => !usedRewards.has(r.id));

    const findSubsetSum = (items: TempoSubmission[], target: number, rewardDate: number): TempoSubmission[] | null => {
      const FORTY_FIVE_DAYS = 45 * 24 * 60 * 60 * 1000;
      const eligible = items.filter(t => {
        const diff = rewardDate - new Date(t.submission_date).getTime();
        return diff >= 0 && diff <= FORTY_FIVE_DAYS;
      });

      // Simple recursive subset search (safe for small per-technician lists)
      const search = (idx: number, remaining: number, current: TempoSubmission[]): TempoSubmission[] | null => {
        if (Math.abs(remaining) <= 0.01 && current.length > 1) return current;
        if (idx >= eligible.length || remaining < -0.01) return null;
        // Include
        const withItem = search(idx + 1, remaining - Number(eligible[idx].upsell_amount), [...current, eligible[idx]]);
        if (withItem) return withItem;
        // Exclude
        return search(idx + 1, remaining, current);
      };

      return search(0, target, []);
    };

    const groupUsedTempo = new Set<string>();
    for (const r of unmatchedRewards) {
      const availableTempo = unmatchedTempo.filter(t => !groupUsedTempo.has(t.id));
      const subset = findSubsetSum(availableTempo, r.amount, new Date(r.date).getTime());
      if (subset) {
        subset.forEach(t => groupUsedTempo.add(t.id));
        usedRewards.add(r.id);
        rows.push({ tempoRecords: subset, rewardRecord: r, isMatched: true, isGroupMatch: true });
      }
    }

    // Add remaining unmatched tempo
    for (const t of sortedTempo) {
      if (!usedTempo.has(t.id) && !groupUsedTempo.has(t.id)) {
        rows.push({ tempoRecords: [t], isMatched: false });
      }
    }

    // Add remaining unmatched rewards
    for (const r of rewardRecords) {
      if (!usedRewards.has(r.id)) {
        rows.push({ rewardRecord: r, isMatched: false });
      }
    }

    // Sort: most recent first
    rows.sort((a, b) => {
      const dateA = a.tempoRecords?.[0] ? new Date(a.tempoRecords[0].submission_date).getTime() : new Date(a.rewardRecord!.date).getTime();
      const dateB = b.tempoRecords?.[0] ? new Date(b.tempoRecords[0].submission_date).getTime() : new Date(b.rewardRecord!.date).getTime();
      return dateB - dateA;
    });

    return rows;
  };

  const emailSummaries = useMemo(() => {
    const map = new Map<string, EmailSummary>();

    const getOrCreate = (key: string): EmailSummary => {
      if (!map.has(key)) {
        map.set(key, { email: key, tempoCount: 0, tempoTotal: 0, rewardCount: 0, rewardTotal: 0, difference: 0, hasMismatch: false, reconciliationStatus: "matched", tempoRecords: [], rewardRecords: [], matchedRows: [] });
      }
      return map.get(key)!;
    };

    for (const t of tempoSubmissions) {
      const key = t.technician_email.toLowerCase();
      const entry = getOrCreate(key);
      entry.tempoCount++;
      entry.tempoTotal += Number(t.upsell_amount);
      entry.tempoRecords.push(t);

      const code = t.gift_card_code?.trim();
      if (code && !isUUID(code)) {
        entry.rewardCount++;
        entry.rewardTotal += Number(t.upsell_amount);
        entry.rewardRecords.push({
          id: t.id,
          email: key,
          amount: Number(t.upsell_amount),
          date: t.submission_date,
          status: t.status,
          source: "TeMPO",
        });
      }
    }

    // Collect TeMPO emails to filter Sendoso records
    const tempoEmails = new Set(tempoSubmissions.map(t => t.technician_email.toLowerCase()));

    for (const s of sendosoRecords) {
      const key = s.technician_email.toLowerCase();
      if (!tempoEmails.has(key)) continue; // Skip non-TeMPO emails
      const entry = getOrCreate(key);
      entry.rewardCount++;
      entry.rewardTotal += Number(s.reward_amount);
      entry.rewardRecords.push({
        id: s.id,
        email: key,
        amount: Number(s.reward_amount),
        date: s.fulfillment_date,
        status: s.status,
        source: "Sendoso",
      });
    }

    for (const entry of map.values()) {
      entry.tempoRecords.sort((a, b) => new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime());
      entry.rewardRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      entry.difference = entry.tempoTotal - entry.rewardTotal;
      entry.matchedRows = matchRecords(entry.tempoRecords, entry.rewardRecords);
      const hasUnmatchedRows = entry.matchedRows.some(row => !row.isMatched);
      const isBalanced = Math.abs(entry.difference) <= 0.01;

      if (!hasUnmatchedRows && isBalanced) {
        entry.reconciliationStatus = "matched";
        entry.hasMismatch = false;
      } else if (hasUnmatchedRows && isBalanced) {
        // Totals balance out (catch-up payments accounted for)
        entry.reconciliationStatus = "balanced";
        entry.hasMismatch = false;
      } else {
        entry.reconciliationStatus = "mismatch";
        entry.hasMismatch = true;
      }
    }

    return Array.from(map.values());
  }, [tempoSubmissions, sendosoRecords]);

  const filteredAndSortedSummaries = useMemo(() => {
    let result = emailSummaries;

    // When emulating, show only the emulated user
    if (isEmulating && emulatedEmail) {
      result = result.filter((s) => s.email === emulatedEmail);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.email.includes(q));
    }

    // Filter by status
    if (statusFilter === "mismatch") {
      result = result.filter((s) => s.reconciliationStatus === "mismatch");
    } else if (statusFilter === "matched") {
      result = result.filter((s) => s.reconciliationStatus === "matched");
    } else if (statusFilter === "balanced") {
      result = result.filter((s) => s.reconciliationStatus === "balanced");
    }

    // Sort
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        let cmp = 0;
        if (typeof aVal === "string" && typeof bVal === "string") {
          cmp = aVal.localeCompare(bVal);
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          cmp = aVal - bVal;
        } else if (typeof aVal === "boolean" && typeof bVal === "boolean") {
          cmp = (aVal ? 1 : 0) - (bVal ? 1 : 0);
        }
        return sortDirection === "asc" ? cmp : -cmp;
      });
    } else {
      // Default sort: mismatches first, then alphabetical
      result = [...result].sort((a, b) => {
        if (a.hasMismatch !== b.hasMismatch) return a.hasMismatch ? -1 : 1;
        return a.email.localeCompare(b.email);
      });
    }

    return result;
  }, [emailSummaries, searchQuery, statusFilter, sortColumn, sortDirection, isEmulating, emulatedEmail]);

  const displaySummaries = isEmulating ? filteredAndSortedSummaries : filteredAndSortedSummaries;
  const activeSummaries = isEmulating ? filteredAndSortedSummaries : emailSummaries;
  const totalTempoValue = activeSummaries.reduce((sum, s) => sum + s.tempoTotal, 0);
  const totalSendosoValue = activeSummaries.reduce((sum, s) => sum + s.rewardTotal, 0);
  const pendingValue = totalTempoValue - totalSendosoValue;
  const mismatchCount = activeSummaries.filter((s) => s.reconciliationStatus === "mismatch").length;
  const balancedCount = activeSummaries.filter((s) => s.reconciliationStatus === "balanced").length;

  // Collect TeMPO emails for filtering Sendoso status counts
  const tempoEmailSet = useMemo(() => new Set(tempoSubmissions.map(t => t.technician_email.toLowerCase())), [tempoSubmissions]);
  const statusCounts = useMemo(() => {
    const counts: Record<string, { count: number; amount: number }> = {
      sent: { count: 0, amount: 0 }, clicked: { count: 0, amount: 0 }, opened: { count: 0, amount: 0 },
      used: { count: 0, amount: 0 }, "expired/credited": { count: 0, amount: 0 },
    };
    for (const s of sendosoRecords) {
      if (!tempoEmailSet.has(s.technician_email.toLowerCase())) continue;
      const st = s.status.toLowerCase();
      const amt = Number(s.reward_amount);
      if (st === "expired" || st === "credited" || st === "expired and credited") { counts["expired/credited"].count++; counts["expired/credited"].amount += amt; }
      else if (st in counts) { counts[st].count++; counts[st].amount += amt; }
    }
    return counts;
  }, [sendosoRecords, tempoEmailSet]);
  const tempoLastUpdated = useMemo(() => {
    if (tempoSubmissions.length === 0) return null;
    return tempoSubmissions.reduce((max, t) => {
      const d = new Date(t.uploaded_at).getTime();
      return d > max ? d : max;
    }, 0);
  }, [tempoSubmissions]);

  const sendosoLastUpdated = useMemo(() => {
    if (sendosoRecords.length === 0) return null;
    return sendosoRecords.reduce((max, s) => {
      const d = new Date(s.uploaded_at).getTime();
      return d > max ? d : max;
    }, 0);
  }, [sendosoRecords]);

  const matchedCount = (isEmulating ? filteredAndSortedSummaries : emailSummaries).filter((s) => s.reconciliationStatus === "matched").length;

  const toggleExpand = (email: string) => {
    setExpandedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const handleSort = (column: keyof EmailSummary) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") setSortDirection("desc");
      else { setSortColumn(null); setSortDirection("asc"); }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: keyof EmailSummary }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <EmulationBanner />
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold">TeMPO Rewards Tracker</h1>
            <p className="text-sm text-muted-foreground">
              {isEmulating ? (
                <>Viewing as <strong>{emulatedEmail}</strong></>
              ) : (
                <>
                  Welcome, {profile?.full_name || profile?.email}
                  {isAdmin && <Badge variant="secondary" className="ml-2">Admin</Badge>}
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && !isEmulating && (
              <Button variant="outline" asChild>
                <a href="/admin">Admin Panel</a>
              </Button>
            )}
            {!isEmulating && (
              <Button variant="ghost" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Data Freshness Banner */}
      <div className="border-b bg-muted/50">
        <div className="container mx-auto flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>
            Data is refreshed approximately once per week.
            {" · "}TeMPO data: {tempoLastUpdated ? `updated ${formatDistanceToNow(new Date(tempoLastUpdated), { addSuffix: true })}` : "No data"}
            {" · "}Sendoso data: {sendosoLastUpdated ? `updated ${formatDistanceToNow(new Date(sendosoLastUpdated), { addSuffix: true })}` : "No data"}
          </span>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Earned Rewards</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalTempoValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">Total TeMPO upsell value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rewards Sent</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalSendosoValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">Total Sendoso reward value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Rewards</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${pendingValue > 0.01 ? "text-amber-500" : ""}`}>${pendingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">Earned minus sent</p>
            </CardContent>
          </Card>
        </div>

        {/* Status Pipeline */}
        <div className="mb-8 flex items-center gap-2">
          {(["sent", "clicked", "opened", "used"] as const).map((status, i) => (
            <div key={status} className="flex flex-1 items-center gap-2">
              {i > 0 && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
              <div className={`flex-1 rounded-lg border px-4 py-3 text-center ${getStatusStyles(status)}`}>
                <div className="text-xs font-medium capitalize">{status}</div>
                <div className="text-xl font-bold">{statusCounts[status].count}</div>
                <div className="text-xs opacity-80">${statusCounts[status].amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          ))}
          <div className="ml-2 flex flex-1 items-center gap-2">
            <div className={`flex-1 rounded-lg border px-4 py-3 text-center ${getStatusStyles("expired")}`}>
              <div className="text-xs font-medium">Expired/Credited</div>
              <div className="text-xl font-bold">{statusCounts["expired/credited"].count}</div>
              <div className="text-xs opacity-80">${statusCounts["expired/credited"].amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        {/* Technician Summary Table */}
        <Card>
          <CardHeader>
            <CardTitle>Technician Summary</CardTitle>
            <CardDescription>
              Per-email comparison of TeMPO submissions vs Sendoso rewards. Click a row to see details.
            </CardDescription>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "mismatch" | "matched" | "balanced")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({emailSummaries.length})</SelectItem>
                  <SelectItem value="mismatch">Mismatch ({mismatchCount})</SelectItem>
                  <SelectItem value="balanced">Balanced ({balancedCount})</SelectItem>
                  <SelectItem value="matched">Matched ({matchedCount})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : filteredAndSortedSummaries.length === 0 ? (
              <p className="text-muted-foreground">No data found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("email")}>
                      <span className="flex items-center">Email<SortIcon column="email" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("tempoCount")}>
                      <span className="flex items-center justify-end">Submissions<SortIcon column="tempoCount" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("tempoTotal")}>
                      <span className="flex items-center justify-end">Submission Total<SortIcon column="tempoTotal" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("rewardCount")}>
                      <span className="flex items-center justify-end">Rewards<SortIcon column="rewardCount" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("rewardTotal")}>
                      <span className="flex items-center justify-end">Reward Total<SortIcon column="rewardTotal" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("difference")}>
                      <span className="flex items-center justify-end">Difference<SortIcon column="difference" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("hasMismatch")}>
                      <span className="flex items-center">Status<SortIcon column="hasMismatch" /></span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedSummaries.map((summary) => {
                    const isExpanded = expandedEmails.has(summary.email);
                    return (
                      <Collapsible key={summary.email} open={isExpanded} onOpenChange={() => toggleExpand(summary.email)} asChild>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer">
                              <TableCell className="w-8 px-2">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </TableCell>
                              <TableCell className="font-medium">{summary.email}</TableCell>
                              <TableCell className="text-right">{summary.tempoCount}</TableCell>
                              <TableCell className="text-right">${summary.tempoTotal.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{summary.rewardCount}</TableCell>
                              <TableCell className="text-right">${summary.rewardTotal.toFixed(2)}</TableCell>
                              <TableCell className={`text-right font-semibold ${summary.hasMismatch ? "text-destructive" : ""}`}>
                                {summary.difference > 0 ? "+" : ""}${summary.difference.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {summary.reconciliationStatus === "mismatch" ? (
                                  <Badge variant="destructive">Mismatch</Badge>
                                ) : summary.reconciliationStatus === "balanced" ? (
                                  <Badge className="bg-amber-500 text-white border-transparent">Balanced</Badge>
                                ) : (
                                  <Badge className="bg-green-600 text-white border-transparent">Matched</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <tr>
                              <td colSpan={8} className="p-0">
                                <div className="p-4 bg-muted/30">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Submission Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Reward Date</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead>Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {summary.matchedRows.length === 0 ? (
                                        <TableRow>
                                          <TableCell colSpan={5} className="text-center text-muted-foreground">No records</TableCell>
                                        </TableRow>
                                      ) : (
                                        summary.matchedRows.map((row, idx) => (
                                          <TableRow key={idx} className={!row.isMatched ? "bg-destructive/5" : ""}>
                                            <TableCell>
                                              {row.tempoRecords && row.tempoRecords.length > 0 ? (
                                                row.isGroupMatch ? (
                                                  <div className="flex flex-col gap-0.5">
                                                    {row.tempoRecords.map((t, i) => (
                                                      <span key={i}>{format(new Date(t.submission_date), "MMM d, yyyy")}</span>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  format(new Date(row.tempoRecords[0].submission_date), "MMM d, yyyy")
                                                )
                                              ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell>
                                              {row.isGroupMatch && row.tempoRecords && row.tempoRecords.length > 1 ? (
                                                <div>
                                                  <span className="text-muted-foreground text-xs">
                                                    ${Number(row.tempoRecords[0].upsell_amount).toFixed(2)} × {row.tempoRecords.length} ={" "}
                                                  </span>
                                                  <span className="font-medium">
                                                    ${row.tempoRecords.reduce((sum, t) => sum + Number(t.upsell_amount), 0).toFixed(2)}
                                                  </span>
                                                </div>
                                              ) : (
                                                <span>${(row.tempoRecords?.[0] ? Number(row.tempoRecords[0].upsell_amount) : row.rewardRecord!.amount).toFixed(2)}</span>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {row.rewardRecord ? format(new Date(row.rewardRecord.date), "MMM d, yyyy") : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell>
                                              {row.rewardRecord ? (
                                                <Badge className={row.rewardRecord.source === "TeMPO" ? "bg-purple-600 text-white border-transparent" : "bg-orange-500 text-white border-transparent"}>
                                                  {row.rewardRecord.source}
                                                </Badge>
                                              ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell>
                                              {row.isMatched ? (
                                                <Badge className="bg-green-600 text-white border-transparent">
                                                  <Check className="mr-1 h-3 w-3" />Matched
                                                </Badge>
                                              ) : row.isMatched ? (
                                                <Badge className="bg-green-600 text-white border-transparent">
                                                  <Check className="mr-1 h-3 w-3" />Matched
                                                </Badge>
                                              ) : row.tempoRecords && row.tempoRecords.length > 0 && !row.rewardRecord ? (
                                                <Badge variant="outline" className="text-amber-600 border-amber-600">
                                                  <Clock className="mr-1 h-3 w-3" />Pending
                                                </Badge>
                                              ) : (
                                                <Badge variant="outline" className="text-destructive border-destructive">
                                                  <HelpCircle className="mr-1 h-3 w-3" />Unmatched
                                                </Badge>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                              </td>
                            </tr>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
