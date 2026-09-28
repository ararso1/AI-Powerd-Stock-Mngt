import { redirect } from "next/navigation";

export default function ProfitLossPage() {
  redirect("/reports?tab=profit-loss");
}
