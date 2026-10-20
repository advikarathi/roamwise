import type { Activity, Vibe } from "./types";
import { getAirport } from "./airports";
import { ACTIVITY_WIKI } from "./data/activityPhotos";
import { MORE_ACTIVITIES } from "./data/moreActivities";

export interface Airport {
  code: string;
  city: string;
  lat: number;
  lng: number;
}

export interface Destination extends Airport {
  country: string;
  color: string; // signature color for stamps and cards
  hotelNightly: number; // typical mid-range nightly rate, USD
  apartmentNightly: number;
  neighborhoods: string[];
  vibes: Vibe[];
  activities: Omit<Activity, "id">[];
  /** City center and neighborhood centers (approximate), for the map. */
  center?: { lat: number; lng: number };
  hoodCoords?: Record<string, [number, number]>;
}

export const DESTINATIONS: Destination[] = [
  {
    code: "LIS", city: "Lisbon", country: "Portugal", lat: 38.77, lng: -9.13, color: "#FF6B4A",
    hotelNightly: 150, apartmentNightly: 115,
    neighborhoods: ["Alfama", "Chiado", "Príncipe Real", "Graça"],
    center: { lat: 38.7139, lng: -9.1394 },
    hoodCoords: { "Alfama": [38.7116, -9.1301], "Chiado": [38.7108, -9.142], "Príncipe Real": [38.7172, -9.149], "Graça": [38.7165, -9.131] },
    vibes: ["food", "culture", "nightlife", "chill"],
    activities: [
      { title: "Custard tart crawl", blurb: "Hit three bakeries and rank your favorite pastel de nata.", vibe: "food", price: 12, durationHours: 2, timeOfDay: "morning", lat: 38.6975, lng: -9.2033 },
      { title: "Sunset at a miradouro", blurb: "Grab a drink and watch the city turn orange from a hilltop viewpoint.", vibe: "chill", price: 0, durationHours: 1.5, timeOfDay: "evening", lat: 38.7193, lng: -9.1327 },
      { title: "Tile museum", blurb: "Five centuries of azulejos in a former convent.", vibe: "culture", price: 8, durationHours: 2, timeOfDay: "afternoon", lat: 38.7247, lng: -9.1137, indoor: true },
      { title: "Fado night in Alfama", blurb: "Live Portuguese folk music over dinner in a tiny tavern.", vibe: "nightlife", price: 45, durationHours: 3, timeOfDay: "evening", lat: 38.7114, lng: -9.129, indoor: true },
      { title: "Food market tasting", blurb: "Graze through stalls of cheese, seafood and port.", vibe: "food", price: 40, durationHours: 2.5, timeOfDay: "afternoon", lat: 38.7069, lng: -9.1459, indoor: true },
      { title: "Day trip to Sintra", blurb: "Fairytale palaces and forest trails, 40 minutes by train.", vibe: "outdoors", price: 35, durationHours: 7, timeOfDay: "morning", lat: 38.7979, lng: -9.3906 },
      { title: "Beach afternoon in Cascais", blurb: "Seaside town with small sandy coves along the coast line.", vibe: "beach", price: 10, durationHours: 4, timeOfDay: "afternoon", lat: 38.6979, lng: -9.4215 },
      { title: "Bairro Alto bar hop", blurb: "Narrow streets that fill up with people after 11pm.", vibe: "nightlife", price: 30, durationHours: 3, timeOfDay: "evening", lat: 38.713, lng: -9.145, indoor: true },
    ],
  },
  {
    code: "MEX", city: "Mexico City", country: "Mexico", lat: 19.44, lng: -99.07, color: "#E84A8A",
    hotelNightly: 120, apartmentNightly: 85,
    neighborhoods: ["Roma Norte", "Condesa", "Coyoacán", "Juárez"],
    center: { lat: 19.4326, lng: -99.1332 },
    hoodCoords: { "Roma Norte": [19.418, -99.161], "Condesa": [19.412, -99.173], "Coyoacán": [19.35, -99.162], "Juárez": [19.427, -99.157] },
    vibes: ["food", "culture", "nightlife"],
    activities: [
      { title: "Street taco tour", blurb: "Al pastor, suadero and a salsa you will think about for weeks.", vibe: "food", price: 35, durationHours: 3, timeOfDay: "evening", lat: 19.417, lng: -99.162 },
      { title: "Anthropology museum", blurb: "One of the great museums of the Americas. Go early.", vibe: "culture", price: 6, durationHours: 3, timeOfDay: "morning", lat: 19.426, lng: -99.1863, indoor: true },
      { title: "Trajinera ride in Xochimilco", blurb: "Colorful boats, mariachi and snacks on the canals.", vibe: "chill", price: 30, durationHours: 3, timeOfDay: "afternoon", lat: 19.2572, lng: -99.1036 },
      { title: "Teotihuacan pyramids", blurb: "Climb ancient pyramids an hour outside the city.", vibe: "outdoors", price: 55, durationHours: 7, timeOfDay: "morning", lat: 19.6925, lng: -98.8438 },
      { title: "Mezcal bar night in Roma", blurb: "Small-batch mezcal tasting, then wherever the night goes.", vibe: "nightlife", price: 40, durationHours: 3, timeOfDay: "evening", lat: 19.419, lng: -99.16, indoor: true },
      { title: "Frida Kahlo's blue house", blurb: "Book ahead, it sells out days in advance.", vibe: "culture", price: 18, durationHours: 2, timeOfDay: "afternoon", lat: 19.3551, lng: -99.1626, indoor: true },
      { title: "Coffee and pan dulce in Condesa", blurb: "Slow morning under the jacaranda trees.", vibe: "chill", price: 10, durationHours: 1.5, timeOfDay: "morning", lat: 19.4115, lng: -99.172, indoor: true },
    ],
  },
  {
    code: "CDG", city: "Paris", country: "France", lat: 49.01, lng: 2.55, color: "#4A6CFF",
    hotelNightly: 230, apartmentNightly: 170,
    neighborhoods: ["Le Marais", "Saint-Germain", "Montmartre", "Canal Saint-Martin"],
    center: { lat: 48.8566, lng: 2.3522 },
    hoodCoords: { "Le Marais": [48.859, 2.362], "Saint-Germain": [48.854, 2.333], "Montmartre": [48.8867, 2.3431], "Canal Saint-Martin": [48.871, 2.365] },
    vibes: ["food", "culture", "chill"],
    activities: [
      { title: "Bakery and cheese walk", blurb: "Croissant, baguette, three cheeses, zero regrets.", vibe: "food", price: 30, durationHours: 2, timeOfDay: "morning", lat: 48.858, lng: 2.36 },
      { title: "Musée d'Orsay", blurb: "Impressionists inside an old train station.", vibe: "culture", price: 18, durationHours: 3, timeOfDay: "afternoon", lat: 48.86, lng: 2.3266, indoor: true },
      { title: "Picnic on the Seine", blurb: "Wine, bread and a riverside spot at golden hour.", vibe: "chill", price: 20, durationHours: 2, timeOfDay: "evening", lat: 48.8519, lng: 2.3567 },
      { title: "Montmartre wander", blurb: "Hilltop streets, painters and a view over the rooftops.", vibe: "culture", price: 0, durationHours: 2.5, timeOfDay: "afternoon", lat: 48.8867, lng: 2.3431 },
      { title: "Jazz club in the Latin Quarter", blurb: "Cellar club, live band, late night.", vibe: "nightlife", price: 35, durationHours: 3, timeOfDay: "evening", lat: 48.852, lng: 2.346, indoor: true },
      { title: "Versailles day trip", blurb: "The palace, the hall of mirrors and huge gardens.", vibe: "outdoors", price: 40, durationHours: 6, timeOfDay: "morning", lat: 48.8049, lng: 2.1204, indoor: true },
    ],
  },
  {
    code: "BCN", city: "Barcelona", country: "Spain", lat: 41.3, lng: 2.08, color: "#FFB020",
    hotelNightly: 170, apartmentNightly: 125,
    neighborhoods: ["El Born", "Gràcia", "Eixample", "Barceloneta"],
    center: { lat: 41.3874, lng: 2.1686 },
    hoodCoords: { "El Born": [41.385, 2.183], "Gràcia": [41.403, 2.156], "Eixample": [41.392, 2.164], "Barceloneta": [41.38, 2.189] },
    vibes: ["beach", "food", "nightlife", "culture"],
    activities: [
      { title: "Tapas crawl in El Born", blurb: "Four bars, one dish each, vermouth in between.", vibe: "food", price: 40, durationHours: 3, timeOfDay: "evening", lat: 41.3845, lng: 2.1825, indoor: true },
      { title: "Sagrada Família", blurb: "Gaudí's basilica. The stained glass light is unreal.", vibe: "culture", price: 30, durationHours: 2, timeOfDay: "morning", lat: 41.4036, lng: 2.1744, indoor: true },
      { title: "Beach day at Barceloneta", blurb: "Sand, sun and seafood paella by the water.", vibe: "beach", price: 25, durationHours: 4, timeOfDay: "afternoon", lat: 41.3784, lng: 2.1925 },
      { title: "Park Güell", blurb: "Mosaic terraces with views over the whole city.", vibe: "outdoors", price: 12, durationHours: 2, timeOfDay: "morning", lat: 41.4145, lng: 2.1527 },
      { title: "Late dinner and clubbing", blurb: "Dinner at 10pm, dancing at 1am, very normal here.", vibe: "nightlife", price: 50, durationHours: 5, timeOfDay: "evening", lat: 41.387, lng: 2.197, indoor: true },
      { title: "Bunkers del Carmel sunset", blurb: "Old hilltop bunkers, the best free view in town.", vibe: "chill", price: 0, durationHours: 1.5, timeOfDay: "evening", lat: 41.4192, lng: 2.1617 },
    ],
  },
  {
    code: "HND", city: "Tokyo", country: "Japan", lat: 35.55, lng: 139.78, color: "#E8344E",
    hotelNightly: 160, apartmentNightly: 120,
    neighborhoods: ["Shibuya", "Shinjuku", "Asakusa", "Shimokitazawa"],
    center: { lat: 35.6812, lng: 139.7671 },
    hoodCoords: { "Shibuya": [35.6595, 139.7005], "Shinjuku": [35.6938, 139.7034], "Asakusa": [35.7148, 139.7967], "Shimokitazawa": [35.6614, 139.668] },
    vibes: ["food", "culture", "nightlife"],
    activities: [
      { title: "Ramen counter crawl", blurb: "Order from a ticket machine, slurp loudly, repeat.", vibe: "food", price: 25, durationHours: 2, timeOfDay: "evening", lat: 35.69, lng: 139.7, indoor: true },
      { title: "Senso-ji at sunrise", blurb: "Tokyo's oldest temple before the crowds arrive.", vibe: "culture", price: 0, durationHours: 1.5, timeOfDay: "morning", lat: 35.7148, lng: 139.7967 },
      { title: "Golden Gai bar hop", blurb: "Tiny bars that seat six people each.", vibe: "nightlife", price: 40, durationHours: 3, timeOfDay: "evening", lat: 35.6939, lng: 139.7045, indoor: true },
      { title: "Digital art museum", blurb: "Walk-through rooms of light and projection.", vibe: "culture", price: 30, durationHours: 2, timeOfDay: "afternoon", lat: 35.6491, lng: 139.7898, indoor: true },
      { title: "Depachika food hall", blurb: "Department-store basements full of perfect snacks.", vibe: "food", price: 20, durationHours: 1.5, timeOfDay: "afternoon", lat: 35.6916, lng: 139.7046, indoor: true },
      { title: "Day hike at Mount Takao", blurb: "Forest trails an hour from the city, with a summit view.", vibe: "outdoors", price: 15, durationHours: 6, timeOfDay: "morning", lat: 35.6251, lng: 139.2437 },
    ],
  },
  {
    code: "MSY", city: "New Orleans", country: "USA", lat: 29.99, lng: -90.26, color: "#8B5CF6",
    hotelNightly: 180, apartmentNightly: 140,
    neighborhoods: ["French Quarter", "Marigny", "Garden District", "Bywater"],
    center: { lat: 29.9511, lng: -90.0715 },
    hoodCoords: { "French Quarter": [29.9584, -90.0644], "Marigny": [29.964, -90.056], "Garden District": [29.929, -90.084], "Bywater": [29.963, -90.04] },
    vibes: ["food", "nightlife", "culture"],
    activities: [
      { title: "Beignets for breakfast", blurb: "Powdered sugar everywhere. Wear dark clothes.", vibe: "food", price: 8, durationHours: 1, timeOfDay: "morning", lat: 29.9575, lng: -90.0618 },
      { title: "Live jazz on Frenchmen St", blurb: "Bar to bar, a different band every set.", vibe: "nightlife", price: 25, durationHours: 3, timeOfDay: "evening", lat: 29.964, lng: -90.0575, indoor: true },
      { title: "Garden District walk", blurb: "Oak-lined streets and grand old houses.", vibe: "culture", price: 0, durationHours: 2, timeOfDay: "afternoon", lat: 29.929, lng: -90.084 },
      { title: "Cajun cooking class", blurb: "Make gumbo and jambalaya, then eat it all.", vibe: "food", price: 70, durationHours: 3, timeOfDay: "afternoon", lat: 29.959, lng: -90.065, indoor: true },
      { title: "Swamp boat tour", blurb: "Bayou wildlife, maybe an alligator or two.", vibe: "outdoors", price: 45, durationHours: 3, timeOfDay: "morning", lat: 29.79, lng: -90.112 },
    ],
  },
  {
    code: "KEF", city: "Reykjavik", country: "Iceland", lat: 63.98, lng: -22.61, color: "#14B8A6",
    hotelNightly: 210, apartmentNightly: 165,
    neighborhoods: ["Miðborg", "Vesturbær", "Laugardalur"],
    center: { lat: 64.1466, lng: -21.9426 },
    hoodCoords: { "Miðborg": [64.1466, -21.9426], "Vesturbær": [64.146, -21.965], "Laugardalur": [64.143, -21.878] },
    vibes: ["outdoors", "chill"],
    activities: [
      { title: "Golden Circle drive", blurb: "Geysers, a huge waterfall and a rift between continents.", vibe: "outdoors", price: 90, durationHours: 8, timeOfDay: "morning", lat: 64.2559, lng: -21.1299 },
      { title: "Geothermal lagoon soak", blurb: "Warm blue water in a lava field.", vibe: "chill", price: 75, durationHours: 3, timeOfDay: "afternoon", lat: 63.8804, lng: -22.4495 },
      { title: "Northern lights hunt", blurb: "Head out of town after dark if the forecast looks good.", vibe: "outdoors", price: 60, durationHours: 4, timeOfDay: "evening", lat: 64.164, lng: -22.022 },
      { title: "Hot dog and harbor walk", blurb: "Iceland's famous hot dog, then the old harbor.", vibe: "food", price: 6, durationHours: 1.5, timeOfDay: "afternoon", lat: 64.1484, lng: -21.9396 },
      { title: "Hallgrímskirkja tower", blurb: "Ride up for the colorful rooftops view.", vibe: "culture", price: 9, durationHours: 1, timeOfDay: "morning", lat: 64.1417, lng: -21.9266, indoor: true },
    ],
  },
  {
    code: "SJU", city: "San Juan", country: "Puerto Rico", lat: 18.44, lng: -66.0, color: "#0EA5E9",
    hotelNightly: 190, apartmentNightly: 130,
    neighborhoods: ["Old San Juan", "Condado", "Santurce", "Ocean Park"],
    center: { lat: 18.4655, lng: -66.1057 },
    hoodCoords: { "Old San Juan": [18.4655, -66.1057], "Condado": [18.458, -66.07], "Santurce": [18.44, -66.06], "Ocean Park": [18.456, -66.05] },
    vibes: ["beach", "food", "nightlife", "outdoors"],
    activities: [
      { title: "Beach day in Ocean Park", blurb: "Calm water, kitesurfers and a cold drink.", vibe: "beach", price: 15, durationHours: 4, timeOfDay: "afternoon", lat: 18.4565, lng: -66.049 },
      { title: "Old San Juan fort walk", blurb: "Blue cobblestones and a 500-year-old fort by the sea.", vibe: "culture", price: 10, durationHours: 2.5, timeOfDay: "morning", lat: 18.471, lng: -66.124 },
      { title: "Bioluminescent bay kayak", blurb: "Paddle at night through water that glows.", vibe: "outdoors", price: 60, durationHours: 3, timeOfDay: "evening", lat: 18.381, lng: -65.627 },
      { title: "Mofongo lunch", blurb: "Mashed plantains, garlic and whatever you pile on top.", vibe: "food", price: 22, durationHours: 1.5, timeOfDay: "afternoon", lat: 18.465, lng: -66.106, indoor: true },
      { title: "Salsa night in Santurce", blurb: "Live band, packed dance floor, beginners welcome.", vibe: "nightlife", price: 25, durationHours: 3, timeOfDay: "evening", lat: 18.448, lng: -66.064, indoor: true },
      { title: "Rainforest hike in El Yunque", blurb: "Waterfalls and jungle trails 45 minutes away.", vibe: "outdoors", price: 40, durationHours: 6, timeOfDay: "morning", lat: 18.3, lng: -65.79 },
    ],
  },
];

