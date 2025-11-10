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
    throw new Error("Brevo environment variables are not configured.");
  }

  const response = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      attributes: {
        COMPANY: company ?? "",
        USE_CASE: useCase ?? "not_specified",
        SOURCE: "website_waitlist",
      },
      listIds: [Number(process.env.BREVO_LIST_ID)],
      updateEnabled: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo API error: ${errorText}`);
  }

  return response.json();
}
