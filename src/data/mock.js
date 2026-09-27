

import { getSetting, setSetting } from './settingsStore'

export const STATES = [
  { name: 'Adamawa', lat: 9.33, lng: 12.43, lgas: ['Yola North', 'Numan', 'Guyuk', 'Demsa'] },
  { name: 'Bauchi', lat: 10.31, lng: 9.84, lgas: ['Bauchi', 'Gamawa', 'Misau', 'Katagum'] },
  { name: 'Benue', lat: 7.73, lng: 8.54, lgas: ['Makurdi', 'Guma', 'Gboko', 'Otukpo'] },
  { name: 'Gombe', lat: 10.29, lng: 11.17, lgas: ['Gombe', 'Yamaltu/Deba', 'Balanga', 'Dukku'] },
  { name: 'Jigawa', lat: 11.76, lng: 9.34, lgas: ['Dutse', 'Hadejia', 'Ringim', 'Auyo'] },
  { name: 'Kano', lat: 12.0, lng: 8.52, lgas: ['Kano Municipal', 'Kura', 'Bunkure', 'Garun Mallam'] },
  { name: 'Katsina', lat: 12.99, lng: 7.6, lgas: ['Katsina', 'Funtua', 'Daura', 'Jibia'] },
  { name: 'Kebbi', lat: 12.45, lng: 4.2, lgas: ['Birnin Kebbi', 'Argungu', 'Yauri', 'Bagudo'] },
  { name: 'Niger', lat: 9.61, lng: 6.55, lgas: ['Chanchaga', 'Wushishi', 'Lavun', 'Mokwa'] },
  { name: 'Sokoto', lat: 13.06, lng: 5.24, lgas: ['Sokoto North', 'Wamako', 'Goronyo', 'Kware'] },
  { name: 'Taraba', lat: 8.89, lng: 11.36, lgas: ['Jalingo', 'Gassol', 'Wukari', 'Lau'] },
  { name: 'Zamfara', lat: 12.17, lng: 6.66, lgas: ['Gusau', 'Talata Mafara', 'Bakura', 'Maradun'] },
]

export const DOMAINS = ['Social', 'Environmental', 'Other']

const DOMAIN_BY_CATEGORY = {
  'Environmental': 'Environmental',
  'Social': 'Social',
  'Land Acquisition & Resettlement': 'Social',
  'Labour & Working Conditions': 'Social',
  'Occupational Health & Safety': 'Social',
  'Community Health & Safety': 'Social',
  'Contractor Conduct & Performance': 'Other',
  'Stakeholder Engagement': 'Social',
  'Procurement & Service Delivery': 'Other',
  'Corruption, Fraud & Misconduct': 'Other',
  'Security': 'Social',
  'SEA/SH & GBV': 'Social',
  'Child Protection': 'Social',
  'Other': 'Other',
}
export const domainForCategory = (name) => DOMAIN_BY_CATEGORY[name] || 'Other'

