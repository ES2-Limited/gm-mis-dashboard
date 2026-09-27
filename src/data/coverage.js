

import { getSetting, setSetting } from './settingsStore'

const API = 'https://nga-states-lga.onrender.com'

const SPIN_DEFAULT_COVERAGE = {
  "Adamawa": ["Demsa", "Fufure", "Ganye", "Gayuk", "Gombi", "Grie", "Hong", "Jada", "Larmurde", "Madagali", "Maiha", "Mayo Belwa", "Michika", "Mubi North", "Mubi South", "Numan", "Shelleng", "Song", "Toungo", "Yola North", "Yola South"],
  "Bauchi": ["Alkaleri", "Bauchi", "Bogoro", "Damban", "Darazo", "Dass", "Gamawa", "Ganjuwa", "Giade", "Itas-Gadau", "Jama are", "Katagum", "Kirfi", "Misau", "Ningi", "Shira", "Tafawa Balewa", " Toro", " Warji", " Zaki"],
  "Benue": ["Agatu", "Apa", "Ado", "Buruku", "Gboko", "Guma", "Gwer East", "Gwer West", "Katsina-Ala", "Konshisha", "Kwande", "Logo", "Makurdi", "Obi", "Ogbadibo", "Ohimini", "Oju", "Okpokwu", "Oturkpo", "Tarka", "Ukum", "Ushongo", "Vandeikya"],
  "Cross River": ["Abi", "Akamkpa", "Akpabuyo", "Bakassi", "Bekwarra", "Biase", "Boki", "Calabar Municipal", "Calabar South", "Etung", "Ikom", "Obanliku", "Obubra", "Obudu", "Odukpani", "Ogoja", "Yakuur", "Yala"],
  "Delta": ["Aniocha North", "Aniocha South", "Bomadi", "Burutu", "Ethiope East", "Ethiope West", "Ika North East", "Ika South", "Isoko North", "Isoko South", "Ndokwa East", "Ndokwa West", "Okpe", "Oshimili North", "Oshimili South", "Patani", "Sapele", "Udu", "Ughelli North", "Ughelli South", "Ukwuani", "Uvwie", "Warri North", "Warri South", "Warri South West"],
  "Ebonyi": ["Abakaliki", "Afikpo North", "Afikpo South", "Ebonyi", "Ezza North", "Ezza South", "Ikwo", "Ishielu", "Ivo", "Izzi", "Ohaozara", "Ohaukwu", "Onicha"],
  "Edo": ["Akoko-Edo", "Egor", "Esan Central", "Esan North-East", "Esan South-East", "Esan West", "Etsako Central", "Etsako East", "Etsako West", "Igueben", "Ikpoba Okha", "Orhionmwon", "Oredo", "Ovia North-East", "Ovia South-West", "Owan East", "Owan West", "Uhunmwonde"],
  "Ekiti": ["Ado Ekiti", "Efon", "Ekiti East", "Ekiti South-West", "Ekiti West", "Emure", "Gbonyin", "Ido Osi", "Ijero", "Ikere", "Ikole", "Ilejemeje", "Irepodun-Ifelodun", "Ise-Orun", "Moba", "Oye"],
  "Enugu": ["Aninri", "Awgu", "Enugu East", "Enugu North", "Enugu South", "Ezeagu", "Igbo Etiti", "Igbo Eze North", "Igbo Eze South", "Isi Uzo", "Nkanu East", "Nkanu West", "Nsukka", "Oji River", "Udenu", "Udi", "Uzo Uwani"],
  "Gombe": ["Akko", "Balanga", "Billiri", "Dukku", "Funakaye", "Gombe", "Kaltungo", "Kwami", "Nafada", "Shongom", "Yamaltu-Deba"],
  "Imo": ["Aboh Mbaise", "Ahiazu Mbaise", "Ehime Mbano", "Ezinihitte", "Ideato North", "Ideato South", "Ihitte-Uboma", "Ikeduru", "Isiala Mbano", "Isu", "Mbaitoli", "Ngor Okpala", "Njaba", "Nkwerre", "Nwangele", "Obowo", "Oguta", "Ohaji-Egbema", "Okigwe", "Orlu", "Orsu", "Oru East", "Oru West", "Owerri Municipal", "Owerri North", "Owerri West", "Unuimo"],
  "Jigawa": ["Auyo", "Babura", "Biriniwa", "Birnin Kudu", "Buji", "Dutse", "Gagarawa", "Garki", "Gumel", "Guri", "Gwaram", "Gwiwa", "Hadejia", "Jahun", "Kafin Hausa", "Kazaure", "Kiri Kasama", "Kiyawa", "Kaugama", "Maigatari", "Malam Madori", "Miga", "Ringim", "Roni", "Sule Tankarkar", "Taura", "Yankwashi"],
  "Kaduna": ["Birnin Gwari", "Chikun", "Giwa", "Igabi", "Ikara", "Jaba", "Jema a", "Kachia", "Kaduna North", "Kaduna South", "Kagarko", "Kajuru", "Kaura", "Kauru", "Kubau", "Kudan", "Lere", "Makarfi", "Sabon Gari", "Sanga", "Soba", "Zangon Kataf", "Zaria"],
  "Kano": ["Ajingi", "Albasu", "Bagwai", "Bebeji", "Bichi", "Bunkure", "Dala", "Dambatta", "Dawakin Kudu", "Dawakin Tofa", "Doguwa", "Fagge", "Gabasawa", "Garko", "Garun Mallam", "Gaya", "Gezawa", "Gwale", "Gwarzo", "Kabo", "Kano Municipal", "Karaye", "Kibiya", "Kiru", "Kumbotso", "Kunchi", "Kura", "Madobi", "Makoda", "Minjibir", "Nasarawa", "Rano", "Rimin Gado", "Rogo", "Shanono", "Sumaila", "Takai", "Tarauni", "Tofa", "Tsanyawa", "Tudun Wada", "Ungogo", "Warawa", "Wudil"],
  "Katsina": ["Bakori", "Batagarawa", "Batsari", "Baure", "Bindawa", "Charanchi", "Dandume", "Danja", "Dan Musa", "Daura", "Dutsi", "Dutsin Ma", "Faskari", "Funtua", "Ingawa", "Jibia", "Kafur", "Kaita", "Kankara", "Kankia", "Katsina", "Kurfi", "Kusada", "Mai Adua", "Malumfashi", "Mani", "Mashi", "Matazu", "Musawa", "Rimi", "Sabuwa", "Safana", "Sandamu", "Zango"],
  "Kebbi": ["Aleiro", "Arewa Dandi", "Argungu", "Augie", "Bagudo", "Birnin Kebbi", "Bunza", "Dandi", "Fakai", "Gwandu", "Jega", "Kalgo", "Koko Besse", "Maiyama", "Ngaski", "Sakaba", "Shanga", "Suru", "Wasagu Danko", "Yauri", "Zuru"],
  "Kogi": ["Adavi", "Ajaokuta", "Ankpa", "Bassa", "Dekina", "Ibaji", "Idah", "Igalamela Odolu", "Ijumu", "Kabba Bunu", "Kogi", "Lokoja", "Mopa Muro", "Ofu", "Ogori Magongo", "Okehi", "Okene", "Olamaboro", "Omala", "Yagba East", "Yagba West"],
  "Kwara": ["Asa", "Baruten", "Edu", "Ekiti", "Ifelodun", "Ilorin East", "Ilorin South", "Ilorin West", "Irepodun", "Isin", "Kaiama", "Moro", "Offa", "Oke Ero", "Oyun", "Pategi"],
  "Nasarawa": ["Akwanga", "Awe", "Doma", "Karu", "Keana", "Keffi", "Kokona", "Lafia", "Nasarawa", "Nasarawa Egon", "Obi", "Toto", "Wamba"],
  "Niger": ["Agaie", "Agwara", "Bida", "Borgu", "Bosso", "Chanchaga", "Edati", "Gbako", "Gurara", "Katcha", "Kontagora", "Lapai", "Lavun", "Magama", "Mariga", "Mashegu", "Mokwa", "Moya", "Paikoro", "Rafi", "Rijau", "Shiroro", "Suleja", "Tafa", "Wushishi"],
  "Plateau": ["Bokkos", "Barkin Ladi", "Bassa", "Jos East", "Jos North", "Jos South", "Kanam", "Kanke", "Langtang South", "Langtang North", "Mangu", "Mikang", "Pankshin", "Qua an Pan", "Riyom", "Shendam", "Wase"],
  "Sokoto": ["Binji", "Bodinga", "Dange Shuni", "Gada", "Goronyo", "Gudu", "Gwadabawa", "Illela", "Isa", "Kebbe", "Kware", "Rabah", "Sabon Birni", "Shagari", "Silame", "Sokoto North", "Sokoto South", "Tambuwal", "Tangaza", "Tureta", "Wamako", "Wurno", "Yabo"],
  "Taraba": ["Ardo Kola", "Bali", "Donga", "Gashaka", "Gassol", "Ibi", "Jalingo", "Karim Lamido", "Kumi", "Lau", "Sardauna", "Takum", "Ussa", "Wukari", "Yorro", "Zing"],
  "Yobe": ["Bade", "Bursari", "Damaturu", "Fika", "Fune", "Geidam", "Gujba", "Gulani", "Jakusko", "Karasuwa", "Machina", "Nangere", "Nguru", "Potiskum", "Tarmuwa", "Yunusari", "Yusufari"],
  "Zamfara": ["Anka", "Bakura", "Birnin Magaji Kiyaw", "Bukkuyum", "Bungudu", "Gummi", "Gusau", "Kaura Namoda", "Maradun", "Maru", "Shinkafi", "Talata Mafara", "Chafe", "Zurmi"],
}

