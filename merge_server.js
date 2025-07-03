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
  MANAGER_PHONE_NUMBER // static, from .env
} = process.env;

const twilio = twilioPkg;
const twimlVoice = twilio.twiml;

const CONFERENCE_NAME = 'FedExAttendedRoom';

// === 1. Ultravox webhook to join AI and candidate ===
app.post('/connect-ultravox', (req, res) => {
  const response = new twimlVoice.VoiceResponse();
  response.dial().conference(CONFERENCE_NAME);
  res.type('text/xml').send(response.toString());
});

// === 2. Tool called by Ultravox to bring in the manager ===
app.post('/tool-calls', (req, res) => {
  console.log('🛬 Tool triggered: merge_manager');

  const reason = 'Candidate requested to speak with a human manager.';

  // respond immediately to Ultravox
  res.status(200).json({ success: true, message: 'Calling manager...' });

  // Background logic to call manager
  (async () => {
    try {
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      await client.calls.create({
        to: MANAGER_PHONE_NUMBER,
        from: TWILIO_PHONE_NUMBER,
        url: `https://merge-server.onrender.com/manager-whisper?reason=${encodeURIComponent(reason)}&conf=${CONFERENCE_NAME}`
      });
      console.log('📞 Whisper call initiated to manager');
    } catch (err) {
      console.error('❌ Error calling manager:', err.message);
    }
  })();
});

// === 3. Whisper route (manager hears reason and presses a key) ===
app.post('/manager-whisper', (req, res) => {
  const { reason, conf } = req.query;
  const twiml = new twimlVoice.VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: `/join-conference?conf=${conf}`,
    method: 'POST'
  });

  gather.say(`This is FedEx recruitment. A candidate is on the line. Reason: ${decodeURIComponent(reason)}. Press any key to join.`);

  res.type('text/xml').send(twiml.toString());
});

// === 4. Join manager to the conference ===
app.post('/join-conference', (req, res) => {
  const { conf } = req.query;
  const twiml = new twimlVoice.VoiceResponse();

  twiml.say('Connecting you to the candidate.');
  twiml.dial().conference(conf);

  res.type('text/xml').send(twiml.toString());
});

// === 5. Start server ===
const PORT = process.env.MERGE_PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Merge server running on port ${PORT}`);
});