const TAXONOMY_BASE = [
  {
    name: 'Environmental',
    description: 'Complaints relating to environmental impacts resulting from project activities.',
    subgroups: ['Dust', 'Noise', 'Vibration', 'Erosion', 'Water Pollution', 'Waste Disposal', 'Vegetation Clearing'],
    responsible: ['Community', 'State PIU'],
    lead: 'Environmental Specialist',
    priority: 'medium',
  },
  {
    name: 'Social',
    description: 'Complaints affecting communities, livelihoods, access, or social relationships.',
    subgroups: ['Access Restrictions', 'Community Disturbances', 'Exclusion from Benefits', 'Disruption of Local Activities'],
    responsible: ['Community', 'State PIU'],
    lead: 'Social Specialist',
    priority: 'medium',
  },
  {
    name: 'Land Acquisition & Resettlement',
    description: 'Complaints arising from land acquisition, compensation, asset valuation, livelihood restoration, or resettlement activities.',
    subgroups: ['Compensation Disputes', 'Asset Inventory Disagreements', 'Land Boundary Disputes', 'Valuation Disputes', 'Resettlement Concerns', 'Livelihood Restoration'],
    responsible: ['State PIU', 'State Agencies'],
    lead: 'Resettlement & Lands Officer',
    priority: 'medium',
  },
  {
    name: 'Labour & Working Conditions',
    description: 'Complaints raised by project workers regarding employment and working conditions.',
    subgroups: ['Wage & Salary Issues', 'Working Conditions', 'Harassment & Discrimination', 'Worker Welfare', 'Contractual Disputes', 'Leave & Benefits', 'Excessive Working Hours', 'Child Labour Concerns', 'Forced Labour Concerns'],
    responsible: ['Contractor', 'State PIU'],
    lead: 'Labour Officer',
    priority: 'medium',
  },
  {
    name: 'Occupational Health & Safety',
    description: 'Complaints relating to workplace safety and worker welfare.',
    subgroups: ['Unsafe Working Conditions', 'Lack of PPE', 'Worksite Accidents', 'Exposure to Hazards'],
    responsible: ['Contractor', 'State PIU'],
    lead: 'Safeguards / OHS Officer',
    priority: 'high',
  },
  {
    name: 'Community Health & Safety',
    description: 'Complaints regarding risks posed to communities by project activities.',
    subgroups: ['Traffic Accidents', 'Unsafe Construction Sites', 'Public Safety Concerns'],
    responsible: ['Community', 'State PIU'],
    lead: 'Safeguards Officer',
    priority: 'high',
  },
  {
    name: 'Contractor Conduct & Performance',
    description: 'Complaints relating to the conduct, behaviour, or performance of contractors and workers.',
    subgroups: ['Misconduct', 'Negligence', 'Property Damage', 'Disrespectful Behaviour'],
    responsible: ['Community', 'State PIU'],
    lead: 'Social Specialist',
    priority: 'medium',
  },
  {
    name: 'Stakeholder Engagement',
    description: 'Complaints regarding consultation, participation, disclosure, or communication processes.',
    subgroups: ['Exclusion from Meetings', 'Inadequate Information Disclosure', 'Inadequate Consultation'],
    responsible: ['Community', 'State PIU'],
    lead: 'Community Liaison Officer',
    priority: 'low',
  },
  {
    name: 'Procurement & Service Delivery',
    description: 'Complaints relating to project procurement processes, beneficiary selection, or service provision.',
    subgroups: ['Alleged Favouritism', 'Non-transparent Selection', 'Delayed Service Delivery'],
    responsible: ['State PIU', 'FPMU'],
    lead: 'State Project Coordinator',
    priority: 'medium',
  },
  {
    name: 'Corruption, Fraud & Misconduct',
    description: 'Complaints involving unethical practices or misuse of project resources.',
    subgroups: ['Bribery', 'Extortion', 'Diversion of Project Resources', 'Abuse of Authority'],
    responsible: ['State PIU', 'FPMU'],
    lead: 'Integrity / Safeguards Officer',
    priority: 'high',
  },
  {
    name: 'Security',
    description: 'Complaints involving security personnel or security incidents associated with project implementation.',
    subgroups: ['Harassment', 'Intimidation', 'Excessive Use of Force', 'Restricted Movement'],
    responsible: ['State PIU', 'FPMU'],
    lead: 'Safeguards / Security Officer',
    priority: 'high',
  },
  {
    name: 'SEA/SH & GBV',
    description: 'Complaints involving Sexual Exploitation and Abuse, Sexual Harassment, or other forms of Gender-Based Violence.',
    subgroups: ['Sexual Harassment', 'Sexual Exploitation', 'Inappropriate Conduct', 'Abuse of Power', 'Intimate Partner Violence'],
    responsible: ['Dedicated SEA/SH Referral Pathway'],
    lead: 'SEA/SH Focal Person (SMWA)',
    priority: 'high',
    restricted: true,
  },
  {
    name: 'Child Protection',
    description: 'Complaints involving abuse, exploitation, neglect, or harm to children.',
    subgroups: ['Child Labour', 'Child Abuse', 'Child Exploitation', 'School-related Concerns'],
    responsible: ['Dedicated Referral Pathway'],
    lead: 'Child Protection Focal Person',
    priority: 'high',
    restricted: true,
  },
  {
    name: 'Other',
    description: 'Complaints that do not fall within existing categories but relate to project implementation.',
    subgroups: ['Miscellaneous Project-Related Concerns'],
    responsible: ['Determined during screening'],
    lead: 'State Project Coordinator',
    priority: 'low',
  },
]

