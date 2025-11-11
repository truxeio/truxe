import { NextRequest, NextResponse } from "next/server";

import { WAITLIST_USE_CASES } from "@/lib/constants";
import { subscribeToWaitlist } from "@/lib/brevo";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const company =
      typeof body.company === "string" ? body.company.trim() : undefined;
    const useCase = typeof body.useCase === "string" ? body.useCase : undefined;

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 },
      );
    }

    const allowedUseCases = new Set(WAITLIST_USE_CASES.map((item) => item.value));
    const payloadUseCase = useCase && allowedUseCases.has(useCase) ? useCase : "other";

    await subscribeToWaitlist({ email, company, useCase: payloadUseCase });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Waitlist API] Error:", error);

    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check if it's a configuration error
    if (errorMessage.includes("environment variables")) {
      console.error("[Waitlist API] Configuration error - Brevo env vars missing");
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please contact support." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to join the waitlist. Please try again later." },
      { status: 500 },
    );
  }
}
