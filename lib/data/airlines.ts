// IATA airline codes -> names, for the airlines travelers meet most. Unknown codes show as the code.
const AIRLINES: Record<string, string> = {
  AA: "American Airlines", DL: "Delta Air Lines", UA: "United Airlines", WN: "Southwest Airlines", B6: "JetBlue",
  AS: "Alaska Airlines", NK: "Spirit Airlines", F9: "Frontier Airlines", HA: "Hawaiian Airlines", SY: "Sun Country",
  AC: "Air Canada", WS: "WestJet", PD: "Porter Airlines", TS: "Air Transat", AM: "Aeroméxico", Y4: "Volaris", VB: "Viva Aerobus",
  LA: "LATAM", AV: "Avianca", CM: "Copa Airlines", AR: "Aerolíneas Argentinas", G3: "GOL", AD: "Azul", JA: "JetSMART",
  BA: "British Airways", VS: "Virgin Atlantic", U2: "easyJet", FR: "Ryanair", LS: "Jet2", EI: "Aer Lingus",
  AF: "Air France", KL: "KLM", LH: "Lufthansa", LX: "SWISS", OS: "Austrian Airlines", SN: "Brussels Airlines",
  EW: "Eurowings", DE: "Condor", IB: "Iberia", VY: "Vueling", UX: "Air Europa", I2: "Iberia Express", V7: "Volotea",
  TP: "TAP Air Portugal", AZ: "ITA Airways", SK: "SAS", AY: "Finnair", DY: "Norwegian", D8: "Norwegian", FI: "Icelandair",
  OG: "PLAY", LO: "LOT Polish Airlines", OK: "Czech Airlines", RO: "TAROM", A3: "Aegean Airlines", OA: "Olympic Air",
  TK: "Turkish Airlines", PC: "Pegasus Airlines", W6: "Wizz Air", W4: "Wizz Air Malta", HV: "Transavia", TO: "Transavia France",
  BT: "airBaltic", JU: "Air Serbia", OU: "Croatia Airlines", LG: "Luxair", WK: "Edelweiss Air",
  EK: "Emirates", QR: "Qatar Airways", EY: "Etihad Airways", SV: "Saudia", GF: "Gulf Air", WY: "Oman Air", FZ: "flydubai",
  G9: "Air Arabia", RJ: "Royal Jordanian", MS: "EgyptAir", LY: "El Al", ME: "Middle East Airlines", KU: "Kuwait Airways", XY: "flynas",
  ET: "Ethiopian Airlines", KQ: "Kenya Airways", SA: "South African Airways", AT: "Royal Air Maroc", WB: "RwandAir", FA: "FlySafair",
  AI: "Air India", "6E": "IndiGo", UK: "Vistara", SG: "SpiceJet", IX: "Air India Express", QP: "Akasa Air", UL: "SriLankan Airlines",
  PK: "PIA", BG: "Biman Bangladesh", "8M": "Myanmar Airways", NH: "ANA", JL: "Japan Airlines", MM: "Peach", GK: "Jetstar Japan",
  KE: "Korean Air", OZ: "Asiana Airlines", "7C": "Jeju Air", TW: "T'way Air", LJ: "Jin Air", CI: "China Airlines", BR: "EVA Air",
  CX: "Cathay Pacific", HX: "Hong Kong Airlines", UO: "HK Express", CA: "Air China", MU: "China Eastern", CZ: "China Southern",
  HU: "Hainan Airlines", "3U": "Sichuan Airlines", ZH: "Shenzhen Airlines", MF: "Xiamen Airlines", SQ: "Singapore Airlines",
  TR: "Scoot", MH: "Malaysia Airlines", AK: "AirAsia", D7: "AirAsia X", TG: "Thai Airways", FD: "Thai AirAsia", PG: "Bangkok Airways",
  VN: "Vietnam Airlines", VJ: "VietJet Air", QH: "Bamboo Airways", PR: "Philippine Airlines", "5J": "Cebu Pacific", GA: "Garuda Indonesia",
  QZ: "Indonesia AirAsia", JT: "Lion Air", QF: "Qantas", JQ: "Jetstar", VA: "Virgin Australia", NZ: "Air New Zealand", FJ: "Fiji Airways",
};

export const airlineName = (code: string) => AIRLINES[code.toUpperCase()] ?? code.toUpperCase();
