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

// Webhook for Ultravox to join AI to the conference
app.post('/connect-ultravox', (req, res) => {
  console.log('Ultravox requested to join conference');

  const response = new twimlVoice.VoiceResponse();
  response.dial().conference({
    startConferenceOnEnter: true,
    endConferenceOnExit: false,
    waitUrl: '',
    statusCallback: '/conference-events',
    statusCallbackEvent: ['start', 'end', 'join', 'leave'],
    statusCallbackMethod: 'POST'
  }, CONFERENCE_NAME);

  console.log('Ultravox added to conference with event tracking');
  res.type('text/xml').send(response.toString());
});

// Tool endpoint triggered by Ultravox
app.post('/tool-calls', (req, res) => {
  console.log('Received tool call at /tool-calls');

  res.status(200).json({ success: true, message: 'Starting warm transfer...' });

  (async () => {
    try {
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      const to = MANAGER_PHONE_NUMBER;
      console.log(`Calling manager at: ${to}`);

      await client.calls.create({
        to,
        from: TWILIO_PHONE_NUMBER,
        url: `https://merge-server.onrender.com/manager-whisper?reason=${encodeURIComponent(
          'Candidate requested human help'
        )}&conf=${CONFERENCE_NAME}`
      });

      console.log('Manager called with whisper prompt');
    } catch (err) {
      console.error('Twilio Transfer Error:', err.message);
    }
  })();
});

// Whisper message to manager
app.post('/manager-whisper', (req, res) => {
  const { reason, conf } = req.query;

  console.log('Whisper prompt triggered');
  console.log(`Reason: ${decodeURIComponent(reason)}`);
  console.log(`Conference: ${conf}`);

  const twiml = new twimlVoice.VoiceResponse();
  const gather = twiml.gather({
    numDigits: 1,
    action: `/join-conference?conf=${conf}`,
    method: 'POST'
  });

  gather.say(`You are being transferred a candidate. Reason: ${decodeURIComponent(
    reason
  )}. Press any key to join the call.`);

  res.type('text/xml').send(twiml.toString());
});

// Join manager to the conference after keypress
app.post('/join-conference', (req, res) => {
  const { conf } = req.query;
  console.log(`Manager pressed key to join conference: ${conf}`);

  const twiml = new twimlVoice.VoiceResponse();
  twiml.say('Connecting you to the candidate now.');
  twiml.dial().conference({
    startConferenceOnEnter: true,
    endConferenceOnExit: false
  }, conf);

  res.type('text/xml').send(twiml.toString());
});

// Log Twilio conference events
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

  const logPrefix = `[${timestamp}] [${StatusCallbackEvent}]`;

  if (StatusCallbackEvent === 'participant-join') {
    console.log(`${logPrefix} Participant joined conference '${FriendlyName}'`);
    console.log(`  CallSid: ${CallSid}`);
  } else if (StatusCallbackEvent === 'participant-leave') {
    console.log(`${logPrefix} Participant left conference '${FriendlyName}'`);
    console.log(`  CallSid: ${CallSid}`);
    console.log(`  Status: ${ParticipantCallStatus}`);
    console.log(`  Reason: ${ReasonParticipantLeft}`);
  } else {
    console.log(`${logPrefix} Conference Event: ${StatusCallbackEvent}`);
    console.log(`  Conference: ${FriendlyName}`);
    console.log(`  CallSid: ${CallSid || 'N/A'}`);
    if (SequenceNumber) console.log(`  Sequence #: ${SequenceNumber}`);
  }

  res.sendStatus(200);
});

// Start server
const PORT = process.env.MERGE_PORT || 10000;
app.listen(PORT, () => {
  console.log(`Merge server running on port ${PORT}`);
});
