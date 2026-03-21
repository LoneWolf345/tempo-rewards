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
import { format, formatDistanceToNow, parseISO } from "date-fns";
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
  expected_reward_amount: number | null;
}

interface AdjustmentRecord {
  id: string;
  technician_email: string;
  technician_name: string | null;
  adjustment_type: string;
  amount: number;
  adjustment_date: string;
  description: string | null;
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
  source: "Sendoso" | "TeMPO" | "Adjustment";
}

interface MatchedRow {
  tempoRecords?: TempoSubmission[];
  rewardRecord?: RewardRecord;
  rewardRecords?: RewardRecord[];
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
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-expand the emulated user's row
  useEffect(() => {
    if (isEmulating && emulatedEmail) {
      setExpandedEmails(new Set([emulatedEmail]));
    }
  }, [isEmulating, emulatedEmail]);

  const fetchAllRows = async <T extends { id: string },>(
    table: "tempo_submissions" | "sendoso_records",
    orderColumn: "submission_date" | "fulfillment_date",
  ): Promise<T[]> => {
    const pageSize = 1000;
    let from = 0;
    const allRows: T[] = [];
    const seenIds = new Set<string>();

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(orderColumn, { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      const rows = data as unknown as T[];
      for (const row of rows) {
        if (seenIds.has(row.id)) continue;
        seenIds.add(row.id);
        allRows.push(row);
      }

      if (data.length < pageSize) break;

      from += pageSize;
    }

    return allRows;
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tempoData, sendosoData, adjustmentData] = await Promise.all([
        fetchAllRows<TempoSubmission>("tempo_submissions", "submission_date"),
        fetchAllRows<SendosoRecord>("sendoso_records", "fulfillment_date"),
        (async () => {
          const allAdj: AdjustmentRecord[] = [];
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const { data, error } = await supabase
              .from("adjustments")
              .select("*")
              .order("adjustment_date", { ascending: false })
              .range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allAdj.push(...(data as unknown as AdjustmentRecord[]));
            if (data.length < pageSize) break;
            from += pageSize;
          }
          return allAdj;
        })(),
      ]);

