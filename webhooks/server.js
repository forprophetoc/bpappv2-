import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RETELL_API_KEY = process.env.RETELL_API_KEY || "placeholder-api-key";
const FORM_URL = "https://forms.esticlose.com/onboard";

// ---------- Placeholder Contractor Database ----------
// Using ABC Bathtub Refinishing as test data.
// Replace with real database queries when ready.

const contractors = {
  "+12395551234": {
    first_name: "Mike",
    business_name: "ABC Bathtub Refinishing",
    phone_number: "+12395551234",
    email: "mike@abcbathtub.com",
  },
};

// In-memory storage for call records (replace with DB later)
const callRecords = [];
const callbacks = [];

// ---------- Middleware ----------

function verifyRetellSignature(req, res, next) {
  // Skip signature verification in dev/placeholder mode
  if (RETELL_API_KEY === "placeholder-api-key") return next();

  const signature = req.headers["x-retell-signature"];
  if (!signature) return res.status(401).json({ error: "Missing signature" });

  const body = JSON.stringify(req.body);
  const expected = crypto
    .createHmac("sha256", RETELL_API_KEY)
    .update(body)
    .digest("hex");

  if (signature !== expected) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  next();
}

app.use("/api/retell", verifyRetellSignature);

// ---------- Pre-Call Webhook ----------
// Retell calls this before the agent picks up.
// Returns contractor data for dynamic variables in the prompt.

app.post("/api/retell/pre-call", async (req, res) => {
  const { call_id, from_number } = req.body;

  const contractor = contractors[from_number];

  if (!contractor) {
    console.warn(`No contractor found for ${from_number}, call ${call_id}`);
    // Fall back to test contractor for placeholder mode
    const fallback = contractors["+12395551234"];
    return res.json({
      dynamic_variables: {
        contractor_first_name: fallback.first_name,
        business_name: fallback.business_name,
        phone_number: fallback.phone_number,
        email: fallback.email,
      },
    });
  }

  res.json({
    dynamic_variables: {
      contractor_first_name: contractor.first_name,
      business_name: contractor.business_name,
      phone_number: contractor.phone_number,
      email: contractor.email,
    },
  });
});

// ---------- Post-Call Webhook ----------
// Retell calls this after the call ends with transcript + extracted data.

app.post("/api/retell/post-call", async (req, res) => {
  const {
    call_id,
    call_duration_ms,
    call_recording_url,
    call_transcript,
    extracted_data,
  } = req.body;

  const record = {
    call_id,
    duration_ms: call_duration_ms,
    recording_url: call_recording_url,
    transcript: call_transcript,
    fallback_phone: extracted_data?.fallback_phone_number || null,
    terms_agreed: extracted_data?.verbal_terms_agreement || false,
    form_sent: extracted_data?.form_sent || false,
    outcome: extracted_data?.call_outcome || "abandoned",
    created_at: new Date().toISOString(),
  };

  callRecords.push(record);
  console.log("Post-call record:", JSON.stringify(record, null, 2));

  res.json({ received: true });
});

// ---------- Send Onboarding Form ----------
// Triggered by the agent during Step 4.

app.post("/api/retell/send-form", async (req, res) => {
  const { phone_number, email, contractor_first_name, business_name } =
    req.body;

  const formLink = `${FORM_URL}?name=${encodeURIComponent(contractor_first_name)}&business=${encodeURIComponent(business_name || "")}`;

  // Placeholder: log instead of actually sending
  console.log("--- FORM SEND (placeholder) ---");
  console.log(`SMS to ${phone_number}:`);
  console.log(`  Hi ${contractor_first_name}, here's your EstiClose onboarding form: ${formLink}`);
  console.log(`Email to ${email}:`);
  console.log(`  Subject: EstiClose Onboarding Form`);
  console.log(`  Body: Hi ${contractor_first_name}, here's your onboarding form: ${formLink}`);
  console.log("-------------------------------");

  res.json({ success: true });
});

// ---------- Capture Fallback Phone ----------
// Triggered by the agent during Step 5.

app.post("/api/retell/capture-fallback", async (req, res) => {
  const { call_id, fallback_phone_number } = req.body;

  console.log(`Fallback phone captured — call ${call_id}: ${fallback_phone_number}`);

  // Store in the most recent call record if it exists
  const record = callRecords.find((r) => r.call_id === call_id);
  if (record) {
    record.fallback_phone = fallback_phone_number;
  }

  res.json({ success: true });
});

// ---------- Schedule Callback ----------
// Triggered by the agent during Step 1 if contractor can't talk now.

app.post("/api/retell/schedule-callback", async (req, res) => {
  const { phone_number, preferred_time, contractor_first_name } = req.body;

  const entry = {
    phone_number,
    preferred_time,
    contractor_first_name,
    created_at: new Date().toISOString(),
  };

  callbacks.push(entry);
  console.log("Callback scheduled:", JSON.stringify(entry, null, 2));

  res.json({ success: true });
});

// ---------- Debug Endpoints (dev only) ----------

app.get("/api/debug/records", (req, res) => {
  res.json({ call_records: callRecords, scheduled_callbacks: callbacks });
});

app.get("/api/debug/contractor", (req, res) => {
  res.json(contractors["+12395551234"]);
});

// ---------- Start ----------

app.listen(PORT, () => {
  console.log(`EstiClose webhook server running on port ${PORT}`);
  console.log(`Placeholder contractor: Mike @ ABC Bathtub Refinishing`);
  console.log(`Debug endpoints:`);
  console.log(`  GET http://localhost:${PORT}/api/debug/records`);
  console.log(`  GET http://localhost:${PORT}/api/debug/contractor`);
});
