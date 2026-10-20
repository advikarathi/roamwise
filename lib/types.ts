export type Vibe = "food" | "culture" | "beach" | "nightlife" | "outdoors" | "chill";

export type StayType = "hotel" | "apartment" | "either";

export interface TripRequest {
  origin: string; // IATA code, e.g. "BOS"
  destination: string; // IATA code, e.g. "LIS"
  startDate: string; // YYYY-MM-DD (departure)
  endDate: string; // YYYY-MM-DD (return)
  travelers: number;
  budget: number; // total USD for the whole trip
  vibes: Vibe[];
  stayType: StayType;
}

export interface FlightOption {
  id: string;
  label: "Cheapest" | "Fastest" | "Best value";
  carrier: string;
  origin: string;
  destination: string;
  departTime: string; // "18:40"
  arriveTime: string; // "06:30"
  arriveNextDay: boolean;
  durationMinutes: number;
  stops: number;
  via?: string;
  price: number; // round trip, all travelers
  bookingUrl?: string;
  /** Real flights only: airline code and flight numbers ("TP218"), out and back. */
  carrierCode?: string;
  flightNumbers?: string[];
  returnFlightNumbers?: string[];
  /** Made-up demo fare (no flight data key), so there is no exact flight to link to. */
  sample?: boolean;
}

export interface StayOption {
  id: string;
  name: string;
  kind: "hotel" | "apartment";
  neighborhood: string;
  nightlyPrice: number;
  totalPrice: number;
  perks: string[];
  walkMinutes: number; // average walk to planned activities
  color: string; // used for the illustrated "photo"
  bookingUrl?: string;
  lat?: number;
  lng?: number;
  /** Real photo of the property (live data only). */
  photo?: string;
  /** Photo of the neighborhood, used when we have no photo of the place itself. */
  areaPhoto?: string;
  stars?: number; // official star rating
  reviewScore?: number; // guest score out of 10
  address?: string;
  website?: string;
  /** What the travel guide says about it. */
  blurb?: string;
  /** True when the price came from the guide, not an estimate. */
  priceListed?: boolean;
  wikidataId?: string;
  /** Google rating out of 5, and how many reviews it comes from. */
  rating?: number;
  ratingCount?: number;
  /** Photographer to credit under the photo (Google requires it). */
  imageCredit?: string;
}

export interface Activity {
  id: string;
  title: string;
  blurb: string;
  vibe: Vibe;
  price: number; // per person
  durationHours: number;
  timeOfDay: "morning" | "afternoon" | "evening";
  lat?: number; // approximate location, used for the map
  lng?: number;
  indoor?: boolean; // good for rainy days
  /** Real photo and a link to read more, when we found one. */
  image?: string;
  infoUrl?: string;
  /** English Wikipedia article to borrow the photo from. */
  wiki?: string;
  wikidataId?: string;
  address?: string;
  /** Set when the browser should look for a photo by name in this city. */
  photoCity?: string;
  /** Events happen on one date (YYYY-MM-DD); the itinerary puts them on that day. */
  date?: string;
  rating?: number;
  ratingCount?: number;
  imageCredit?: string;
}

export interface BudgetLine {
  category: "flights" | "stay" | "activities" | "transit";
  target: number;
  actual: number;
}

export interface TripPlan {
  request: TripRequest;
  destinationName: string;
  country: string;
  nights: number;
  flights: FlightOption[];
  selectedFlightId: string;
  stays: StayOption[];
  selectedStayId: string;
  activities: Activity[];
  suggestedActivityIds: string[];
  transitEstimate: number;
  budget: BudgetLine[];
  budgetNote?: string;
  source: "demo" | "live";
  /** City center, when known. Used for the map and weather. */
  center?: { lat: number; lng: number };
}

export type AgentId = "flights" | "stays" | "activities" | "budget";

export type AgentState = "waiting" | "working" | "done" | "error";

export type PlanEvent =
  | { type: "status"; agent: AgentId; state: AgentState; message: string }
  | { type: "plan"; plan: TripPlan }
  | { type: "error"; message: string };

export type Emit = (event: PlanEvent) => void;
