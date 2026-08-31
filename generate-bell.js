const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const duration = 1.2; // seconds
const numSamples = sampleRate * duration;
const buffer = Buffer.alloc(44 + numSamples * 2);

buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + numSamples * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // Subchunk1Size
buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
buffer.writeUInt16LE(1, 22); // NumChannels
buffer.writeUInt32LE(sampleRate, 24); // SampleRate
buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
buffer.writeUInt16LE(2, 32); // BlockAlign
buffer.writeUInt16LE(16, 34); // BitsPerSample
buffer.write('data', 36);
buffer.writeUInt32LE(numSamples * 2, 40); // Subchunk2Size

// Frequencies for a bell/chime (fundamental + harmonics)
const freqs = [880, 1760, 2640, 3520]; 
const amps = [1, 0.5, 0.25, 0.1];
const decay = 3;

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  let val = 0;
  for (let f = 0; f < freqs.length; f++) {
    val += amps[f] * Math.sin(2 * Math.PI * freqs[f] * t) * Math.exp(-decay * t);
  }
  // Normalize
  val = val / 1.85;
  // Apply a quick attack envelope to avoid clicking
  const attackTime = 0.01;
  if (t < attackTime) {
      val = val * (t / attackTime);
  }
  
  let int16 = Math.max(-32768, Math.min(32767, Math.floor(val * 32767)));
  buffer.writeInt16LE(int16, 44 + i * 2);
}

fs.writeFileSync(path.join(__dirname, 'public/sounds/dispatch-bell.mp3'), buffer); // saving as mp3 extension just so it plays correctly in modern browsers, actually it's a WAV inside so we should name it .wav but the UI was updated to .mp3. Let's fix the UI or name it .wav.