      setTempoSubmissions(tempoData);
      setSendosoRecords(sendosoData);
      setAdjustments(adjustmentData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isUUID = (code: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);

  const matchRecords = (tempoRecords: TempoSubmission[], rewardRecords: RewardRecord[]): MatchedRow[] => {
    const sortedTempo = [...tempoRecords].sort((a, b) => parseISO(a.submission_date).getTime() - parseISO(b.submission_date).getTime());
    const usedRewards = new Set<string>();
    const usedTempo = new Set<string>();
    const rows: MatchedRow[] = [];

    // Pass 1: Exact 1:1 match — global closest-pair assignment
    const candidates: { tempo: TempoSubmission; reward: RewardRecord; gap: number }[] = [];
    for (const t of sortedTempo) {
      const tDate = parseISO(t.submission_date).getTime();
      const targetAmount = t.expected_reward_amount != null ? Number(t.expected_reward_amount) : Number(t.upsell_amount);
      for (const r of rewardRecords) {
        if (Math.abs(targetAmount - r.amount) > 0.01) continue;
        const gap = parseISO(r.date).getTime() - tDate;
        if (gap >= 0) candidates.push({ tempo: t, reward: r, gap });
      }
    }
    candidates.sort((a, b) => a.gap - b.gap);
    for (const c of candidates) {
      if (usedTempo.has(c.tempo.id) || usedRewards.has(c.reward.id)) continue;
      usedTempo.add(c.tempo.id);
      usedRewards.add(c.reward.id);
      rows.push({ tempoRecords: [c.tempo], rewardRecord: c.reward, isMatched: true });
    }

    // Pass 2: Group match — find subsets of unmatched submissions that sum to an unmatched reward
    const unmatchedTempo = sortedTempo.filter(t => !usedTempo.has(t.id));
    const unmatchedRewards = rewardRecords.filter(r => !usedRewards.has(r.id)).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    const findSubsetSum = (items: TempoSubmission[], target: number, rewardDate: number): TempoSubmission[] | null => {
      const eligible = items.filter(t => {
        return rewardDate >= parseISO(t.submission_date).getTime();
      });

      // Simple recursive subset search (safe for small per-technician lists)
      const search = (idx: number, remaining: number, current: TempoSubmission[]): TempoSubmission[] | null => {
        if (Math.abs(remaining) <= 0.01 && current.length > 1) return current;
        if (idx >= eligible.length || remaining < -0.01) return null;
        // Include
        const withItem = search(idx + 1, remaining - (eligible[idx].expected_reward_amount != null ? Number(eligible[idx].expected_reward_amount) : Number(eligible[idx].upsell_amount)), [...current, eligible[idx]]);
        if (withItem) return withItem;
        // Exclude
        return search(idx + 1, remaining, current);
      };

      return search(0, target, []);
    };

    const groupUsedTempo = new Set<string>();
    for (const r of unmatchedRewards) {
      const availableTempo = unmatchedTempo.filter(t => !groupUsedTempo.has(t.id));
      const subset = findSubsetSum(availableTempo, r.amount, parseISO(r.date).getTime());
      if (subset) {
        subset.forEach(t => groupUsedTempo.add(t.id));
        usedRewards.add(r.id);
        rows.push({ tempoRecords: subset, rewardRecord: r, isMatched: true, isGroupMatch: true });
      }
    }

    // Pass 2b: Reverse group match — find subsets of unmatched rewards that sum to an unmatched TeMPO amount
    const unmatchedTempoAfterP2 = sortedTempo.filter(t => !usedTempo.has(t.id) && !groupUsedTempo.has(t.id));
    const unmatchedRewardsAfterP2 = rewardRecords.filter(r => !usedRewards.has(r.id));

    const findRewardSubsetSum = (items: RewardRecord[], target: number, tempoDate: number): RewardRecord[] | null => {
      const eligible = items.filter(r => parseISO(r.date).getTime() >= tempoDate);
      const search = (idx: number, remaining: number, current: RewardRecord[]): RewardRecord[] | null => {
        if (Math.abs(remaining) <= 0.01 && current.length > 1) return current;
        if (idx >= eligible.length || remaining < -0.01) return null;
        const withItem = search(idx + 1, remaining - eligible[idx].amount, [...current, eligible[idx]]);
        if (withItem) return withItem;
        return search(idx + 1, remaining, current);
      };
      return search(0, target, []);
    };

    const reverseGroupUsedRewards = new Set<string>();
    for (const t of unmatchedTempoAfterP2) {
      const targetAmount = t.expected_reward_amount != null ? Number(t.expected_reward_amount) : Number(t.upsell_amount);
      const availableRewards = unmatchedRewardsAfterP2.filter(r => !reverseGroupUsedRewards.has(r.id));
      const subset = findRewardSubsetSum(availableRewards, targetAmount, parseISO(t.submission_date).getTime());
      if (subset) {
        subset.forEach(r => { reverseGroupUsedRewards.add(r.id); usedRewards.add(r.id); });
        usedTempo.add(t.id);
        rows.push({ tempoRecords: [t], rewardRecords: subset, isMatched: true, isGroupMatch: true });
      }
    }


    // Guard: only reclaim if it produces a net reduction in total unmatched items
    let changed = true;
    while (changed) {
      changed = false;
      const stillUnmatchedTempo = sortedTempo.filter(t => !usedTempo.has(t.id) && !groupUsedTempo.has(t.id));
      const stillUnmatchedRewards = rewardRecords.filter(r => !usedRewards.has(r.id)).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      const unmatchedCountBefore = stillUnmatchedTempo.length + stillUnmatchedRewards.length;

      if (stillUnmatchedTempo.length === 0 || stillUnmatchedRewards.length === 0) break;

      for (const ur of stillUnmatchedRewards) {
        const urDate = parseISO(ur.date).getTime();
        let found = false;

        for (const ut of stillUnmatchedTempo) {
          if (urDate < parseISO(ut.submission_date).getTime()) continue;
          const utAmount = ut.expected_reward_amount != null ? Number(ut.expected_reward_amount) : Number(ut.upsell_amount);
          const needed = ur.amount - utAmount;
          if (needed <= 0.01) continue;

          // Find a 1:1 matched row whose TeMPO has the needed amount and valid date
          const donorIdx = rows.findIndex(row =>
            row.isMatched && !row.isGroupMatch && row.tempoRecords?.length === 1 && row.rewardRecord &&
            Math.abs((row.tempoRecords[0].expected_reward_amount != null ? Number(row.tempoRecords[0].expected_reward_amount) : Number(row.tempoRecords[0].upsell_amount)) - needed) <= 0.01 &&
            urDate >= parseISO(row.tempoRecords[0].submission_date).getTime()
          );

          if (donorIdx !== -1) {
            const donorRow = rows[donorIdx];
            const donorTempo = donorRow.tempoRecords![0];
            const freedReward = donorRow.rewardRecord!;

            // Check if the freed reward can be re-matched to any remaining unmatched TeMPO
            // (excluding the current `ut` which will be consumed by the group)
            const remainingUnmatchedTempo = stillUnmatchedTempo.filter(t => t.id !== ut.id);
            const freedRewardDate = parseISO(freedReward.date).getTime();
            const canRematch = remainingUnmatchedTempo.some(t =>
              Math.abs((t.expected_reward_amount != null ? Number(t.expected_reward_amount) : Number(t.upsell_amount)) - freedReward.amount) <= 0.01 &&
              freedRewardDate >= parseISO(t.submission_date).getTime()
            );

            // Net improvement: reclaim converts 1 unmatched TeMPO + 1 unmatched reward into a group.
            // If the freed reward can also be re-matched, we reduce unmatched by 3 (ut, ur, and the re-matched tempo).
            // If the freed reward CANNOT be re-matched, we only reduce by 1 (ut matched, ur matched, but freed reward becomes unmatched).
            // Either way it's a net improvement (unmatchedCount goes down by at least 1), so proceed.
            // BUT: if unmatchedCountBefore <= 1, breaking a 1:1 could make things worse. Guard against that.
            const netReduction = canRematch ? 3 : 1;
            if (netReduction <= 0) continue;

            // Remove the 1:1 row
            rows.splice(donorIdx, 1);
            usedTempo.delete(donorTempo.id);
            usedRewards.delete(freedReward.id);

            // Create group match: unmatched TeMPO + donor TeMPO → unmatched reward
            usedTempo.add(donorTempo.id);
            usedTempo.add(ut.id);
            groupUsedTempo.add(donorTempo.id);
            groupUsedTempo.add(ut.id);
            usedRewards.add(ur.id);
            rows.push({ tempoRecords: [ut, donorTempo], rewardRecord: ur, isMatched: true, isGroupMatch: true });

            // If the freed reward can be re-matched, do it now
            if (canRematch) {
              const rematchTempo = remainingUnmatchedTempo.find(t =>
                Math.abs((t.expected_reward_amount != null ? Number(t.expected_reward_amount) : Number(t.upsell_amount)) - freedReward.amount) <= 0.01 &&
                freedRewardDate >= parseISO(t.submission_date).getTime()
              )!;
              usedTempo.add(rematchTempo.id);
              usedRewards.add(freedReward.id);
              rows.push({ tempoRecords: [rematchTempo], rewardRecord: freedReward, isMatched: true });
            }
            // If not re-matchable, freedReward stays out of usedRewards and will appear as unmatched row

            changed = true;
            found = true;
            break;
          }
        }
        if (found) break; // restart the loop with fresh unmatched lists
      }
    }

    // Debug: log unmatched state after all passes
    const finalUnmatchedRewards = rewardRecords.filter(r => !usedRewards.has(r.id));
    const finalUnmatchedTempo = sortedTempo.filter(t => !usedTempo.has(t.id) && !groupUsedTempo.has(t.id));
    if (finalUnmatchedRewards.length > 0 || finalUnmatchedTempo.length > 0) {
      console.log('[Matching Debug]', {
        unmatchedRewards: finalUnmatchedRewards.map(r => ({ id: r.id, amount: r.amount, date: r.date })),
        unmatchedTempo: finalUnmatchedTempo.map(t => ({ id: t.id, amount: t.upsell_amount, date: t.submission_date })),
        totalRows: rows.length,
        usedRewardsSize: usedRewards.size,
      });
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
      const allRewardsA = a.rewardRecords ?? (a.rewardRecord ? [a.rewardRecord] : []);
      const allRewardsB = b.rewardRecords ?? (b.rewardRecord ? [b.rewardRecord] : []);
      const dateA = a.tempoRecords?.[0] ? parseISO(a.tempoRecords[0].submission_date).getTime() : parseISO(allRewardsA[0]!.date).getTime();
      const dateB = b.tempoRecords?.[0] ? parseISO(b.tempoRecords[0].submission_date).getTime() : parseISO(allRewardsB[0]!.date).getTime();
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
      entry.tempoTotal += Number(t.expected_reward_amount ?? t.upsell_amount);
      entry.tempoRecords.push(t);

      const code = t.gift_card_code?.trim();
      if (code && !isUUID(code)) {
        entry.rewardCount++;
        entry.rewardTotal += Number(t.expected_reward_amount ?? t.upsell_amount);
        entry.rewardRecords.push({
          id: t.id,
          email: key,
          amount: Number(t.expected_reward_amount ?? t.upsell_amount),
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

    // Include adjustments as virtual TeMPO records (earned side)
    for (const adj of adjustments) {
      const key = adj.technician_email.toLowerCase();
      const entry = getOrCreate(key);
      entry.tempoCount++;
      entry.tempoTotal += Number(adj.amount);
      entry.tempoRecords.push({
        id: adj.id,
        technician_email: adj.technician_email,
        technician_name: adj.technician_name ?? "",
        upsell_amount: Number(adj.amount),
        submission_date: adj.adjustment_date,
        status: adj.adjustment_type,
        gift_card_code: null,
        uploaded_at: adj.uploaded_at,
        expected_reward_amount: null,
        _source: "Adjustment",
      } as TempoSubmission & { _source: string });
    }

    for (const entry of map.values()) {
      entry.tempoRecords.sort((a, b) => parseISO(b.submission_date).getTime() - parseISO(a.submission_date).getTime());
      entry.rewardRecords.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
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
  }, [tempoSubmissions, sendosoRecords, adjustments]);

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
                                        summary.matchedRows.map((row, idx) => {
                                          const allRewards = row.rewardRecords ?? (row.rewardRecord ? [row.rewardRecord] : []);
                                          const isAdjustment = row.tempoRecords?.[0] && (row.tempoRecords[0] as any)._source === "Adjustment";
                                          return (
                                          <TableRow key={idx} className={!row.isMatched ? "bg-destructive/5" : ""}>
                                            <TableCell>
                                              {row.tempoRecords && row.tempoRecords.length > 0 ? (
                                                row.isGroupMatch && row.tempoRecords.length > 1 ? (
                                                  <div className="flex flex-col gap-0.5">
                                                    {row.tempoRecords.map((t, i) => (
                                                      <span key={i}>{format(parseISO(t.submission_date), "MMM d, yyyy")}</span>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <div className="flex items-center gap-1.5">
                                                    <span>{format(parseISO(row.tempoRecords[0].submission_date), "MMM d, yyyy")}</span>
                                                    {isAdjustment && <Badge className="bg-teal-600 text-white border-transparent text-[10px] px-1.5 py-0">{row.tempoRecords[0].status || "Adjustment"}</Badge>}
                                                  </div>
                                                )
                                              ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell>
                                              {row.isGroupMatch && row.tempoRecords && row.tempoRecords.length > 1 ? (
                                                <div>
                                                  <span className="text-muted-foreground text-xs">
                                                    ${Number(row.tempoRecords[0].expected_reward_amount ?? row.tempoRecords[0].upsell_amount).toFixed(2)} × {row.tempoRecords.length} ={" "}
                                                  </span>
                                                  <span className="font-medium">
                                                    ${row.tempoRecords.reduce((sum, t) => sum + Number(t.expected_reward_amount ?? t.upsell_amount), 0).toFixed(2)}
                                                  </span>
                                                </div>
                                              ) : (
                                                (() => {
                                                  const rec = row.tempoRecords?.[0];
                                                  const override = rec?.expected_reward_amount;
                                                  const base = rec ? Number(rec.upsell_amount) : (allRewards[0]?.amount ?? 0);
                                                  if (override && Number(override) !== base) {
                                                    return (
                                                      <span>
                                                        <span className="text-muted-foreground line-through text-xs">${base.toFixed(2)}</span>
                                                        {" → "}
                                                        <span className="font-medium">${Number(override).toFixed(2)}</span>
                                                      </span>
                                                    );
                                                  }
                                                  return <span>${base.toFixed(2)}</span>;
                                                })()
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {allRewards.length > 1 ? (
                                                <div className="flex flex-col gap-0.5">
                                                  {allRewards.map((r, i) => (
                                                    <span key={i}>{format(parseISO(r.date), "MMM d, yyyy")} <span className="text-muted-foreground text-xs">(${r.amount.toFixed(2)})</span></span>
                                                  ))}
                                                </div>
                                              ) : allRewards.length === 1 ? (
                                                format(parseISO(allRewards[0].date), "MMM d, yyyy")
                                              ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="w-[1%] whitespace-nowrap">
                                              {allRewards.length > 0 ? (
                                                <div className="flex flex-col gap-0.5 items-start">
                                                  {[...new Set(allRewards.map(r => r.source))].map((src, i) => (
                                                    <Badge key={i} className={
                                                      src === "TeMPO" ? "bg-purple-600 text-white border-transparent" :
                                                      src === "Adjustment" ? "bg-teal-600 text-white border-transparent" :
                                                      "bg-orange-500 text-white border-transparent"
                                                    }>
                                                      {src}{allRewards.length > 1 && ` (${allRewards.filter(r => r.source === src).length})`}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell>
                                              {row.isMatched ? (
                                                <Badge className="bg-green-600 text-white border-transparent">
                                                  <Check className="mr-1 h-3 w-3" />Matched
                                                </Badge>
                                              ) : row.tempoRecords && row.tempoRecords.length > 0 && allRewards.length === 0 ? (
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
                                          );
                                        })
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
