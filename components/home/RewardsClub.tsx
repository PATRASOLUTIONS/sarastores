import Link from "next/link"
import { Coins, ArrowRight, ShoppingBag, Wallet, PiggyBank } from "lucide-react"

const steps = [
  { icon: ShoppingBag, title: "Earn on purchases", text: "Every ₹1,000 in cumulative delivered/completed purchases earns 1 Sara Coin." },
  { icon: PiggyBank, title: "Small purchases add up", text: "₹600 + ₹600 earns 1 coin. The remaining ₹200 counts towards your next coin." },
  { icon: Wallet, title: "Use your balance", text: "See your coins in My Membership and redeem eligible coins at checkout." },
]

export default function RewardsClub() {
  return <section aria-labelledby="rewards-club-heading" className="overflow-hidden rounded-3xl bg-[#0f2557] p-6 text-white md:p-9">
    <div className="flex flex-wrap items-center justify-between gap-5"><div>
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-300"><Coins size={20} />Sara Rewards Club</p>
      <h2 id="rewards-club-heading" className="mt-3 text-2xl font-extrabold md:text-3xl">₹1,000 spent. 1 Sara Coin earned.</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">Free with your Sara account. One clear earning rate for every member, with no tier multiplier.</p>
    </div><Link href="/dashboard/membership" className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-[#0f2557]">My Membership <ArrowRight size={16} /></Link></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-3">{steps.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-xl border border-white/15 bg-white/5 p-5">
      <Icon size={26} className="text-amber-300" /><h3 className="mt-3 font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/75">{text}</p></div>)}</div>
    <p className="mt-5 text-xs text-white/65">Cancelled, returned and refunded orders are excluded. <Link href="/rewards#how-heading" className="underline">Read the earning and redemption rules</Link>.</p>
  </section>
}
