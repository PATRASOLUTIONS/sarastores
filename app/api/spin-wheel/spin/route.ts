import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { randomInt, timingSafeEqual } from "crypto"
import { sendSpinWheelEmail, sendWhatsAppWinNotification } from "@/lib/spin-wheel-notifications"
import { getCampaignCollection, resolveCampaignSlug } from "@/lib/spin-wheel-campaigns"

export const maxDuration = 15

/** Constant-time token comparison; length is compared first and leaks nothing. */
function tokensMatch(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string") return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

interface Prize {
  prizeName: string
  isActive?: boolean
  total: number
  distributed?: number
  weightMultiplier?: number
  dateRanges?: { startDate: string; endDate: string }[]
  timeSlots?: { startTime: string; endTime: string }[]
}

function isPrizeAvailable(
  prize: Prize,
  unusedCouponCount: number,
  now: Date
): boolean {
  if (prize.isActive === false) return false
  if (prize.prizeName !== "BETTER LUCK NEXT TIME" && unusedCouponCount <= 0) return false

  if (prize.dateRanges && prize.dateRanges.length > 0) {
    const currentDate = now.toISOString().split("T")[0]
    const inDateRange = prize.dateRanges.some((range) => {
      return currentDate >= range.startDate && currentDate <= range.endDate
    })
    if (!inDateRange) return false
  }

  if (prize.timeSlots && prize.timeSlots.length > 0) {
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const currentMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes()

    const inTimeSlot = prize.timeSlots.some((slot) => {
      const [startH, startM] = slot.startTime.split(":").map(Number)
      const [endH, endM] = slot.endTime.split(":").map(Number)
      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes
    })
    if (!inTimeSlot) return false
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { participantId, campaignId, spinToken } = body
    const campaignSlug = resolveCampaignSlug(campaignId)
    if (!campaignSlug) {
      return NextResponse.json({ error: "Invalid campaign" }, { status: 400 })
    }

    if (!participantId) {
      return NextResponse.json(
        { error: "Participant ID is required" },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()
    const participantsCol = await getCampaignCollection(campaignSlug, "participants")
    const inventoryCol = await getCampaignCollection<Prize>(campaignSlug, "inventory")
    const couponCodesCol = await getCampaignCollection(campaignSlug, "couponCodes")

    let participant
    try {
      participant = await participantsCol.findOne({ _id: new ObjectId(participantId) })
    } catch {
      return NextResponse.json({ error: "Invalid participant ID" }, { status: 400 })
    }

    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 })
    }

    /*
     * Prove the caller is the registrant before spending their spin.
     *
     * Participants registered before spin tokens existed have no stored token;
     * they keep working so an in-flight campaign is not broken by this change.
     */
    if (participant.spinToken && !tokensMatch(spinToken, participant.spinToken)) {
      return NextResponse.json(
        { error: "Invalid spin token. Please register again." },
        { status: 403 }
      )
    }

    if (participant.hasSpun) {
      console.warn(`[SPIN_WHEEL_WARNING] Participant ${participantId} attempted to spin again. Already spun.`)
      return NextResponse.json(
        {
          error: "already_spun",
          message: "You have already spun the wheel.",
          prize: participant.prize,
          couponCode: participant.couponCode
        },
        { status: 409 }
      )
    }

    const now = new Date()

    const allPrizes = await inventoryCol.find().toArray()

    const couponCounts = await couponCodesCol.aggregate<{ _id: string; count: number }>([
      { $match: { isUsed: false } },
      { $group: { _id: "$prizeName", count: { $sum: 1 } } }
    ]).toArray()

    const couponCountMap: Record<string, number> = {}
    couponCounts.forEach((c) => { couponCountMap[c._id] = c.count })

    const availablePrizes = allPrizes.filter((prize: Prize) => {
      if (prize.prizeName === "BETTER LUCK NEXT TIME") return false
      const unusedCoupons = couponCountMap[prize.prizeName] || 0
      return isPrizeAvailable(prize, unusedCoupons, now)
    })

    let selectedPrize: string | null = null
    let couponCode: string | null = null

    const betterLuck = allPrizes.find((p: Prize) => p.prizeName === "BETTER LUCK NEXT TIME")
    const isBlntAvailable = betterLuck ? isPrizeAvailable(betterLuck, 1, now) && (betterLuck.total - (betterLuck.distributed || 0) > 0) : false

    if (availablePrizes.length === 0 && !isBlntAvailable) {
      return NextResponse.json(
        { error: "No prizes currently available to spin. Please try again later." },
        { status: 400 }
      )
    }

    const weightedPool: { prizeName: string; weight: number }[] = []

    for (const prize of availablePrizes) {
      const unusedCoupons = couponCountMap[prize.prizeName] || 0
      const weight = unusedCoupons * (prize.weightMultiplier || 1)
      weightedPool.push({ prizeName: prize.prizeName, weight })
    }

    if (isBlntAvailable && betterLuck) {
      const blRemaining = betterLuck.total - (betterLuck.distributed || 0)
      weightedPool.push({
        prizeName: "BETTER LUCK NEXT TIME",
        weight: blRemaining * (betterLuck.weightMultiplier || 5)
      })
    }

    if (weightedPool.length > 0) {
      const totalWeight = weightedPool.reduce((sum, p) => sum + p.weight, 0)

      /*
       * This draw hands out real coupons, so it must not be predictable.
       * Math.random() is a seeded PRNG whose internal state can be
       * reconstructed from a modest number of observed outputs, which would
       * let someone time their spin to land on the prize they want.
       * lib/lucky-draw.ts uses randomInt for exactly this reason.
       *
       * Weights are fractional (weightMultiplier), so draw a uniform fraction
       * rather than an index. randomInt requires a span below 2**48.
       */
      const UNIFORM_SPAN = 2 ** 47
      const randomValue = (randomInt(UNIFORM_SPAN) / UNIFORM_SPAN) * totalWeight

      let cumulativeWeight = 0
      selectedPrize = weightedPool[0].prizeName
      for (const prize of weightedPool) {
        cumulativeWeight += prize.weight
        if (randomValue <= cumulativeWeight) {
          selectedPrize = prize.prizeName
          break
        }
      }
    } else {
      selectedPrize = "BETTER LUCK NEXT TIME"
    }

    const isBetterLuck = selectedPrize === "BETTER LUCK NEXT TIME"

    if (!isBetterLuck) {
      const claimedCode = await couponCodesCol.findOneAndUpdate(
        { prizeName: selectedPrize, isUsed: false },
        {
          $set: {
            isUsed: true,
            usedBy: new ObjectId(participantId),
            usedAt: new Date()
          }
        },
        { returnDocument: "after" }
      )

      if (claimedCode) {
        couponCode = claimedCode.code
      } else {
        console.warn(`[SPIN_WHEEL] Race condition: no coupon available for ${selectedPrize}, falling back to BLNT. Participant: ${participantId}`)
        selectedPrize = "BETTER LUCK NEXT TIME"
      }
    }

    if (selectedPrize !== "BETTER LUCK NEXT TIME") {
      await inventoryCol.updateOne(
        { prizeName: selectedPrize },
        { $inc: { distributed: 1 } }
      )
    } else {
      await inventoryCol.updateOne(
        { prizeName: "BETTER LUCK NEXT TIME" },
        { $inc: { distributed: 1 } }
      )
    }

    await participantsCol.updateOne(
      { _id: new ObjectId(participantId) },
      {
        $set: {
          hasSpun: true,
          prize: selectedPrize,
          couponCode: couponCode,
          spinDate: new Date(),
          updatedAt: new Date()
        }
      }
    )

    if (couponCode) {
      const couponsCol = await getCampaignCollection(campaignSlug, "coupons")
      await couponsCol.insertOne({
        couponCode,
        prize: selectedPrize,
        participantId: new ObjectId(participantId),
        participantName: participant.name,
        participantPhone: participant.phone,
        participantEmail: participant.email,
        store: participant.store,
        status: "issued",
        createdAt: new Date()
      })
    }

    if (!isBetterLuck && couponCode) {
      try {
        const emailResult = await sendSpinWheelEmail(participant.email, participant.name, selectedPrize, couponCode)
        if (!emailResult.success) console.error("[SPIN_WHEEL] Winner email delivery failed")
      } catch (err: unknown) {
        console.error(`[SPIN_WHEEL] Email failed for participant ${participantId}:`, err instanceof Error ? err.message : String(err))
      }

      try {
        const whatsappResult = await sendWhatsAppWinNotification(participant.phone, participant.name, selectedPrize, couponCode, participant.senderNumber)
        if (whatsappResult.success === false) {
          console.error(`[SPIN_WHEEL] WhatsApp API returned success=false:`, whatsappResult.error)
        }
      } catch (err: unknown) {
        console.error(`[SPIN_WHEEL] WhatsApp failed for participant ${participantId}:`, err instanceof Error ? err.message : String(err))
      }
    }

    return NextResponse.json({
      success: true,
      prize: selectedPrize,
      couponCode,
      message: isBetterLuck
        ? "Better luck next time! Thank you for participating."
        : `Congratulations! You won ${selectedPrize}!`
    })
  } catch (error) {
    console.error("Spin wheel error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