export const TAXONOMY = TAXONOMY_BASE.map(t => ({ ...t, domain: domainForCategory(t.name) }))

export const BASE_CATEGORIES = TAXONOMY.map(t => t.name)

export const GOVERNANCE_TIERS = [
  { level: 1, name: 'Community-Level Structures (CGFP)', escalatesTo: 'State PIU (SPIU)', timeline: '1–7 days' },
  { level: 2, name: 'State Project Implementation Unit (SPIU)', escalatesTo: 'State Sector Ministries & Agencies', timeline: '7–14 days' },
  { level: 3, name: 'State Sector Ministries & Agencies', escalatesTo: 'FPMU', timeline: '14–20 days' },
  { level: 4, name: 'Federal Project Management Unit (FPMU)', escalatesTo: 'Independent Appeal (external)', timeline: '20–30 days' },
]

export const MAX_TIER = 4

function customCategories() { return getSetting('taxonomy.custom', []) }

const CUSTOM_META = (name) => ({ name, domain: 'Other', description: 'Custom category added by administrator.', subgroups: [], responsible: ['Determined during screening'], priority: 'medium', custom: true })

export const CATEGORIES = [...BASE_CATEGORIES, ...customCategories()]

function customSubgroups() { return getSetting('taxonomy.subgroups', {}) }

function customLeads() { return getSetting('taxonomy.leads', {}) }
export function setCategoryLead(name, lead) {
  const s = { ...customLeads() }
  if (lead) s[name] = lead; else delete s[name]
  setSetting('taxonomy.leads', s)
}

export function categoryMeta(name) {
  const base = TAXONOMY.find(t => t.name === name) || CUSTOM_META(name)
  const extra = customSubgroups()[name] || []
  const lead = customLeads()[name]
  let meta = extra.length ? { ...base, subgroups: [...base.subgroups, ...extra] } : base
  if (lead) meta = { ...meta, lead }
  return meta
}
export const subgroupsFor = (name) => categoryMeta(name).subgroups
export const isRestricted = (name) => !!categoryMeta(name).restricted

function customRoutes() { return getSetting('taxonomy.routes', {}) }
export function defaultRoute(name) {
  const m = categoryMeta(name)
  if (m.restricted) return [m.lead].filter(Boolean)
  return ['Community Grievance Focal Person', m.lead, 'State Sector Ministries & Agencies', 'FPMU Grievance Committee'].filter(Boolean)
}
export function getCategoryRoute(name) { return customRoutes()[name] || defaultRoute(name) }
export function setCategoryRoute(name, arr) {
  const s = { ...customRoutes() }; s[name] = arr
  setSetting('taxonomy.routes', s)
}
export const isCustomCategory = (name) => !BASE_CATEGORIES.includes(name)
export const isCustomSubgroup = (name, sub) => (customSubgroups()[name] || []).includes(sub)

export function addCategory(name) {
  const n = name.trim()
  if (!n || CATEGORIES.includes(n)) return false
  CATEGORIES.push(n)
  setSetting('taxonomy.custom', [...customCategories(), n])
  return true
}

export function removeCategory(name) {
  if (BASE_CATEGORIES.includes(name)) return false
  const i = CATEGORIES.indexOf(name)
  if (i >= 0) CATEGORIES.splice(i, 1)
  setSetting('taxonomy.custom', customCategories().filter(c => c !== name))

  const store = { ...customSubgroups() }
  if (store[name]) { delete store[name]; setSetting('taxonomy.subgroups', store) }
  return true
}