export function findDestination(code: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.code === code.toUpperCase());
}

export function findAirport(code: string): Airport | undefined {
  const a = getAirport(code);
  return a ? { code: a.code, city: a.city, lat: a.lat, lng: a.lng } : undefined;
}

// Rough mid-range nightly hotel rates by country, used only for sample prices.
const PRICEY = new Set("CH NO IS DK GB US FR NL IE AU NZ SG AE LU SE FI BE AT DE IL HK CA BS MV MC KY BM QA".split(" "));
const BUDGET = new Set(
  "IN TH VN ID PH KH LA NP LK EG MA KE TZ PE CO BO EC GT NI HN PK BD GE AM UZ KG TJ MM ET GH NG SN UG RW ZM ZW MZ MG TN DZ JO LB IR IQ MN BT".split(" "),
);

function nightlyFor(countryCode: string) {
  if (PRICEY.has(countryCode)) return { hotel: 200, apartment: 150 };
  if (BUDGET.has(countryCode)) return { hotel: 70, apartment: 50 };
  return { hotel: 125, apartment: 95 };
}

// Airport data names some cities by the airport's town or local spelling.
const CITY_NAMES: Record<string, string> = {
  ATH: "Athens", VCE: "Venice", NAP: "Naples", TPE: "Taipei", YUL: "Montreal", GIG: "Rio de Janeiro", MXP: "Milan", LIN: "Milan",
  CIA: "Rome", BGY: "Milan", NRT: "Tokyo", KIX: "Osaka", ITM: "Osaka", CGK: "Jakarta", EWR: "New York", LGA: "New York",
  STN: "London", LGW: "London", LTN: "London", ORY: "Paris", BVA: "Paris", SAW: "Istanbul", DMK: "Bangkok",
};

