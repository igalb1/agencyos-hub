export interface PlanDef {
  id: string;
  name: string;
  priceId: string;
  price: string;
  description: string;
  maxClients: number;
  features: string[];
  popular?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    id: "starter",
    name: "Starter",
    priceId: "starter_monthly",
    price: "$99",
    description: "עד 10 לקוחות",
    maxClients: 10,
    features: ["ניהול עד 10 לקוחות", "פרויקטים ללא הגבלה", "קמפיינים ומודעות", "דוחות בסיסיים"],
  },
  {
    id: "pro",
    name: "Pro",
    priceId: "pro_monthly",
    price: "$199",
    description: "עד 30 לקוחות",
    maxClients: 30,
    features: ["ניהול עד 30 לקוחות", "הכל ב-Starter", "דוחות מתקדמים", "אינטגרציות"],
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    priceId: "business_monthly",
    price: "$399",
    description: "ללא הגבלה",
    maxClients: Infinity,
    features: ["לקוחות ללא הגבלה", "הכל ב-Pro", "תמיכה מועדפת", "API גישה"],
  },
];

export function getPlanById(id: string): PlanDef | undefined {
  return PLANS.find((p) => p.id === id);
}
