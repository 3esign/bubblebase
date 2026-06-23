import fs from 'fs';
import path from 'path';

const logPath = 'C:\\Users\\treed\\.gemini\\antigravity\\brain\\830eb3ed-e030-4c8e-9371-6ac51b12a149\\.system_generated\\logs\\transcript.jsonl';
const outDir = 'C:\\Users\\treed\\.gemini\\antigravity\\brain\\830eb3ed-e030-4c8e-9371-6ac51b12a149\\scratch';
const outPath = path.join(outDir, 'step463.txt');

try {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const fileStream = fs.createReadStream(logPath, 'utf8');
  let remaining = '';

  fileStream.on('data', (chunk) => {
    remaining += chunk;
    let index = remaining.indexOf('\n');
    while (index > -1) {
      const line = remaining.substring(0, index);
      remaining = remaining.substring(index + 1);
      if (line.includes('"step_index":463,')) {
        const obj = JSON.parse(line);
        fs.writeFileSync(outPath, obj.content, 'utf8');
        console.log('Saved successfully to ' + outPath);
        process.exit(0);
      }
      index = remaining.indexOf('\n');
    }
  });

  fileStream.on('end', () => {
    console.log('Finished reading file. Step 463 not found.');
  });
} catch (error) {
  console.error('Error:', error);
}