const STAMP_COLORS = ["#FF6B4A", "#E84A8A", "#4A6CFF", "#FFB020", "#14B8A6", "#8B5CF6", "#0EA5E9", "#E8344E", "#22A06B"];

// Generic ideas carry no photo on purpose: a picture of some other city's museum would mislead.
const genericActivities = (city: string): Omit<Activity, "id">[] => [
  { title: `Street food walk in ${city}`, blurb: "Snack your way through the busiest food streets.", vibe: "food", price: 25, durationHours: 2.5, timeOfDay: "evening" },
  { title: "Morning at the main market", blurb: "Coffee, fresh fruit and people-watching.", vibe: "food", price: 10, durationHours: 1.5, timeOfDay: "morning" },
  { title: `${city}'s top museum`, blurb: "Get the backstory of the city before you explore.", vibe: "culture", price: 15, durationHours: 2, timeOfDay: "afternoon", indoor: true },
  { title: "Old quarter wander", blurb: "No plan, just the oldest streets and a camera.", vibe: "culture", price: 0, durationHours: 2, timeOfDay: "afternoon" },
  { title: "Sunset from a high point", blurb: "Find the best free view in town at golden hour.", vibe: "chill", price: 0, durationHours: 1.5, timeOfDay: "evening" },
  { title: "Live music night", blurb: "Ask a local where the good band is playing tonight.", vibe: "nightlife", price: 25, durationHours: 3, timeOfDay: "evening", indoor: true },
  { title: "Cooking class", blurb: "Learn two local dishes, then eat them.", vibe: "food", price: 55, durationHours: 3, timeOfDay: "afternoon", indoor: true },
  { title: `Day trip outside ${city}`, blurb: "Trails, villages or coastline within an hour or two.", vibe: "outdoors", price: 40, durationHours: 7, timeOfDay: "morning" },
  { title: "Slow café morning", blurb: "A long breakfast somewhere with a good window seat.", vibe: "chill", price: 12, durationHours: 1.5, timeOfDay: "morning", indoor: true },
  { title: "Free walking tour", blurb: "Two hours with a local guide. Tip what it was worth.", vibe: "culture", price: 10, durationHours: 2, timeOfDay: "morning" },
  { title: "Rooftop bar at sunset", blurb: "A cocktail with the skyline turning gold.", vibe: "nightlife", price: 25, durationHours: 2, timeOfDay: "evening" },
  { title: "Bike around the city", blurb: "Rent a bike and cover twice the ground.", vibe: "outdoors", price: 15, durationHours: 3, timeOfDay: "morning" },
  { title: "Night market", blurb: "Stalls, snacks and lights after dark.", vibe: "food", price: 15, durationHours: 2, timeOfDay: "evening" },
  { title: "Botanical garden stroll", blurb: "Shady paths and a quiet hour away from traffic.", vibe: "chill", price: 5, durationHours: 1.5, timeOfDay: "morning" },
  { title: "Art gallery afternoon", blurb: "Local artists, old and new. Great on a rainy day.", vibe: "culture", price: 12, durationHours: 2, timeOfDay: "afternoon", indoor: true },
  { title: "Local craft beer tasting", blurb: "A flight of whatever the neighborhood brews.", vibe: "nightlife", price: 20, durationHours: 2, timeOfDay: "evening", indoor: true },
  { title: "Boat or river cruise", blurb: "See the city from the water.", vibe: "chill", price: 25, durationHours: 1.5, timeOfDay: "afternoon" },
  { title: "Spa or hot bath afternoon", blurb: "Steam, soak and come back new.", vibe: "chill", price: 35, durationHours: 2.5, timeOfDay: "afternoon", indoor: true },
  { title: "Dinner at a classic local spot", blurb: "The place your taxi driver would recommend.", vibe: "food", price: 35, durationHours: 2, timeOfDay: "evening", indoor: true },
  { title: "Dessert and bakery hop", blurb: "Three sweet stops, one per neighborhood.", vibe: "food", price: 12, durationHours: 1.5, timeOfDay: "afternoon" },
  { title: "Street art hunt", blurb: "Murals and graffiti in the coolest part of town.", vibe: "culture", price: 0, durationHours: 2, timeOfDay: "afternoon" },
  { title: "Comedy or theater show", blurb: "See what's playing tonight, grab cheap seats.", vibe: "nightlife", price: 30, durationHours: 2, timeOfDay: "evening", indoor: true },
  { title: "Dance club night", blurb: "Late dinner, then dancing until it's early.", vibe: "nightlife", price: 25, durationHours: 4, timeOfDay: "evening", indoor: true },
  { title: "Nearby beach or lake swim", blurb: "Find the closest water and spend a lazy afternoon.", vibe: "beach", price: 5, durationHours: 3, timeOfDay: "afternoon" },
  { title: "Kayak or paddleboard", blurb: "An hour or two on calm water.", vibe: "outdoors", price: 30, durationHours: 2, timeOfDay: "morning" },
  { title: "Vintage and flea market browse", blurb: "Hunt for a one-of-a-kind souvenir.", vibe: "chill", price: 0, durationHours: 2, timeOfDay: "morning" },
];