export function addSubgroup(categoryName, sub) {
  const s = (sub || '').trim()
  if (!s || subgroupsFor(categoryName).includes(s)) return false
  const store = { ...customSubgroups() }
  store[categoryName] = [...(store[categoryName] || []), s]
  setSetting('taxonomy.subgroups', store)
  return true
}

export function removeSubgroup(categoryName, sub) {
  const store = { ...customSubgroups() }
  if (!store[categoryName]?.includes(sub)) return false
  store[categoryName] = store[categoryName].filter(x => x !== sub)
  setSetting('taxonomy.subgroups', store)
  return true
}

const SLA_DEFAULTS = { high: 7, medium: 14, low: 21, ackHours: 48 }
export function getSla() { return { ...SLA_DEFAULTS, ...(getSetting('sla', {}) || {}) } }
export function setSla(v) { setSetting('sla', v) }

export const INTAKE_CHANNELS = [
  { id: 'back_office', label: 'Back office', subs: ['Walk-in', 'Phone call', 'Email', 'Letter'] },
  { id: 'self_service', label: 'Self-service', subs: ['WhatsApp', 'Web portal', 'SMS', 'USSD'] },
  { id: 'cgfp', label: 'Community Focal Person', subs: ['Community meeting', 'Suggestion box', 'Field visit', 'Referral'] },
]

export const CHANNELS = INTAKE_CHANNELS.map(({ id, label }) => ({ id, label }))

const CHANNEL_PARENT = {
  back_office: 'back_office', walk_in: 'back_office', phone: 'back_office', email: 'back_office', letter: 'back_office',
  self_service: 'self_service', whatsapp: 'self_service', web: 'self_service', sms: 'self_service', ussd: 'self_service',
  cgfp: 'cgfp', field: 'cgfp', referral: 'cgfp',
}
export const channelParent = (id) => CHANNEL_PARENT[id] || 'back_office'
export const channelSubs = (id) => INTAKE_CHANNELS.find(c => c.id === id)?.subs || []

