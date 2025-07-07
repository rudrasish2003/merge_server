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
  MANAGER_PHONE_NUMBER
} = process.env;

const twilio = twilioPkg;
const twimlVoice = twilio.twiml;
const CONFERENCE_NAME = 'FedExAttendedRoom';

// === Ultravox joins the conference ===
app.post('/connect-ultravox', (req, res) => {
  const joinUrl = req.query.joinUrl;

  console.log('[Ultravox] connect-ultravox hit');
  if (!joinUrl) {
    console.error('[Ultravox] joinUrl not provided');
    return res.status(400).send('Missing joinUrl');
  }

  const response = new twimlVoice.VoiceResponse();
  const connect = response.connect();
  connect.stream({ url: joinUrl });

  response.dial().conference({
    startConferenceOnEnter: true,
    endConferenceOnExit: false,
    waitUrl: 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical',
    statusCallback: '/conference-events',
    statusCallbackEvent: ['start', 'end', 'join', 'leave'],
    statusCallbackMethod: 'POST'
  }, CONFERENCE_NAME);

  console.log('[Ultravox] Streaming + Dialing into conference:', CONFERENCE_NAME);
  res.type('text/xml').send(response.toString());
});

// === Tool trigger from Ultravox ===
app.post('/tool-calls', (req, res) => {
  console.log('[Tool] Received escalation request at /tool-calls');
  res.status(200).json({ success: true, message: 'Warm transfer to manager initiated' });

  (async () => {
    try {
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      console.log(`[Tool] Calling manager at: ${MANAGER_PHONE_NUMBER}`);

      await client.calls.create({
        to: MANAGER_PHONE_NUMBER,
        from: TWILIO_PHONE_NUMBER,
        url: `https://merge-server.onrender.com/manager-whisper?reason=${encodeURIComponent('Candidate requested human help')}&conf=${CONFERENCE_NAME}`
      });

      console.log('[Tool] Manager call initiated');
    } catch (err) {
      console.error('[Tool] Twilio Call Error:', err.message);
    }
  })();
});

// === Whisper message for manager ===
app.post('/manager-whisper', (req, res) => {
  const { reason, conf } = req.query;

  if (!reason || !conf) {
    console.warn('[Whisper] Missing query params: reason or conf');
    return res.status(400).send('Missing parameters');
  }

  console.log('[Whisper] Manager whisper triggered');
  console.log(`Reason: ${decodeURIComponent(reason)}, Conference: ${conf}`);

  const twiml = new twimlVoice.VoiceResponse();
  const gather = twiml.gather({
    numDigits: 1,
    action: `/join-conference?conf=${conf}`,
    method: 'POST'
  });

  gather.say(`You are being transferred a candidate. Reason: ${decodeURIComponent(reason)}. Press any key to join the call.`);

  res.type('text/xml').send(twiml.toString());
});

// === Manager confirms and joins ===
app.post('/join-conference', (req, res) => {
  const { conf } = req.query;

  if (!conf) {
    console.warn('[Join] Missing conference name');
    return res.status(400).send('Conference name missing');
  }

  console.log(`[Join] Manager confirmed. Joining conference: ${conf}`);

  const twiml = new twimlVoice.VoiceResponse();
  twiml.say('Connecting you to the candidate now.');
  twiml.dial().conference({
    startConferenceOnEnter: true,
    endConferenceOnExit: false
  }, conf);

  res.type('text/xml').send(twiml.toString());
});

// === Twilio conference event callbacks ===
app.post('/conference-events', (req, res) => {
  const event = req.body;
  const timestamp = new Date().toISOString();

  const {
    StatusCallbackEvent,
    CallSid,
    FriendlyName,
    ParticipantCallStatus,
    ReasonParticipantLeft,
    SequenceNumber
  } = event;

  const logHeader = `[${timestamp}] [${StatusCallbackEvent?.toUpperCase() || 'UNKNOWN'}]`;

  if (StatusCallbackEvent === 'participant-join') {
    console.log(`${logHeader} Participant joined '${FriendlyName}'`);
    console.log(`  CallSid: ${CallSid}`);
  } else if (StatusCallbackEvent === 'participant-leave') {
    console.log(`${logHeader} Participant left '${FriendlyName}'`);
    console.log(`  CallSid: ${CallSid}`);
    console.log(`  Status: ${ParticipantCallStatus}`);
    console.log(`  Reason: ${ReasonParticipantLeft}`);
  } else {
    console.log(`${logHeader} Conference Event: ${StatusCallbackEvent}`);
    console.log(`  Conference: ${FriendlyName}`);
    console.log(`  CallSid: ${CallSid || 'N/A'}`);
    if (SequenceNumber) console.log(`  Sequence #: ${SequenceNumber}`);
  }

  res.sendStatus(200);
});

// === Start server ===
const PORT = process.env.MERGE_PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Merge server running on http://localhost:${PORT}`);
});
