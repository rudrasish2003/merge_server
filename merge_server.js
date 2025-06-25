import express from 'express';
import dotenv from 'dotenv';
import { twiml as twimlVoice } from 'twilio';
import twilioPkg from 'twilio';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  MANAGER_PHONE_NUMBER // e.g., +91xxxxxxxxxx
} = process.env;

const twilio = twilioPkg;
const CONFERENCE_ROOM = 'FedExInterviewRoom';

// 🎯 Endpoint called by Ultravox when starting the call
app.post('/connect-ultravox', (req, res) => {
  const response = new twimlVoice.VoiceResponse();
  response.dial().conference(CONFERENCE_ROOM);
  res.type('text/xml').send(response.toString());
});

// 🎯 Tool triggered from Ultravox's agent ("merge_manager")
app.post('/tool-calls', async (req, res) => {
  const { toolName } = req.body;

  if (toolName === 'merge_manager') {
    try {
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

      const call = await client.calls.create({
        twiml: `<Response><Dial><Conference>${CONFERENCE_ROOM}</Conference></Dial></Response>`,
        to: MANAGER_PHONE_NUMBER,
        from: TWILIO_PHONE_NUMBER
      });

      console.log(`📞 Manager merged to conference: ${call.sid}`);
      return res.status(200).json({ success: true, sid: call.sid });
    } catch (err) {
      console.error('❌ Merge Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(400).json({ error: 'Unknown tool name' });
});

const PORT = process.env.MERGE_PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Merge server running on port ${PORT}`);
});