export const STATUSES = [
  { id: 'received', label: 'Received' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
  { id: 'reopened', label: 'Reopened' },
]

export const OFFICERS = [
  'A. Bello', 'C. Okafor', 'F. Abdullahi', 'H. Musa', 'I. Adeyemi',
  'M. Danjuma', 'N. Eze', 'R. Garba', 'S. Lawal', 'T. Yusuf',
]

const FIRST = ['Ibrahim', 'Amina', 'Chinedu', 'Fatima', 'Musa', 'Ngozi', 'Sani', 'Blessing', 'Usman', 'Halima', 'Emeka', 'Aisha', 'Garba', 'Grace', 'Yakubu', 'Zainab', 'Adamu', 'Esther', 'Bala', 'Hauwa']
const LAST = ['Abubakar', 'Okonkwo', 'Mohammed', 'Adamu', 'Eze', 'Suleiman', 'Obi', 'Aliyu', 'Danladi', 'Nwosu', 'Garba', 'Yusuf', 'Bello', 'Idris', 'Lawal', 'Musa', 'Sani', 'Umar', 'Audu', 'Tanko']

const NARRATIVES = {
  'Environmental': [
    (c) => `Since the contractor start the canal work near ${c.lga}, the dust wey dey blow enter our houses no be small. Our children dey cough and the water for the stream don change colour. We want make dem control the dust and check the water.`,
    (c) => `The machines dey work for our area in ${c.lga} from morning till night and the noise plus the vibration don crack some of our mud houses. Dem also clear bush wey reach our farmland. Make the project people come look am.`,
  ],
  'Social': [
    (c) => `The new access road for the scheme don block the path wey our women dey use go market for ${c.lga}. Now dem dey waka far go round. We dey beg make dem create another crossing for us.`,
    (c) => `Some of us for ${c.lga} no dey benefit from the scheme at all even though our land dey inside the area. We feel say dem dey leave our community out of the planning. We want proper inclusion.`,
  ],
  'Land Acquisition & Resettlement': [
    (c) => `Dem measure my land for the scheme for ${c.lga} but the compensation wey dem talk no match wetin my neighbour collect for the same kind land. I no gree with the valuation. Make dem review am.`,
    (c) => `The asset inventory wey dem do for my farm near ${c.lga} no capture my economic trees and the well. Now the compensation no complete. I want make dem come count everything again.`,
  ],
  'Labour & Working Conditions': [
    (c) => `We be casual workers for the construction site near ${c.lga} and dem never pay our salary for two months. Anytime we ask dem dey say next week. We want our wages settled.`,
    () => `The supervisor for our site dey treat some of us anyhow and dey make us work pass the normal hours without extra pay. We no get any rest day. We dey report the working condition.`,
  ],
  'Occupational Health & Safety': [
    (c) => `Dem put us to work for the site near ${c.lga} without helmet or safety boot. One of our colleague don injure himself last week because of am. We dey ask for proper safety gear before something worse happen.`,
    () => `The trench wey we dey dig no get any support and e nearly collapse on top two workers. There is no safety officer for the site. We want the place inspected before we continue.`,
  ],
  'Community Health & Safety': [
    (c) => `The project trucks dey speed through our community for ${c.lga} and almost knock down children twice this week. There is no warning sign or speed control. We want make dem do something before accident happen.`,
    (c) => `Dem leave the construction pit open near where our children dey pass go school for ${c.lga}. No fence, no cover. It is very dangerous. Please make dem secure the site.`,
  ],
  'Contractor Conduct & Performance': [
    (c) => `The contractor people for ${c.lga} damage our community borehole with their machine and dem no gree fix am back. Dem also dey talk to our elders anyhow. We want the damage repaired and respect shown.`,
    () => `The workers dey dump their waste for our farmland and dey enter people compound without permission. Their conduct no good at all. We are reporting the behaviour for action.`,
  ],
  'Stakeholder Engagement': [
    (c) => `Dem hold the project consultation meeting for ${c.lga} but nobody inform our community. We only hear say dem don decide everything. We want to be carried along in the next meetings.`,
    () => `We no dey get any information about wetin the project dey plan for our area. When we ask, nobody fit explain. We are asking for proper disclosure and engagement.`,
  ],
  'Procurement & Service Delivery': [
    (c) => `The selection of people wey dem give the scheme contract for ${c.lga} no clear at all. E be like say na only favouritism. We want transparency for how dem dey pick.`,
    () => `The service wey dem promise for our community don delay tey tey and nobody fit tell us why. We feel say the process no dey transparent. We dey ask for explanation.`,
  ],
  'Corruption, Fraud & Misconduct': [
    (c) => `One officer for ${c.lga} dey ask us make we pay money before he go put our name for the scheme list. This na pure extortion. We dey report am so dem fit investigate.`,
    () => `We get strong suspicion say some project materials dey disappear and dey sold outside. The person in charge dey use his position anyhow. We want proper investigation.`,
  ],
  'Security': [
    (c) => `The security men wey dem post to the site near ${c.lga} dey harass our young men and dey stop people from going their own farm. Dem use force last week. We dey report the intimidation.`,
    () => `Anytime we try reach our farmland the security personnel dey block us and dey threaten us. This restriction no make sense. We want our free movement back.`,
  ],
  'SEA/SH & GBV': [
    () => `[Restricted disclosure — handled through the dedicated SEA/SH survivor-centred referral pathway. Details are not recorded in the open register.]`,
  ],
  'Child Protection': [
    () => `[Restricted disclosure — handled through the dedicated child protection referral pathway. Details are not recorded in the open register.]`,
  ],
  'Other': [
    (c) => `I get a concern about how things dey run for our scheme for ${c.lga} wey no fit fall under the normal categories. I want somebody from the project office to call me back and look into am.`,
    (c) => `There is an issue in ${c.lga} relating to the project activities in our area that I want the grievance desk to review and categorise properly.`,
  ],
}

const DESCRIPTIONS = {
  'Environmental': 'Complainant reports environmental impacts (dust, noise, vibration, water/soil disturbance) arising from project construction activities.',
  'Social': 'Complainant raises a social concern affecting community access, livelihoods or inclusion in project benefits.',
  'Land Acquisition & Resettlement': 'Complainant disputes compensation, asset inventory or valuation arising from land acquisition for the scheme.',
  'Labour & Working Conditions': 'Project worker reports an employment-conditions grievance (wages, hours, treatment) on the project worksite.',
  'Occupational Health & Safety': 'Worker reports an occupational health and safety hazard at the worksite requiring corrective action.',
  'Community Health & Safety': 'Complainant reports a risk posed to the community by project activities (traffic, unsecured sites, public safety).',
  'Contractor Conduct & Performance': 'Complainant reports misconduct, negligence or property damage by the contractor or its workers.',
  'Stakeholder Engagement': 'Complainant raises a concern regarding consultation, disclosure or participation in project engagement processes.',
  'Procurement & Service Delivery': 'Complainant alleges lack of transparency or delay in procurement, beneficiary selection or service provision.',
  'Corruption, Fraud & Misconduct': 'Complainant alleges unethical practice or misuse of project resources requiring investigation.',
  'Security': 'Complainant reports a security incident or conduct of security personnel associated with the project.',
  'SEA/SH & GBV': 'Restricted SEA/SH disclosure managed under the survivor-centred referral pathway — not recorded in the open register.',
  'Child Protection': 'Restricted child protection disclosure managed under the dedicated referral pathway — not recorded in the open register.',
  'Other': 'General complaint relating to scheme activities requiring review and categorisation by the grievance desk.',
}

function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = rng(20260607)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const pickW = (arr, weights) => {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i] }
  return arr[arr.length - 1]
}

