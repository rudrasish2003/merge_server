import express from 'express';
import dotenv from 'dotenv';
import { twiml as twimlVoice, default as twilio } from 'twilio';

dotenv.config();

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER
} = process.env;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔁 Conference room name — consistent for all participants
const CONFERENCE_ROOM = 'FedExInterviewRoom';

app.post('/connect-ultravox', (req, res) => {
  const response = new twimlVoice.VoiceResponse();
  response.dial().conference(CONFERENCE_ROOM);
  res.type('text/xml').send(response.toString());
});

app.post('/tool-calls', async (req, res) => {
  const { toolName } = req.body;

  if (toolName === 'merge_manager') {
    try {
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

      const call = await client.calls.create({
        twiml: `<Response><Dial><Conference>${CONFERENCE_ROOM}</Conference></Dial></Response>`,
        to: '+918900072799', // 🔁 Replace with actual manager number
        from: TWILIO_PHONE_NUMBER
      });

      return res.status(200).json({ success: true, sid: call.sid });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(400).json({ error: 'Unknown tool name' });
});

const PORT = process.env.MERGE_PORT || 6000;
app.listen(PORT, () => {
  console.log(`🛠️ Merge server running on port ${PORT}`);
});
