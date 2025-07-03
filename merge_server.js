const express = require('express');
const dotenv = require('dotenv');
const twilioPkg = require('twilio');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  MANAGER_PHONE_NUMBER // e.g., +91XXXXXXXXXX
} = process.env;

const twilio = twilioPkg;
const twimlVoice = twilio.twiml;
const CONFERENCE_ROOM = 'FedExInterviewRoom';

// 🎯 Ultravox connect webhook: joins the original caller to a Twilio conference
app.post('/connect-ultravox', (req, res) => {
  const response = new twimlVoice.VoiceResponse();
  response.dial().conference(CONFERENCE_ROOM);
  res.type('text/xml').send(response.toString());
});

// 🎯 Tool endpoint: called by Ultravox to merge the manager into the call
app.post('/tool-calls', (req, res) => {
  console.log('🛬 Received tool call at /tool-calls');

  // Respond immediately to Ultravox to prevent timeouts
  res.status(200).json({ success: true, message: 'Merging manager in background.' });

  // Run Twilio call in the background
  (async () => {
    try {
      console.log('⚙️ Starting Twilio call to manager...');

      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

      const call = await client.calls.create({
        twiml: `<Response><Dial><Conference>${CONFERENCE_ROOM}</Conference></Dial></Response>`,
        to: MANAGER_PHONE_NUMBER,
        from: TWILIO_PHONE_NUMBER
      });

      console.log(`📞 Manager merged to conference: ${call.sid}`);
    } catch (err) {
      console.error('❌ Twilio Merge Error:', err.message);
    }
  })();
});

const PORT = process.env.MERGE_PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Merge server running on port ${PORT}`);
});
