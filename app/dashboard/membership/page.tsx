import RewardsBalance from "@/components/RewardsBalance"

export default function MembershipPage() {
  return <div className="space-y-4"><h1 className="text-2xl font-bold text-[#0f2557]">My Membership</h1><p className="text-sm text-slate-600">Your Sara Coins, earning progress and purchase rewards.</p><RewardsBalance embedded /></div>
}
