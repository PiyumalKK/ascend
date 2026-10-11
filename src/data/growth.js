// Career, content, wealth and roadmap data.

export const CERTS = [
  { name: 'AZ-900 · AZ-104 · AI-102 · AI-103', status: 'done', when: 'Earned', why: 'Your foundation. Most Fiverr competitors have none of these.' },
  { name: 'AWS Solutions Architect Associate (SAA-C03)', status: 'now', when: 'Oct – Dec 2026', why: 'Already in progress. Completes the multi-cloud story on your CV.' },
  { name: 'HashiCorp Terraform Associate', status: 'next', when: 'Jan 2027', why: 'Quick win: you write Terraform every day. Backs up your Terraform gig.' },
  { name: 'AZ-400 → DevOps Engineer Expert', status: 'next', when: 'Feb – Mar 2027', why: 'AZ-104 + AZ-400 earns the Microsoft Expert badge. Highest return for the effort.' },
  { name: 'CKA · Certified Kubernetes Administrator', status: 'later', when: 'Apr – Jun 2027', why: 'Hands-on exam. Proves Kubernetes depth, which senior DevOps roles screen for.' },
  { name: 'AWS DevOps Engineer Professional', status: 'later', when: 'H2 2027', why: 'The senior-level signal for AWS DevOps roles.' },
]

export const ENGLISH = [
  { t: 'Input every day', d: 'Commute audio: BBC 6 Minute English → tech podcasts → conference talks. Increase difficulty every month.' },
  { t: 'Output every day', d: '30-minute speaking lab: record, shadow, AI conversation, mock interview, LinkedIn post. Output is what builds spoken fluency.' },
  { t: 'Speak at work', d: 'One contribution in every meeting, even a question. Prepare it during the commute.' },
  { t: 'Explain what you build', d: 'Your 2-minute Monday videos double as content for channel D and as Fiverr gig video practice.' },
  { t: 'Measure it', d: 'Record the same 2-minute topic on the 1st of each month. Compare it against last month’s recording.' },
]

export const DOMAIN = [
  'AWS networking deep dive: VPC, Transit Gateway, PrivateLink, Route 53',
  'Kubernetes beyond deploy: operators, Helm, GitOps with Argo CD',
  'Platform engineering: golden paths, Backstage, internal developer platforms',
  'Observability: OpenTelemetry, SLOs and error budgets',
  'Security: OIDC everywhere, policy-as-code (OPA), supply chain (SBOM, Sigstore)',
  'AI ops: MCP servers, agent guardrails, LLM cost control (your edge)',
]

export const CONTENT_PIPELINE = [
  { step: 'Research', tool: 'Trends, comments, competitor top posts', time: '10%' },
  { step: 'Script', tool: 'AI draft → YOUR hook + YOUR angle', time: '20%' },
  { step: 'Voice', tool: 'AI voice or your own voice', time: '10%' },
  { step: 'Visuals', tool: 'AI video / image + stock + screen', time: '25%' },
  { step: 'Edit', tool: 'CapCut templates per channel', time: '25%' },
  { step: 'Schedule', tool: 'Meta Business Suite, 28 / week', time: '10%' },
]

export const CONTENT_RULES = [
  'Meta cuts reach and monetization for unoriginal or repetitive content, including low-effort AI clips. Add commentary, a story and your own edit to every video.',
  'Content Monetization is invite-only. Express interest from your Professional Dashboard. No follower count guarantees entry.',
  'Label realistic AI-generated visuals with Meta’s AI label. It protects the page.',
  'One niche per channel. Never mix topics on a channel.',
  'Start at 1 video / day / channel only once the pipeline is templated. Quality first, then volume.',
  'Every Sunday, read analytics and make more of the top 20%.',
]

export const CHANNEL_SUGGESTIONS = [
  'Tech & AI explained simply (feeds your Fiverr and your English)',
  'Motivation / successful lives stories',
  'Sri Lanka facts, history & travel',
  'Money & business lessons',
]

