import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { sendSpinWheelEmail, sendWhatsAppWinNotification } from "@/lib/spin-wheel-notifications"
import { getCampaignCollection } from "@/lib/spin-wheel-campaigns"

export const maxDuration = 15

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
    const { participantId, campaignId } = body
    const campaignSlug = campaignId || "default"

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
      let weight = unusedCoupons * (prize.weightMultiplier || 1)
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
      const randomValue = Math.random() * totalWeight

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
        await sendSpinWheelEmail(participant.email, participant.name, selectedPrize, couponCode)
      } catch (err: unknown) {
        console.error(`[SPIN_WHEEL] Email failed for participant ${participantId}:`, err instanceof Error ? err.message : String(err))
      }

      try {
        const whatsappResult = await sendWhatsAppWinNotification(participant.phone, participant.name, selectedPrize, couponCode, participant.senderNumber)
        if (whatsappResult.success === false) {
          console.error(`[SPIN_WHEEL] WhatsApp API returned success=false:`, whatsappResult.error || whatsappResult.data)
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