const cloneCoverage = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, [...v]]))

export async function fetchAllStates() {
  const res = await fetch(`${API}/fetch`)
  if (!res.ok) throw new Error('Could not load states')
  return res.json()
}

export async function fetchLgas(state) {
  const res = await fetch(`${API}/?state=${encodeURIComponent(state)}`)
  if (!res.ok) throw new Error('Could not load local governments')
  return res.json()
}

export function getCoverage() {

  const stored = getSetting('coverage', null)
  return stored && Object.keys(stored).length ? stored : cloneCoverage(SPIN_DEFAULT_COVERAGE)
}

export function setCoverage(map) {
  setSetting('coverage', map)
}

export const isCoverageConfigured = () => Object.keys(getCoverage()).length > 0
export const activeStateNames = () => Object.keys(getCoverage()).sort()
export const activeLgas = (state) => getCoverage()[state] || []

export function getStateModels() { return getSetting('stateModels', {}) || {} }
export function setStateModels(map) { setSetting('stateModels', map) }
export function getStateModel(state) { return getStateModels()[state] === 2 ? 2 : 1 }
export function setStateModel(state, model) {
  const m = model === 2 ? 2 : 1
  setStateModels({ ...getStateModels(), [state]: m })
  return m
}
export const MODEL_LABELS = {
  1: 'Model 1 — RBDA / FPMU chain',
  2: 'Model 2 — State SPIU chain',
}

