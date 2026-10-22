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
    const response = await fetch(`${url}${city}`);
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

export const getMonthlyPrayers = async (city: number) => {
  return getDataByCity(city, MONTHLY_URL, parseMonthlyPrayers);
};
export const getDailyPrayers = async (city: number) => {
  return getDataByCity(city, DAILY_URL, parseDailyPrayers);
};
export const getWeatherDay = async (slug: string, day: number) => {
  return getDataByCity(`${slug}?day=${day}`, METEO_URL, parseWeatherDay);
};

export const weatherIcon = (code: number) => {
  const name = Object.keys(WEATHER_ICONS).find((key) =>
    WEATHER_ICONS[key].includes(code),
  );
  return name ? `/assets/weather/${name}.png` : null;
};

export const parseWeatherDay = (data: string) => {
  const $ = load(data);
  const code = $(".weathericon-big")
    .attr("class")
    ?.match(/weathericon(\d+)/)?.[1];
  const max = $(".hote-meteo").first().text().trim();
  // meteomaroc answers unknown cities with an empty page
  if (!code && !max) return null;
  return {
    date: $(".selected_ville_part1_top > label").first().text().trim(),
    icon: code ? weatherIcon(Number(code)) : null,
    max,
    min: $(".cooled-meteo").first().text().trim(),
    days: $("a.item_previsionsjours_slider_days_list")
      .toArray()
      .map((a) => ({
        value: Number($(a).attr("href")?.match(/day=(\d+)/)?.[1]),
        label: $(a).find("label").text().trim(),
      })),
  };
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
