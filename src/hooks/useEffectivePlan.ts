import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type PaymentStatus = "active" | "past_due" | "canceled_grace" | "none";

export interface EffectivePlan {
  plan: string;
  hasAccess: boolean;
  paymentStatus: PaymentStatus;
  periodEnd: string | null;
  loading: boolean;
  refresh: () => void;
}

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  starter: 10,
  pro: 30,
  business: Infinity,
};

export function getPlanClientLimit(plan: string): number {
  return PLAN_LIMITS[plan] ?? 3;
}

export function useEffectivePlan(): EffectivePlan {
  const { user } = useAuth();
  const [data, setData] = useState<Omit<EffectivePlan, "loading" | "refresh">>({
    plan: "free",
    hasAccess: false,
    paymentStatus: "none",
    periodEnd: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: rows, error } = await supabase.rpc("get_effective_plan", {
      _user_id: user.id,
    });
    if (!error && rows && rows.length > 0) {
      const row = rows[0];
      setData({
        plan: row.plan,
        hasAccess: row.has_access,
        paymentStatus: (row.payment_status as PaymentStatus) ?? "none",
        periodEnd: row.period_end,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  return { ...data, loading, refresh: fetchPlan };
}
