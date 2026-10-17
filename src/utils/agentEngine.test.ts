import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripHtmlAndBoilerplate,
  normalizeCacheKey,
  matchFaqCache,
  calculateRunCost,
  evaluateIcpFit,
  verifyGroundedness,
  trimConversationWindow,
  formatGtmLeadsCsv,
  type FaqItem,
} from './agentEngine.ts';

test('stripHtmlAndBoilerplate removes scripts, styles, nav, footer and saves tokens', () => {
  const noisyHtml = `
    <html>
      <head>
        <style>.btn { color: red; padding: 20px; }</style>
        <script>console.log("tracking pixel 1234567890");</script>
      </head>
      <body>
        <nav>Home | About | Careers | Privacy Policy | Terms of Service</nav>
        <main>
          <h1>DentaCare Implant & Orthodontics Dhaka</h1>
          <p>We provide dental implants, root canal therapy, and WhatsApp patient booking.</p>
        </main>
        <footer>Copyright 2026 All Rights Reserved</footer>
      </body>
    </html>
  `;

  const res = stripHtmlAndBoilerplate(noisyHtml);
  assert.equal(res.cleanedText.includes('console.log'), false);
  assert.equal(res.cleanedText.includes('DentaCare Implant'), true);
  assert.equal(res.cleanedEstimatedTokens < res.rawEstimatedTokens, true);
  assert.equal(res.tokensSavedPct > 35, true);
});

test('matchFaqCache hits Layer 0 zero-token cache for FAQ questions and bypasses qualification messages', () => {
  const sampleFaqs: FaqItem[] = [
    {
      id: 'faq-pricing',
      category: 'Pricing',
      question: 'How much does your AI agent & n8n automation package cost?',
      keywords: ['price', 'pricing', 'cost', 'monthly', 'package', 'rate'],
      answer: 'Our starter 24/7 WhatsApp & Web AI Agent package starts at $490/month.',
    },
  ];

  const hit = matchFaqCache('Hi, what is your monthly pricing and cost for the package?', sampleFaqs);
  assert.equal(hit.matched, true);
  assert.equal(hit.faq?.id, 'faq-pricing');

  const qualifyMsg = matchFaqCache(
    'We run a dental clinic and our budget is $1200 per month to book patients',
    sampleFaqs
  );
  assert.equal(qualifyMsg.matched, false);
});

test('calculateRunCost returns $0.00 for Layer 0 cache hits and Ollama local models', () => {
  const cachedCost = calculateRunCost({
    modelUsed: 'gemini-3.1-flash-lite',
    cacheHit: true,
    inputTokens: 450,
    outputTokens: 180,
  });
  assert.equal(cachedCost.estimatedCostUsd, 0);
  assert.equal(cachedCost.totalTokens, 0);
  assert.equal(cachedCost.costSavedUsd > 0, true);

  const ollamaCost = calculateRunCost({
    modelUsed: 'ollama-llama3.2-3b',
    cacheHit: false,
    inputTokens: 500,
    outputTokens: 200,
  });
  assert.equal(ollamaCost.estimatedCostUsd, 0);
  assert.equal(ollamaCost.totalTokens, 700);
});

test('evaluateIcpFit scores high-fit leads above threshold and skips low-fit leads', () => {
  const highFit = evaluateIcpFit(
    'DentaCare Clinic in Dhaka offers dental implant consultation, patient appointment booking, and WhatsApp customer support for 200 inbound leads.',
    'Healthcare Clinic',
    60
  );
  assert.equal(highFit.icpScore >= 60, true);
  assert.equal(highFit.qualificationStatus, 'QUALIFIED_OUTBOUND');

  const lowFit = evaluateIcpFit(
    'My personal diary and retired hobby page with no commercial services.',
    'Personal Blog',
    60
  );
  assert.equal(lowFit.icpScore < 60, true);
  assert.equal(lowFit.qualificationStatus, 'SKIPPED_LOW_ICP');
});

test('verifyGroundedness 5-layer gate passes truthful claims and catches fabricated numbers', () => {
  const sourceText =
    'DentaCare Dhaka provides cosmetic dentistry and orthodontic braces across 3 branches in Uttara and Banani.';
  const facts = ['Offers cosmetic dentistry and orthodontic braces', 'Operates 3 branches in Dhaka'];

  const cleanAudit = verifyGroundedness({
    sourceText,
    companyName: 'DentaCare Dhaka',
    extractedFacts: facts,
    generatedTexts: [
      'Hi DentaCare Dhaka team, we saw you operate 3 branches in Uttara and Banani offering cosmetic dentistry. Our 24/7 AI agent can qualify and book your patients automatically.',
    ],
  });
  assert.equal(cleanAudit.passed, true);
  assert.equal(cleanAudit.blockedHallucinationsCount, 0);

  const hallucinatedAudit = verifyGroundedness({
    sourceText,
    companyName: 'DentaCare Dhaka',
    extractedFacts: facts,
    generatedTexts: [
      'Congrats to DentaCare Dhaka on your 87branches and 942% revenue growth!',
    ],
  });
  assert.equal(hallucinatedAudit.passed, false);
  assert.equal(hallucinatedAudit.blockedHallucinationsCount > 0, true);
});

test('trimConversationWindow caps memory at 6 messages and reports saved tokens', () => {
  const turns = Array.from({ length: 10 }, (_, idx) => ({
    role: (idx % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `Turn message number ${idx + 1} with customer qualification context.`,
    timestamp: '10:00 AM',
  }));

  const res = trimConversationWindow(turns, 6);
  assert.equal(res.trimmed.length, 6);
  assert.equal(res.droppedCount, 4);
  assert.equal(res.tokensSavedEstimate > 0, true);
});

test('formatGtmLeadsCsv exports company name, industry, and ICP match score properly', () => {
  const csv = formatGtmLeadsCsv([
    {
      companyName: 'DentaCare Aesthetic & Implant Center Dhaka',
      industry: 'Healthcare & Dental Clinic',
      icpScore: 96,
      qualificationStatus: 'QUALIFIED_OUTBOUND',
      sourceUrl: 'https://dentacare-dhaka.example.com',
      tokensSavedPct: 37.6,
      modelLabel: 'Gemini 3.8 Flash',
      cacheHit: false,
      estimatedCostUsd: 0.000185,
      summary: '12-chair specialist clinic in Dhaka.',
      coldEmailSubject: 'Fixing after-8 PM WhatsApp bookings',
    },
  ]);

  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].includes('Company Name,Industry,ICP Match Score'), true);
  assert.equal(lines[1].includes('"DentaCare Aesthetic & Implant Center Dhaka"'), true);
  assert.equal(lines[1].includes('"Healthcare & Dental Clinic"'), true);
  assert.equal(lines[1].includes(',96,'), true);
});