export const TODAY = new Date('2026-06-07T09:00:00')
const DAY = 86400000

const OPEN_CATEGORIES = TAXONOMY.filter(t => !t.restricted).map(t => t.name)
const OPEN_WEIGHTS = [10, 14, 18, 11, 7, 6, 9, 8, 7, 5, 4, 6]

function buildCases() {
  const cases = []
  const seqByState = {}
  for (let i = 0; i < 164; i++) {
    const state = pickW(STATES, [10, 9, 7, 8, 11, 16, 12, 9, 10, 8, 6, 7])
    const lga = pick(state.lgas)
    const category = pickW(OPEN_CATEGORIES, OPEN_WEIGHTS)
    const meta = categoryMeta(category)
    const subcategory = pick(meta.subgroups) || ''
    const channelDef = pickW(INTAKE_CHANNELS, [55, 30, 15])
    const channel = channelDef.id
    const channelDetail = pick(channelDef.subs)

    const priority = pickW(['low', 'medium', 'high'],
      meta.priority === 'high' ? [10, 30, 60] :
      meta.priority === 'low' ? [60, 32, 8] :
      [28, 52, 20])
    const ageDays = Math.floor(Math.pow(rand(), 1.4) * 180)
    const created = new Date(TODAY.getTime() - ageDays * DAY - Math.floor(rand() * 9) * 3600000)

    let status
    if (ageDays < 3) status = pickW(['received', 'acknowledged', 'assigned'], [5, 3, 2])
    else if (ageDays < 14) status = pickW(['acknowledged', 'assigned', 'under_review', 'resolved'], [2, 4, 5, 3])
    else if (ageDays < 45) status = pickW(['under_review', 'resolved', 'closed', 'reopened'], [3, 5, 6, 1])
    else status = pickW(['resolved', 'closed', 'reopened'], [3, 9, 1])

    const resolvedDays = status === 'resolved' || status === 'closed'
      ? Math.min(ageDays, 2 + Math.floor(rand() * 26))
      : null

    const seq = (seqByState[state.name] = (seqByState[state.name] || 0) + 1)
    const stCode = state.name.slice(0, 3).toUpperCase()
    const yymm = `${String(created.getFullYear()).slice(2)}${String(created.getMonth() + 1).padStart(2, '0')}`

    const anonymous = rand() < 0.12
    const slaDays = priority === 'high' ? 7 : priority === 'medium' ? 14 : 21
    const due = new Date(created.getTime() + slaDays * DAY)
    const open = !['resolved', 'closed'].includes(status)

    const registeredBy =
      channel === 'self_service' ? `Self-service · ${channelDetail}` :
      channel === 'cgfp' ? `Community Focal Person · ${channelDetail}` :
      `${pick(OFFICERS)} · ${channelDetail}`

    const complainant = anonymous ? 'Anonymous' : `${pick(FIRST)} ${pick(LAST)}`
    const narrative = pick(NARRATIVES[category])({ complainant, lga, state: state.name })

    const PHOTO_LABELS = ['Site photo', 'Affected area photo', 'Worksite photo', 'Damage photo', 'Document/letter photo', 'Boundary marker photo']
    const attachments = []
    if (channel === 'self_service' || channel === 'cgfp' || rand() < 0.2) {
      const n = rand() < 0.45 ? 1 : rand() < 0.8 ? 2 : 3
      for (let k = 0; k < n; k++) {
        const wantVoice = rand() < 0.38 && !attachments.some(a => a.type === 'voice')
        if (wantVoice) {
          attachments.push({
            id: `att-${i}-${k}`,
            type: 'voice',
            label: 'Voice note from complainant',
            duration: 14 + Math.floor(rand() * 76),
            size: `${(0.1 + rand() * 0.7).toFixed(1)} MB`,
            capturedAt: new Date(created.getTime() + k * 90000),
          })
        } else {
          attachments.push({
            id: `att-${i}-${k}`,
            type: 'photo',
            label: pick(PHOTO_LABELS),
            size: `${(0.6 + rand() * 2.8).toFixed(1)} MB`,
            capturedAt: new Date(created.getTime() + k * 90000),
          })
        }
      }
    }

    cases.push({
      id: `c${i + 1}`,
      code: `SPIN-${stCode}-${yymm}-${String(seq).padStart(3, '0')}`,
      state: state.name,
      lga,
      lat: state.lat + (rand() - 0.5) * 0.9,
      lng: state.lng + (rand() - 0.5) * 0.9,
      category,
      subcategory,
      channel,
      channelDetail,
      priority,
      status,
      anonymous,
      complainant,
      phone: anonymous ? '—' : `080${Math.floor(10000000 + rand() * 89999999)}`,
      assignedTo: ['received'].includes(status) ? null : pick(OFFICERS),
      description: DESCRIPTIONS[category],
      narrative,
      attachments,
      createdAt: created,
      dueAt: due,
      resolvedAt: resolvedDays != null ? new Date(created.getTime() + resolvedDays * DAY) : null,
      resolutionDays: resolvedDays,
      slaBreached: open ? due < TODAY : (resolvedDays != null && resolvedDays > slaDays),
      registeredBy,
      autoClassified: false,
    })
  }
  return cases.sort((a, b) => b.createdAt - a.createdAt)
}

