const BREVO_ENDPOINT = "https://api.brevo.com/v3/contacts";

type WaitlistPayload = {
  email: string;
  company?: string;
  useCase?: string;
};

export async function subscribeToWaitlist({
  email,
  company,
  useCase,
}: WaitlistPayload) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_LIST_ID) {
    console.warn(
      "[Brevo] API key or List ID not configured. Skipping email subscription.",
      { email, company, useCase }
    );
    // In development/staging without Brevo configured, just log and continue
    if (process.env.NODE_ENV === "development") {
      console.log("[Brevo Mock] Would subscribe:", { email, company, useCase });
      return { success: true, mock: true };
    }
    throw new Error("Brevo environment variables are not configured.");
  }

  const payload = {
    email,
    attributes: {
      COMPANY: company ?? "",
      USE_CASE: useCase ?? "not_specified",
      SOURCE: "website_waitlist",
    },
    listIds: [Number(process.env.BREVO_LIST_ID)],
    updateEnabled: true,
  };

  const response = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Brevo] API error:", { status: response.status, error: errorText });
    throw new Error(`Brevo API error (${response.status}): ${errorText}`);
  }

  return response.json();
}