export const WEALTH_WEEKS = [
  { w: 1, t: 'Foundation', d: 'Budget, a 6-month emergency fund, and the difference between LKR and USD income.' },
  { w: 2, t: 'Getting paid', d: 'Fiverr → Payoneer → Sri Lankan bank. Foreign currency accounts. Your tax obligations as a freelancer.' },
  { w: 3, t: 'CSE & unit trusts', d: 'How the Colombo Stock Exchange works, unit trusts, fees, risk.' },
  { w: 4, t: 'Index investing', d: 'Why most investors cannot beat the index. Compounding maths.' },
  { w: 5, t: 'Crypto fundamentals', d: 'Bitcoin, Ethereum, wallets, self-custody. Your ZK Voting work gives you a real edge here.' },
  { w: 6, t: 'Crypto risk', d: 'Scams, rug pulls, leverage, exchange failures. Check the Central Bank of Sri Lanka’s position on crypto.' },
  { w: 7, t: 'E-money & fintech', d: 'Payment rails, stablecoins, remittances. Connect it to your fintech DevOps experience.' },
  { w: 8, t: 'Digital products', d: 'Sell Terraform modules, CI templates and n8n workflows you already built for Fiverr.' },
  { w: 9, t: 'Micro-SaaS', d: 'One painful problem, $9–29 / month, built with your MVP gig stack.' },
  { w: 10, t: 'Agency model', d: 'Fiverr → retainers → subcontractors. When to hire your first helper.' },
  { w: 11, t: 'Media economics', d: 'RPM, sponsorships, affiliate links. Making the 4 channels pay beyond ads.' },
  { w: 12, t: 'Your wealth thesis', d: 'Write a one-page 3-year plan: income streams, savings rate, allocation rules.' },
]

export const WEALTH_GUARDRAILS = [
  'Emergency fund first, investing second.',
  'Speculative crypto: never more than 5% of what you can invest. Never borrowed money.',
  'No leverage, no futures, no “signal groups”.',
  'If a return is guaranteed, it is a scam. Pyramid schemes target Sri Lankan freelancers.',
  'Research for 12 weeks before risking any rupees.',
  'Your best investment right now is your own skills. Certs and Fiverr reviews compound faster than any coin.',
]

export const ROADMAP = [
  { when: 'Oct 2026', items: ['Profile rewritten, templates built', 'Gigs #1 + #2 live', '4 channels set up with batch pipeline', '04:00 routine locked in'] },
  { when: 'Nov 2026', items: ['Gigs #3–#7 live', 'First 5 Fiverr reviews', 'Design gigs paused', '28 videos / week shipping'] },
  { when: 'Dec 2026', items: ['AWS SAA-C03 passed', 'Fiverr Level 1 → gigs #8–#10', 'Wealth curriculum complete', '90-day content streak'] },
  { when: 'Q1 2027', items: ['Terraform Associate', 'AZ-400 → DevOps Engineer Expert', 'First Fiverr retainer client', 'Apply for FB monetization'] },
  { when: 'Q2 2027', items: ['CKA', 'Fiverr Level 2 push', 'First digital product launched', 'English: lead a meeting'] },
  { when: 'Q3–Q4 2027', items: ['Bike → Plan B + gym', 'AWS DevOps Professional', 'Senior DevOps role / raise', 'Year 1 review'] },
]

export const SCORECARD = [
  { id: 'wake', label: 'Up at 04:00', pillar: 'mind' },
  { id: 'dw1', label: 'Deep Work I done', pillar: 'fiverr' },
  { id: 'move', label: 'Moved my body', pillar: 'body' },
  { id: 'content', label: '4 videos live (A·B·C·D)', pillar: 'content' },
  { id: 'inbox', label: 'Fiverr replies < 15 min', pillar: 'fiverr' },
  { id: 'english', label: '30 min English output', pillar: 'career' },
  { id: 'wealth', label: '20 min wealth research', pillar: 'wealth' },
  { id: 'prayer', label: 'Prayer', pillar: 'mind' },
  { id: 'sleep', label: 'Lights out 22:00', pillar: 'sleep' },
]
