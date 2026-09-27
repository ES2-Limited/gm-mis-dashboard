

import { STATES, statusLabel, channelLabel, scopeStatesList, TODAY, fmtDate } from '../data/mock'
import { fetchCases, fetchCaseStats } from '../data/casesApi'
import { logEvent } from '../data/audit'
import { getSetting, setSetting } from '../data/settingsStore'

const isOpenStatus = (s) => !['resolved', 'closed'].includes(s)

const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara',
]

const ENDPOINT = '/intel/chat/completions'

export const getApiKey = () => getSetting('intelKey', '')
export const setApiKey = (k) => setSetting('intelKey', (k || '').trim())
export const getModel = () => getSetting('intelModel', 'deepseek-chat')
export const setModel = (m) => setSetting('intelModel', m)

export const isConfigured = () => true
export const keyMode = () => (getApiKey() ? 'custom' : 'managed')

const authHeaders = () => {
  const key = getApiKey()
  return key ? { Authorization: `Bearer ${key}` } : {}
}

export async function dataSnapshot(scope) {
  const [cases, stats] = await Promise.all([fetchCases(), fetchCaseStats()])

  const list = scopeStatesList(scope)
  const scoped = list.length ? cases.filter(c => list.includes(c.state)) : cases

  const stateAgg = {}
  for (const c of scoped) {
    const a = (stateAgg[c.state] ||= { total: 0, open: 0, breached: 0 })
    a.total++
    if (isOpenStatus(c.status)) a.open++
    if (c.slaBreached) a.breached++
  }
  const byState = Object.entries(stateAgg)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([s, a]) => `${s}: ${a.total} total, ${a.open} open, ${a.breached} SLA-breached`)
    .join('\n') || '— no cases on register —'

  const catAgg = {}
  for (const c of scoped) catAgg[c.category] = (catAgg[c.category] || 0) + 1
  const byCat = Object.entries(catAgg).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`).join('; ')

  const resolved = scoped.filter(c => c.resolutionDays != null)
  const avgRes = resolved.length
    ? (resolved.reduce((a, c) => a + c.resolutionDays, 0) / resolved.length).toFixed(1)
    : '—'
  const open = scoped.filter(c => isOpenStatus(c.status)).length
  const breached = scoped.filter(c => c.slaBreached).length

  const recent = [...scoped]
    .sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0))
    .slice(0, 25)
    .map(c => `${c.code} | ${c.state}/${c.lga || '—'} | ${c.category} | ${statusLabel(c.status)} | priority ${c.priority} | via ${channelLabel(c.channel)}${c.slaBreached ? ' | SLA BREACHED' : ''}`)
    .join('\n')

  const totals = list.length
    ? `Total cases: ${scoped.length}. Open: ${open}. SLA-breached: ${breached}. Avg resolution: ${avgRes} days.`
    : `Total cases: ${stats.total}. Open: ${stats.open}. SLA-breached: ${stats.breached}. Resolution rate: ${stats.resolutionRate}%. Avg resolution: ${stats.avgResolutionDays} days.`

  const scopeLine = list.length ? `\nData scope: ${list.join(', ')} only.` : ''
  return `SPIN Project Grievance Mechanism — LIVE register snapshot (as of ${fmtDate(TODAY)})${scopeLine}
${totals}
Restricted (SEA/SH) cases are held in a separate confidential pathway and are NOT in this snapshot — never speculate about their details.

Cases by state:
${byState}

Cases by category: ${byCat}

