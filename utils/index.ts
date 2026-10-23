import { load } from "cheerio";

const VALUES = [
  "day_name",
  "arabic_month",
  "month",
  "fajr",
  "chorouq",
  "dohr",
  "asr",
  "maghrib",
  "ishae",
];

const MONTHLY_URL = "https://habous.gov.ma/prieres/horaire_hijri_2.php?ville=";
const DAILY_URL = "https://www.habous.gov.ma/prieres/horaire-api.php?ville=";
const METEO_URL = "https://www.meteomaroc.com/ar/previsions/";
const ALADHAN_URL = "https://api.aladhan.com/v1/calendar/from/";

// Icon file in public/assets/weather -> meteomaroc weather codes, as mapped in its /build/appfrontend.css
const WEATHER_ICONS: Record<string, number[]> = {
  soleil: [113, 143],
  nuageux: [116],
  nuageux2: [119, 122],
  nuageuxpluie: [176, 182, 185, 263, 293, 299, 305, 353, 356, 359, 365],
  snow: [179, 227, 230, 323, 326, 329, 332, 335, 338, 368, 371, 392, 395],
  eclair: [200, 386, 389],
  nuageleger: [248, 260],
  pluie: [266, 281, 284, 296, 302, 308, 311, 314, 317, 320, 362],
  snowtbrori: [350, 374, 377],
};

const getDataByCity = async (
  city: number | string,
  url: string,
  parseFn: (data: any) => any,
) => {
  try {
    // habous.gov.ma can take ~40s to answer 504 when down; meteomaroc's slowest successful replies take ~10s
    const response = await fetch(`${url}${city}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    const data = await response.text();
    return parseFn(data);
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error);
    return null;
  }
};

// Backup while habous.gov.ma is down: Aladhan's Morocco method (21) matched archived habous tables within 2 minutes.
// iso8601 returns true UTC instants (Aladhan's own Moroccan clock is an hour off), so convert them with toMoroccoTime.
export const getAladhanPrayers = async (lat: number, lng: number, from: string, to: string) => {
  return getDataByCity(
    `${from}/to/${to}?latitude=${lat}&longitude=${lng}&method=21&iso8601=true`,
    ALADHAN_URL,
    (data) => JSON.parse(data).data,
  );
};

// "HH:MM" on Morocco's legal clock: UTC+1, UTC+0 during Ramadan
export const toMoroccoTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Africa/Casablanca",
    hour: "2-digit",
    minute: "2-digit",
  });

export const getMonthlyPrayers = async (city: number) => {
  return getDataByCity(city, MONTHLY_URL, parseMonthlyPrayers);
};
export const getDailyPrayers = async (city: number) => {
  return getDataByCity(city, DAILY_URL, parseDailyPrayers);
};
// The day=1 page holds today's forecast plus a strip with days 2-14, so one request covers every day
export const getWeatherDays = async (slug: string) => {
  return getDataByCity(`${slug}?day=1`, METEO_URL, parseWeatherDays);
};

export const weatherIcon = (code: number) => {
  const name = Object.keys(WEATHER_ICONS).find((key) =>
    WEATHER_ICONS[key].includes(code),
  );
  return name ? `/assets/weather/${name}.png` : null;
};

const iconFromClass = (className?: string) => {
  const code = className?.match(/weathericon(\d+)/)?.[1];
  return code ? weatherIcon(Number(code)) : null;
};

export const parseWeatherDays = (data: string) => {
  const $ = load(data);
  const max = $(".hote-meteo").first().text().trim();
  // meteomaroc answers unknown cities with an empty page
  if (!max) return null;
  const today = {
    day: 1,
    icon: iconFromClass($(".weathericon-big").attr("class")),
    max,
    min: $(".cooled-meteo").first().text().trim(),
  };
  const nextDays = $("a.item_previsionsjours_slider_days_list")
    .toArray()
    .map((a) => ({
      day: Number($(a).attr("href")?.match(/day=(\d+)/)?.[1]),
      icon: iconFromClass($(a).find("i").attr("class")),
      max: $(a).find(".hote").text().trim(),
      min: $(a).find(".cooled").text().trim(),
    }));
  return [today, ...nextDays];
};

const parseMonthlyPrayers = (data: any) => {
  return parseResponse(data, "#horaire > tbody > tr", (items, $) => {
    return items.map((item: any) => {
      const result: Record<string, string> = {};
      const children = $(item).children();
      VALUES.forEach((value: string, index) => {
        result[value] = children.eq(index).html().trim();
      });
      return result;
    });
  });
};

const parseDailyPrayers = (data: any) => {
  return parseResponse(data, "table > tbody > tr > td", (items, $) => {
    const times = items
      .filter((_: any, i: number) => i % 2)
      .map((i: any) => $(i).text().trim());
    const result: Record<string, string> = {};
    [...VALUES].splice(3).forEach((key, index) => (result[key] = times[index]));
    return result;
  });
};

const parseResponse = (
  data: any,
  path: string,
  parsingFn: (a: any, b: any) => any,
) => {
  const $ = load(data);
  const items = $(path);
  return parsingFn(Array.from(items), $);
};
