import {createReadStream, createWriteStream, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {CucumberHtmlStream} from '@cucumber/html-formatter';
import {NdjsonToMessageStream} from '@cucumber/message-streams';

const reportsDir = 'reports';
const ndjsonPath = join(reportsDir, 'feature.ndjson');
const htmlPath = join(reportsDir, 'feature-report.html');

// Ensure the reports directory exists.
mkdirSync(reportsDir, {recursive: true});

// Generate the HTML report by piping the ndjson through the transformer.
try {
    await pipeline(
        createReadStream(ndjsonPath, {encoding: 'utf8'}),
        new NdjsonToMessageStream(), // Convert each NDJSON line into message envelopes for the formatter.
        new CucumberHtmlStream(),
        createWriteStream(htmlPath, {encoding: 'utf8'}),
    );
} catch (e) {
    console.error('Failed to generate the HTML report. Make sure to run `npm run test:feature` first.');
    console.error(e?.message || e);
    process.exit(1);
}

console.log(`Feature HTML report generated at: ${htmlPath}`);