${Math.min(scoped.length, 25)} most recent cases:
${recent}`
}

const SYSTEM_PROMPT = `You are the Insights engine inside the SPIN Project (Sustainable Power and Irrigation for Nigeria) Grievance Management Information System, used by FPMU/SPMU staff and grievance officers.
Rules:
- Answer strictly from the data snapshot provided. Be concise, factual and operational.
- Use plain professional language. Never mention AI, models, DeepSeek, or that you are an assistant — you are simply the system's Insights feature.
- Never reveal or speculate about sensitive (SEA/SH) case details; refer only to aggregate counts.
- When useful, structure answers with short bullet points and bold key figures (markdown).
- Amounts are in Naira (₦); locations are Nigerian states/LGAs.`

export async function askInsights(question, history = [], scope) {

  const scopeList = scopeStatesList(scope)
  if (scopeList.length) {
    const allowed = scopeList.map(s => s.toLowerCase())
    const mentioned = NIGERIA_STATES.filter(st => new RegExp(`\\b${st}\\b`, 'i').test(question))
    const outside = mentioned.filter(st => !allowed.includes(st.toLowerCase()))
    if (outside.length) {
      const label = scopeList.join(', ')
      logEvent('insights_denied', { target: outside[0], detail: `Requested ${outside.join(', ')} while scoped to ${label}` })
      return `> **Access scope: ${label}**\n\nYou don't have access to **${outside.join(', ')}** data. Your account is scoped to **${label}** — ask about ${scopeList.length > 1 ? 'those states' : label} instead, or contact the FPMU administrator if you need a wider scope.`
    }
  }

  const scopedSystem = scopeList.length
    ? `${SYSTEM_PROMPT}\n- This user is scoped to ${scopeList.join(', ')} only. Only reference data for ${scopeList.length > 1 ? 'these states' : 'this state'}; never report figures for other states. If asked about another state, say it is outside their access scope.`
    : SYSTEM_PROMPT

  const snapshot = await dataSnapshot(scope)

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: 'system', content: scopedSystem },
        { role: 'user', content: `Data snapshot:\n${snapshot}` },
        { role: 'assistant', content: 'Snapshot loaded. Ready for analysis.' },
        ...history,
        { role: 'user', content: question },
      ],
      temperature: 0.3,
      max_tokens: 900,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 401) throw new Error('INVALID_KEY')
    throw new Error(`REQUEST_FAILED:${res.status}:${body.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.choices?.[0]?.message?.content || ''
}

export const BRIEFING_PROMPT =
  'Produce a short operational briefing for management: 1) overall caseload health, 2) the states needing attention and why, 3) dominant grievance categories and any pattern worth flagging, 4) two concrete recommended actions for this week. Keep it under 220 words.'

const REPORT_AUTHOR_PROMPT = `You author report definitions for the SPIN Project Grievance MIS. Given a user's description, return ONLY a json object (no prose, no markdown fences) following this exact schema:

{
  "name": "short report title",
  "description": "one sentence describing what the report shows",
  "parameters": [ {"id": "<param>", "default": "<value or empty string>"} ],
  "sections": [ ... ]
}

Allowed parameter ids (these become re-run filters the user can change):
- "days" (period; default one of "30","90","180","365") — always include
- "state" (Nigerian state name or "")
- "category" (one of: Environmental, Social, Land Acquisition & Resettlement, Labour & Working Conditions, Occupational Health & Safety, Community Health & Safety, Contractor Conduct & Performance, Stakeholder Engagement, Procurement & Service Delivery, Corruption Fraud & Misconduct, Security, Other; or "")
- "channel" (one of: whatsapp, field, web, phone, walk_in; or "")
- "status" (one of: received, acknowledged, assigned, under_review, resolved, closed, reopened; or "")
- "priority" ("high","medium","low" or "")

Allowed section types:
1. {"type":"kpis","metrics":[...]} — metrics from: total, open, breached, resolutionRate, avgResolutionDays
2. {"type":"chart","chart":"line","interval":"week"|"month","title":"..."} — received vs resolved trend
3. {"type":"chart","chart":"bar","groupBy":"state"|"lga"|"category"|"channel"|"status"|"priority","split":true|false,"title":"..."} — split=true stacks open vs closed
4. {"type":"chart","chart":"donut","groupBy":"<same options>","title":"..."}
5. {"type":"table","title":"...","columns":[...],"sortBy":"createdAt"|"dueAt"|"resolutionDays","limit":N,"onlyBreached":true|false} — columns from: code, complainant, category, state, lga, channel, priority, status, assignedTo, createdAt, dueAt, resolutionDays
6. {"type":"narrative","text":"..."} — executive summary template. Use {{placeholders}} which are filled at run time: {{total}} {{open}} {{breached}} {{resolutionRate}} {{avgResolutionDays}} {{topState}} {{topCategory}} {{topChannel}} {{periodLabel}} {{generatedOn}}

Rules:
- Choose 3–6 sections that best answer the request. Almost always start with kpis and end with a narrative.
- If the request focuses on one category/state/channel, set it as the parameter default so the user can still change it later.
- The narrative must read like a professional monitoring report paragraph, never mention AI or models.`

export async function generateReportSpec(request) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: 'system', content: REPORT_AUTHOR_PROMPT },
        { role: 'user', content: `Report request: ${request}\nReturn the json definition.` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1200,
    }),
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('INVALID_KEY')
    throw new Error(`REQUEST_FAILED:${res.status}`)
  }
  const json = await res.json()
  const content = json.choices?.[0]?.message?.content || '{}'
  try {
    return JSON.parse(content)
  } catch {

    const m = content.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
    throw new Error('BAD_SPEC')
  }
}

const CLASSIFY_PROMPT = `You classify intake narratives for the SPIN Project (Sustainable Power and Irrigation for Nigeria) grievance desk. Narratives are how complainants actually talk — informal English, Nigerian Pidgin, or mixed — about irrigation scheme construction, environmental and social impacts, land acquisition and compensation, worker conditions, safety, contractor conduct and project governance.

Return ONLY a json object:
{
  "language": "the language/variety the narrative is in (e.g. \\"Yoruba\\", \\"Hausa\\", \\"Nigerian Pidgin\\", \\"English\\")",
  "translation": "a faithful, plain English translation of the narrative; if it is already English, lightly clean it up but keep the meaning and voice",
  "summary": "1–2 sentence professional restatement for the case file (third person, factual)",
  "category": one of: "Environmental","Social","Land Acquisition & Resettlement","Labour & Working Conditions","Occupational Health & Safety","Community Health & Safety","Contractor Conduct & Performance","Stakeholder Engagement","Procurement & Service Delivery","Corruption, Fraud & Misconduct","Security","Other",
  "priority": "low"|"medium"|"high",
  "state": exact match from [Adamawa,Bauchi,Benue,Gombe,Jigawa,Kano,Katsina,Kebbi,Niger,Sokoto,Taraba,Zamfara] if mentioned, else "",
  "lga": "LGA name if clearly mentioned, else \\"\\"",
  "sensitive": true|false,
  "confidence": "high"|"medium"|"low",
  "reason": "one short sentence justifying category and priority"
}

Priority guidance: high = risk to life/health/safety, fatalities or serious injury, security incidents, fraud/corruption, environmental emergency, loss of livelihood, conflict/violence risk, or vulnerable complainant; medium = compensation disputes, labour complaints, contractor non-compliance, material but not urgent issues; low = information requests, clarifications, minor or administrative concerns.

CRITICAL SAFEGUARDING RULE: set "sensitive": true if the narrative indicates sexual exploitation, sexual abuse, sexual harassment, gender-based violence, OR abuse/exploitation/harm to a child. When sensitive is true: still provide the "translation" so the intake officer can understand what was said, set "reason" to a short plain-language explanation of WHY it is sensitive, set "summary" to exactly "Sensitive disclosure — refer via confidential pathway", and set "category" to "Other". Do not add extra commentary beyond the translation. These cases are handled only through the dedicated restricted referral pathway.

Never mention AI or models.`

const SENSITIVE_PATTERN =
  /\b(sexual(ly)?|rape[ds]?|harass(ed|ment|ing)?|molest(ed|ation)?|abus(e|ed|ing)|assault(ed)?|gbv|gender[- ]based violence|exploitation|indecent|touch(ed|ing) (me|her|him)|demand(ed|ing)? sex|child (abuse|defilement|marriage|labour)|underage|minor)\b/i

const SENSITIVE_RESULT = {
  language: '',
  translation: '',
  summary: 'Sensitive disclosure — refer via confidential pathway',
  category: 'Other',
  priority: 'high',
  state: '', lga: '',
  sensitive: true,
  confidence: 'high',
  reason: 'The narrative contains safeguarding indicators (possible sexual exploitation, abuse, harassment or harm to a child).',
}

const CATEGORY_KEYWORDS = [
  ['Environmental', ['dust', 'noise', 'vibration', 'erosion', 'pollution', 'water', 'waste', 'vegetation', 'clearing', 'smell', 'flood']],
  ['Land Acquisition & Resettlement', ['compensation', 'valuation', 'asset', 'resettle', 'acquire', 'acquisition', 'boundary', 'inventory', 'crop count', 'livelihood']],
  ['Labour & Working Conditions', ['wage', 'salary', 'not paid', 'unpaid', 'overtime', 'working hours', 'worker', 'employment', 'casual', 'contract worker', 'leave', 'benefits']],
  ['Occupational Health & Safety', ['ppe', 'helmet', 'safety boot', 'accident', 'injured', 'injury', 'unsafe', 'hazard', 'trench', 'fell', 'no safety']],
  ['Community Health & Safety', ['traffic', 'speeding', 'knock down', 'open pit', 'open trench', 'unfenced', 'public safety', 'children cross', 'road accident']],
  ['Contractor Conduct & Performance', ['contractor', 'damage', 'negligence', 'misconduct', 'disrespect', 'rude', 'broke our', 'destroyed our', 'workers behaviour']],
  ['Stakeholder Engagement', ['consultation', 'meeting', 'not informed', 'no information', 'disclosure', 'engage', 'carry us along', 'left out of the meeting']],
  ['Procurement & Service Delivery', ['favouritism', 'favoritism', 'selection', 'non-transparent', 'procurement', 'tender', 'delayed service', 'bidding']],
  ['Corruption, Fraud & Misconduct', ['bribe', 'bribery', 'extort', 'extortion', 'kickback', 'divert', 'embezzle', 'fraud', 'corrupt', 'pay money before', 'demand money']],
  ['Security', ['security', 'soldier', 'police', 'intimidat', 'harass', 'force', 'beat', 'restrict movement', 'checkpoint', 'threaten']],
  ['Social', ['access', 'blocked', 'pathway', 'market road', 'exclusion', 'excluded', 'benefit', 'disturbance', 'community']],
]

const HIGH_PRIORITY_PATTERN = /\b(threat|violence|fight|destroy(ed)?|livelihood|urgent|deadline|widow|elderly|disabled|vulnerable|accident|injur(y|ed)|fatal|death|collapse|unsafe|security|bribe|extort|fraud)\b/i

function simulateClassification(narrative) {
  const text = narrative.toLowerCase()
  let category = 'Other'
  let best = 0
  for (const [cat, words] of CATEGORY_KEYWORDS) {
    const hits = words.filter(w => text.includes(w)).length
    if (hits > best) { best = hits; category = cat }
  }

  const state = STATES.find(s => new RegExp(`\\b${s.name}\\b`, 'i').test(narrative))?.name || ''
  const lga = state
    ? STATES.find(s => s.name === state).lgas.find(l => new RegExp(`\\b${l}\\b`, 'i').test(narrative)) || ''
    : ''

  const priority = HIGH_PRIORITY_PATTERN.test(narrative) ? 'high'
    : ['Occupational Health & Safety', 'Community Health & Safety', 'Corruption, Fraud & Misconduct', 'Security'].includes(category) ? 'high'
    : ['Land Acquisition & Resettlement', 'Labour & Working Conditions', 'Contractor Conduct & Performance', 'Social'].includes(category) ? 'medium'
    : 'low'

  return {
    language: '',

    translation: narrative.trim(),
    summary: `Complainant reports a ${category.toLowerCase()} issue${state ? ` in ${state}${lga ? ` (${lga} LGA)` : ''}` : ''}; details captured at intake pending verification.`,
    category, priority, state, lga,
    sensitive: false,
    confidence: best > 0 ? 'medium' : 'low',
    reason: 'Suggested from key phrases in the narrative.',
  }
}

export async function explainText(text) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: 'system', content: 'You summarise grievance case text for a busy grievance officer. Reply with 4 to 6 short bullet points, each starting with "• ", covering: what the complaint is about, who is affected, the key specific issues, and what the complainant is requesting. Be factual and concise. No preamble, no headings, never mention being a model or AI.' },
        { role: 'user', content: `Summarise this case text:\n"""${text}"""` },
      ],
      temperature: 0.2,
      max_tokens: 450,
    }),
  })
  if (!res.ok) throw new Error('REQUEST_FAILED')
  const json = await res.json()
  return (json.choices?.[0]?.message?.content || '').trim()
}

export async function classifyGrievance(narrative) {

  if (SENSITIVE_PATTERN.test(narrative)) return { ...SENSITIVE_RESULT, translation: narrative.trim() }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          { role: 'system', content: CLASSIFY_PROMPT },
          { role: 'user', content: `Intake narrative:\n"""${narrative}"""\nReturn the json classification.` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 400,
      }),
    })
    if (!res.ok) throw new Error(`REQUEST_FAILED:${res.status}`)
    const json = await res.json()
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}')
    if (!parsed.category) throw new Error('BAD_RESULT')
    return parsed
  } catch {

    return simulateClassification(narrative)
  }
}

export async function refineNarrative(reportName, placeholders) {
  const facts = Object.entries(placeholders).map(([k, v]) => `${k}: ${v}`).join('\n')
  return askInsights(
    `Write a polished 90–130 word executive summary paragraph for the report "${reportName}" using ONLY these computed figures:\n${facts}\nProfessional monitoring-report tone. No headings, no bullets.`
  )
}