const ALL_CASES = [...buildCases()].sort((a, b) => b.createdAt - a.createdAt)

const AUTH_KEY = 'spin.auth'
export const DEFAULT_VIEW = { name: 'F. Nwachukwu', role: 'FPMU Admin', scope: 'All states' }

export function getViewAs() {
  try {
    const auth = JSON.parse(localStorage.getItem(AUTH_KEY))
    if (auth && auth.name) return auth
  } catch { /* not signed in yet */ }
  return DEFAULT_VIEW
}

export function setViewAs() { /* no-op — view follows the signed-in user */ }

export function scopeStatesList(scope) {
  if (!scope || scope === 'All states') return []
  return Array.isArray(scope) ? scope : [scope]
}
export function inScope(state, scope) {
  const list = scopeStatesList(scope)
  return list.length === 0 || list.includes(state)
}
export function scopeLabel(scope) {
  const list = scopeStatesList(scope)
  if (list.length === 0) return 'All states'
  if (list.length <= 2) return list.join(', ')
  return `${list.slice(0, 2).join(', ')} +${list.length - 2}`
}

const _view = getViewAs()
export const CASES = scopeStatesList(_view.scope).length
  ? ALL_CASES.filter(c => inScope(c.state, _view.scope))
  : ALL_CASES

export function updateCase(id, patch) {
  const c = CASES.find(x => x.id === id)
  if (!c) return null
  Object.assign(c, patch)
  if (patch.status) {
    const slaDays = getSla()[c.priority] ?? 14
    if (['resolved', 'closed'].includes(patch.status)) {
      if (c.resolvedAt == null) {
        c.resolvedAt = TODAY
        c.resolutionDays = Math.max(0, Math.round((TODAY - c.createdAt) / DAY))
      }
      c.slaBreached = c.resolutionDays > slaDays
    } else {
      c.resolvedAt = null
      c.resolutionDays = null
      c.slaBreached = c.dueAt < TODAY
    }
  }

  return c
}