const skey = (state, lga) => `${state}::${lga}`
const sid = () => `site-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
function siteStore() { return getSetting('sites', {}) || {} }
function writeSites(store) { setSetting('sites', store) }

export function getMinistries() { return getSetting('ministries', []) }
export function addMinistry(name) {
  const n = (name || '').trim()
  if (!n) return false
  const list = getMinistries()
  if (list.some(m => m.toLowerCase() === n.toLowerCase())) return false
  setSetting('ministries', [...list, n])
  return true
}
export function removeMinistry(name) {
  setSetting('ministries', getMinistries().filter(m => m !== name))
  return true
}

export const REFERRAL_TYPES = [
  'SARC / One-Stop Centre',
  'Health / Medical',
  'SMWA (State Ministry of Women Affairs)',
  'Psychosocial / Counselling',
  'CSO / NGO',
  'Legal / Justice',
  'Security / Police',
  'Shelter / Safe House',
  'Other',
]
export function getReferralBodies() { return getSetting('referralBodies', []) }

export function getReferralBodiesForState(state) {
  const list = getReferralBodies()
  const s = (state || '').trim().toLowerCase()
  const inState = list.filter(b => (b.state || '').trim().toLowerCase() === s || !b.state)
  const other = list.filter(b => (b.state || '').trim().toLowerCase() !== s && b.state)
  return { inState, other }
}

export function addReferralBody(name, typeOrObj, extra) {

  const n = (name || '').trim()
  if (!n) return false
  const o = typeof typeOrObj === 'object' && typeOrObj ? typeOrObj : { type: typeOrObj, ...extra }
  const list = getReferralBodies()

  const st = (o.state || '').trim()
  if (list.some(b => (b.name || '').toLowerCase() === n.toLowerCase() && (b.state || '').trim().toLowerCase() === st.toLowerCase())) return false
  setSetting('referralBodies', [...list, {
    name: n,
    type: o.type || 'Other',
    state: st || null,
    area: (o.area || '').trim() || null,
    contact: (o.contact || '').trim() || null,
  }])
  return true
}
export function removeReferralBody(name, state) {
  const st = (state || '').trim().toLowerCase()
  setSetting('referralBodies', getReferralBodies().filter(b =>
    !((b.name === name) && (state === undefined || (b.state || '').trim().toLowerCase() === st))))
  return true
}

export const REFERRAL_AUTHORITY_TYPES = [
  'Court / Judiciary',
  'Traditional / Community Authority',
  'Land / Boundary Commission',
  'Police / Security',
  'Local Government',
  'Government Ministry / Agency',
  'Alternative Dispute Resolution',
  'Other',
]
export function getReferralAuthorities() { return getSetting('referralAuthorities', []) }
export function addReferralAuthority(name, type) {
  const n = (name || '').trim()
  if (!n) return false
  const list = getReferralAuthorities()
  if (list.some(a => (a.name || '').toLowerCase() === n.toLowerCase())) return false
  setSetting('referralAuthorities', [...list, { name: n, type: type || 'Other' }])
  return true
}
export function removeReferralAuthority(name) {
  setSetting('referralAuthorities', getReferralAuthorities().filter(a => a.name !== name))
  return true
}

export function getSites(state, lga) { return siteStore()[skey(state, lga)] || [] }

export function allSites() {
  const store = siteStore()
  return Object.entries(store).flatMap(([k, list]) => {
    const i = k.indexOf('::')
    const state = k.slice(0, i), lga = k.slice(i + 2)
    return (list || []).map(s => ({ ...s, state, lga }))
  })
}
export function sitesInState(state) {
  const store = siteStore(), prefix = `${state}::`
  return Object.entries(store)
    .filter(([k]) => k.startsWith(prefix))
    .flatMap(([k, list]) => list.map(s => ({ ...s, lga: k.slice(prefix.length) })))
}
export function addSite(state, lga, { name, community, lat, lng } = {}) {
  const n = (name || '').trim()
  if (!n) return false
  const store = siteStore(), k = skey(state, lga), list = store[k] || []
  if (list.some(s => s.name.toLowerCase() === n.toLowerCase())) return false
  store[k] = [...list, {
    id: sid(),
    name: n,
    community: (community || '').trim() || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  }]
  writeSites(store)
  return true
}
export function updateSite(state, lga, id, patch) {
  const store = siteStore(), k = skey(state, lga)
  if (!store[k]) return false
  store[k] = store[k].map(s => (s.id === id ? { ...s, ...patch } : s))
  writeSites(store)
  return true
}
export function removeSite(state, lga, id) {
  const store = siteStore(), k = skey(state, lga)
  if (!store[k]) return false
  store[k] = store[k].filter(s => s.id !== id)
  writeSites(store)
  return true
}

export function getCommunities(state, lga) {
  return [...new Set(getSites(state, lga).map(s => s.community).filter(Boolean))]
}
export const coverageCounts = () => {
  const cov = getCoverage()
  const states = Object.keys(cov).length
  const lgas = Object.values(cov).reduce((n, arr) => n + (arr?.length || 0), 0)
  return { states, lgas }
}