export interface Place {
  code: string;
  city: string;
  country: string;
  color: string;
  hotelNightly: number;
  apartmentNightly: number;
  neighborhoods: string[];
  activities: Omit<Activity, "id">[];
  featured: boolean;
  center?: { lat: number; lng: number };
  hoodCoords?: Record<string, [number, number]>;
}

/** Everything the agents need about a destination: hand-written for featured cities, estimated for the rest. */
export function getPlace(code: string): Place | undefined {
  const featured = findDestination(code);
  if (featured) {
    const activities = [...featured.activities, ...(MORE_ACTIVITIES[featured.code] ?? [])]
      .map((a) => ({ ...a, wiki: a.wiki ?? ACTIVITY_WIKI[a.title] }));
    return { ...featured, activities, featured: true };
  }
  const a = getAirport(code);
  if (!a) return undefined;
  const rates = nightlyFor(a.countryCode);
  const hash = a.code.split("").reduce((s, c) => s * 31 + c.charCodeAt(0), 7);
  return {
    code: a.code,
    city: CITY_NAMES[a.code] ?? a.city,
    country: a.country,
    color: STAMP_COLORS[Math.abs(hash) % STAMP_COLORS.length],
    hotelNightly: rates.hotel,
    apartmentNightly: rates.apartment,
    neighborhoods: ["the city center", "the old town", "a quieter neighborhood"],
    activities: genericActivities(a.city),
    featured: false,
  };
}

/** Great-circle distance in miles. */
export function distanceMiles(a: Airport, b: Airport): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough per-person round-trip fare used for demo data and "Surprise me". */
export function estimateFare(origin: Airport, dest: Airport): number {
  const miles = distanceMiles(origin, dest);
  return Math.round((120 + miles * 0.11) / 5) * 5;
}

/** Rough total trip cost for one traveler, used to pick "Surprise me" destinations. */
export function estimateTripCost(origin: Airport, dest: Destination, nights: number, travelers: number): number {
  const fare = estimateFare(origin, dest) * travelers;
  const stay = Math.min(dest.hotelNightly, dest.apartmentNightly) * nights;
  const fun = 40 * nights * travelers;
  return fare + stay + fun;
}