export function addCase(input) {
  const state = STATES.find(s => s.name === input.state) || STATES[0]
  const slaDays = getSla()[input.priority] ?? 14
  const seq = CASES.filter(c => c.state === state.name).length + 1
  const yymm = `${String(TODAY.getFullYear()).slice(2)}${String(TODAY.getMonth() + 1).padStart(2, '0')}`

  const c = {
    id: `cu-${Date.now().toString(36)}`,
    code: `SPIN-${state.name.slice(0, 3).toUpperCase()}-${yymm}-${String(seq).padStart(3, '0')}`,
    state: state.name,
    lga: input.lga || state.lgas[0],
    lat: state.lat + (Math.random() - 0.5) * 0.6,
    lng: state.lng + (Math.random() - 0.5) * 0.6,
    category: input.category,
    subcategory: input.subcategory || '',
    channel: input.channel,
    priority: input.priority,
    status: 'received',
    anonymous: !!input.anonymous,
    complainant: input.anonymous ? 'Anonymous' : input.complainant,
    phone: input.anonymous ? '—' : (input.phone || '—'),
    assignedTo: null,
    description: input.description,
    narrative: input.narrative || '',
    createdAt: TODAY,
    dueAt: new Date(TODAY.getTime() + slaDays * DAY),
    resolvedAt: null,
    resolutionDays: null,
    slaBreached: false,
    registeredBy: `${getViewAs().name} · Front Desk`,
    autoClassified: !!input.autoClassified,
    attachments: [],
  }

  CASES.unshift(c)
  return c
}

export const SENSITIVE_COUNT = 4

export function buildTimeline(c) {
  const steps = [{ at: c.createdAt, type: 'received', note: `Grievance received via ${CHANNELS.find(x => x.id === c.channel)?.label}` }]
  const order = ['acknowledged', 'assigned', 'under_review', 'resolved', 'closed']
  const idx = order.indexOf(c.status === 'reopened' ? 'resolved' : c.status)
  const span = (c.resolvedAt ? c.resolvedAt - c.createdAt : TODAY - c.createdAt)
  order.slice(0, idx + 1).forEach((s, i) => {
    const at = new Date(c.createdAt.getTime() + (span * (i + 1)) / (idx + 2))
    const notes = {
      acknowledged: 'Acknowledgement sent to complainant',
      assigned: `Assigned to ${c.assignedTo || 'grievance officer'}`,
      under_review: 'Verification and review in progress',
      resolved: 'Resolution recorded and complainant notified',
      closed: 'Case closed after confirmation window',
    }
    steps.push({ at, type: s, note: notes[s] })
  })
  if (c.status === 'reopened') steps.push({ at: new Date(c.createdAt.getTime() + span), type: 'reopened', note: 'Complainant appealed — case reopened' })
  return steps
}

export const fmtDate = (d) => d ? d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const fmtDateTime = (d) => d ? d.toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'
export const statusLabel = (id) => STATUSES.find(s => s.id === id)?.label || id
export const channelLabel = (id) => CHANNELS.find(c => c.id === channelParent(id))?.label || id
export const isOpen = (c) => !['resolved', 'closed'].includes(c.status)
