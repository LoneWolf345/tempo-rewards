import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LogOut, FileText, Gift, AlertTriangle, DollarSign, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Search, Check, Clock, HelpCircle } from "lucide-react";
import { format } from "date-fns";
import { getStatusStyles } from "@/lib/statusStyles";

interface TempoSubmission {
  id: string;
  technician_email: string;
  technician_name: string;
  upsell_amount: number;
  submission_date: string;
  status: string;
  gift_card_code: string | null;
}

interface SendosoRecord {
  id: string;
  technician_email: string;
  technician_name: string;
  reward_amount: number;
  fulfillment_date: string;
  status: string;
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
  tempoRecords: TempoSubmission[];
  rewardRecords: RewardRecord[];
  matchedRows: MatchedRow[];
}

export default function Dashboard() {
  const { profile, signOut, isAdmin } = useAuth();
  const [tempoSubmissions, setTempoSubmissions] = useState<TempoSubmission[]>([]);
  const [sendosoRecords, setSendosoRecords] = useState<SendosoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "mismatch" | "matched">("all");
  const [sortColumn, setSortColumn] = useState<keyof EmailSummary | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchData();
  }, []);

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
    const rows: MatchedRow[] = [];

    for (const t of sortedTempo) {
      let bestReward: RewardRecord | null = null;
      let bestDiff = Infinity;
      const tDate = new Date(t.submission_date).getTime();

      for (const r of rewardRecords) {
        if (usedRewards.has(r.id)) continue;
        if (Math.abs(Number(t.upsell_amount) - r.amount) > 0.01) continue;
        const rDate = new Date(r.date).getTime();
        const diff = rDate - tDate;
        // Reward should be on or after submission, within 7 days
        if (diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000 && diff < bestDiff) {
          bestDiff = diff;
          bestReward = r;
        }
      }

      if (bestReward) {
        usedRewards.add(bestReward.id);
        rows.push({ tempoRecord: t, rewardRecord: bestReward, isMatched: true });
      } else {
        rows.push({ tempoRecord: t, isMatched: false });
      }
    }

    // Add unmatched rewards
    for (const r of rewardRecords) {
      if (!usedRewards.has(r.id)) {
        rows.push({ rewardRecord: r, isMatched: false });
      }
    }

    // Sort: most recent first by the earliest date in each row
    rows.sort((a, b) => {
      const dateA = a.tempoRecord ? new Date(a.tempoRecord.submission_date).getTime() : new Date(a.rewardRecord!.date).getTime();
      const dateB = b.tempoRecord ? new Date(b.tempoRecord.submission_date).getTime() : new Date(b.rewardRecord!.date).getTime();
      return dateB - dateA;
    });

    return rows;
  };

  const emailSummaries = useMemo(() => {
    const map = new Map<string, EmailSummary>();

    const getOrCreate = (key: string): EmailSummary => {
      if (!map.has(key)) {
        map.set(key, { email: key, tempoCount: 0, tempoTotal: 0, rewardCount: 0, rewardTotal: 0, difference: 0, hasMismatch: false, tempoRecords: [], rewardRecords: [], matchedRows: [] });
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
      entry.hasMismatch = entry.tempoCount !== entry.rewardCount || Math.abs(entry.difference) > 0.01;
      entry.matchedRows = matchRecords(entry.tempoRecords, entry.rewardRecords);
    }

    return Array.from(map.values());
  }, [tempoSubmissions, sendosoRecords]);

  const filteredAndSortedSummaries = useMemo(() => {
    let result = emailSummaries;

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.email.includes(q));
    }

    // Filter by status
    if (statusFilter === "mismatch") {
      result = result.filter((s) => s.hasMismatch);
    } else if (statusFilter === "matched") {
      result = result.filter((s) => !s.hasMismatch);
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
  }, [emailSummaries, searchQuery, statusFilter, sortColumn, sortDirection]);

  const totalSubmissions = tempoSubmissions.length;
  const totalRewards = emailSummaries.reduce((sum, s) => sum + s.rewardCount, 0);
  const totalRewardAmount = emailSummaries.reduce((sum, s) => sum + s.rewardTotal, 0);
  const mismatchCount = emailSummaries.filter((s) => s.hasMismatch).length;

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
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold">TeMPO Rewards Tracker</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {profile?.full_name || profile?.email}
              {isAdmin && <Badge variant="secondary" className="ml-2">Admin</Badge>}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" asChild>
                <a href="/admin">Admin Panel</a>
              </Button>
            )}
            <Button variant="ghost" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSubmissions}</div>
              <p className="text-xs text-muted-foreground">TeMPO upsells submitted</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rewards Received</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRewards}</div>
              <p className="text-xs text-muted-foreground">Sendoso + TeMPO rewards</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Email Mismatches</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{mismatchCount}</div>
              <p className="text-xs text-muted-foreground">Emails with discrepancies</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Reward Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRewardAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Rewards received</p>
            </CardContent>
          </Card>
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
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "mismatch" | "matched")}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({emailSummaries.length})</SelectItem>
                  <SelectItem value="mismatch">Mismatch ({mismatchCount})</SelectItem>
                  <SelectItem value="matched">Matched ({emailSummaries.length - mismatchCount})</SelectItem>
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
                                {summary.hasMismatch ? (
                                  <Badge variant="destructive">Mismatch</Badge>
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
                                              {row.tempoRecord ? format(new Date(row.tempoRecord.submission_date), "MMM d, yyyy") : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell>
                                              ${(row.tempoRecord ? Number(row.tempoRecord.upsell_amount) : row.rewardRecord!.amount).toFixed(2)}
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
                                              ) : row.tempoRecord && !row.rewardRecord ? (
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
