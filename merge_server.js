import express from 'express';
import dotenv from 'dotenv';
import twilioPkg from 'twilio';

dotenv.config();

const app = express();
app.use(express.json());

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  MANAGER_PHONE_NUMBER,
  PORT = 4000
} = process.env;

const twilio = twilioPkg.default || twilioPkg;
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * POST /tool-calls
 * This endpoint is triggered by Ultravox when escalation is needed.
 * It performs an attended transfer by:
 * 1. Putting the original caller into a Twilio conference
 * 2. Calling the manager and whispering the reason
 * 3. Connecting both parties into the same conference
 */
app.post('/tool-calls', async (req, res) => {
  try {
    const { callSid } = req.body;

    if (!callSid) {
      return res.status(400).json({ error: 'Missing callSid in request body.' });
    }

    const conferenceName = `conf_${callSid}`;

    console.log(`⚙️  Starting attended transfer for Call SID: ${callSid}`);

    // Step 1: Move candidate into conference
    await client.calls(callSid).update({
      twiml: `
        <Response>
          <Say voice="alice">Please hold while I connect you to a recruiter.</Say>
          <Dial>
            <Conference startConferenceOnEnter="true" endConferenceOnExit="true">${conferenceName}</Conference>
          </Dial>
        </Response>
      `
    });

    // Step 2: Call the manager and join the same conference with a whisper message
    const recruiterCall = await client.calls.create({
      to: MANAGER_PHONE_NUMBER,
      from: TWILIO_PHONE_NUMBER,
      twiml: `
        <Response>
          <Say voice="alice">You have an incoming escalation from RecruitAI. Press any key to join the candidate.</Say>
          <Dial>
            <Conference
              startConferenceOnEnter="true"
              endConferenceOnExit="true"
              beep="false"
              waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical"
            >
              ${conferenceName}
            </Conference>
          </Dial>
        </Response>
      `
    });

    console.log(`✅ Manager invited to conference. SID: ${recruiterCall.sid}`);

    res.status(200).json({ message: 'Attended transfer initiated successfully.' });
  } catch (err) {
    console.error('❌ Error during attended transfer:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Merge server listening at http://localhost:${PORT}`);
});
