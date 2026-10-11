// Drawn from Engineering/PLAN-10.html and Engineering/index.html (the Fiverr Engineering Gig Pack).

export const GIGS = [
  { n: 1, id: '01', name: 'Custom MCP Server Development', price: '$85 – $600', tag: 'Publish first', note: 'Widest demand-to-supply gap: ~683 listings against a 938% Claude Code wave.' },
  { n: 2, id: 'M1', name: 'Dockerize, Deploy & CI/CD Pipeline', price: '$45 – $390', tag: 'Top of funnel', note: 'Highest search volume you own.' },
  { n: 3, id: 'M2', name: 'Vibe-Code Audit & Rescue', price: '$95 – $650', tag: 'Strongest evidence', note: 'Urgent buyers, near-zero real competition.' },
  { n: 4, id: '02', name: 'Self-Hosted n8n + AI Workflows', price: '$60 – $380', tag: 'Review machine', note: 'Cheap, fast, repeatable. Buys your first reviews.' },
  { n: 5, id: 'M3', name: 'Cloud Cost & Visibility Audit', price: '$75 – $550', tag: 'Best margin', note: 'ROI the buyer verifies on their next bill.' },
  { n: 6, id: '05', name: 'Terraform Infrastructure as Code', price: '$120 – $900', tag: 'Credibility anchor', note: 'Makes buyers believe the other nine.' },
  { n: 7, id: '07', name: '3-Day AI SaaS MVP', price: '$350 – $1,500', tag: 'High ticket', note: 'One order equals twenty-five small ones.' },
  { n: 8, id: '11', name: 'Claude Code & AI Agent Setup', price: '$120 – $750', tag: 'Level 1', note: 'Unlocks with the 10th slot.' },
  { n: 9, id: '13', name: 'Prototype to Production Rebuild', price: '$180 – $1,600', tag: 'Level 1', note: 'Best clients, agencies quote $5–15k.' },
  { n: 10, id: '06', name: 'RAG AI Assistant on Your Docs', price: '$110 – $750', tag: 'Level 1', note: 'Crowded; your Azure AI certs are the proof.' },
]

// `day` is relative to the launch start date the user picks.
export const LAUNCH = [
  { id: 'f1', day: 1, end: 2, title: 'Rewrite the profile as an engineer', detail: 'Tagline: “DevOps & Cloud Engineer | AWS & Azure | AI Agents, MCP & Automation”. New photo, all skills, 4 Microsoft certs, education, GitHub linked, 4 portfolio projects.' },
  { id: 'f2', day: 3, end: 5, title: 'Build delivery templates first', detail: 'Dockerfile library + reusable workflows (M1), n8n docker-compose stack (02), 40-point audit checklist (M2), cost-audit script + Grafana stack (M3).' },
  { id: 'f3', day: 6, end: 7, title: 'Design galleries for gigs #1 and #2', detail: 'Three images each from images.html. Build the Figma overlay template once; later gigs take an hour.' },
  { id: 'f4', day: 8, end: 8, title: 'Publish #1 MCP Server + #2 Deploy & CI/CD', detail: 'Final title on publish: the gig URL is permanent.' },
  { id: 'f5', day: 9, end: 14, title: 'Work the new-gig window', detail: 'Reply within 15 minutes, take every sensible order, deliver early, record gig videos for #1 and #2.' },
  { id: 'f6', day: 15, end: 15, title: 'Publish #3 Audit & Rescue + #4 n8n', detail: 'You should have a review or two by now.' },
  { id: 'f7', day: 16, end: 21, title: 'Deliver, ask for reviews, offer retainers', detail: '“If this is working well for you, a review genuinely helps me out. If anything is not right, tell me first and I will fix it.”' },
  { id: 'f8', day: 22, end: 22, title: 'Publish #5 Cost, #6 Terraform, #7 MVP', detail: 'Higher-ticket gigs convert far better with reviews already on the profile.' },
  { id: 'f9', day: 23, end: 30, title: 'Pause design gigs one at a time', detail: 'Lowest Success Score first. Pause, never delete.' },
  { id: 'f10', day: 60, end: 60, title: 'Level 1 → publish #8, #9, #10', detail: '60 active days · 5 orders from 3 buyers · $400 · 4.4★ · 80% response · Success Score 5+.' },
]

export const FIVERR_RULES = [
  'Reply to every message within 15 minutes during waking hours. Turn on app notifications.',
  'Never take payment or communication off Fiverr.',
  'Change one thing at a time and give it 14 days.',
  'Run Basic ~25% below list for the first 10–14 days, then return to full price at 3 reviews.',
  'Raise prices ~15% after every 5–7 five-star reviews.',
  'Decline what you cannot deliver. A late delivery costs more than a lost order.',
]

export const LEVELS = [
  { name: 'New Seller', req: 'Where you start', unlock: '7 gig slots' },
  { name: 'Level 1', req: '60 days · 5 orders / 3 buyers · $400 · 4.4★ · SS 5+', unlock: '10 slots · Promoted Gigs' },
  { name: 'Level 2', req: '120 days · 20 orders / 10 buyers · $2,000 · 4.6★ · SS 7+', unlock: '20 slots' },
  { name: 'Top Rated', req: 'Manual · Success Score 9 · sustained', unlock: '30 slots' },
]
