import type { NextPage, GetServerSideProps } from "next";
import { getWeatherDay } from "utils";
import Head from "next/head";
import { useRouter } from "next/router";
import { Fragment, useRef } from "react";
import * as htmlToImage from "html-to-image";

// meteomaroc.com slugs, row by row (right column first), matching the names printed on weather-template.jpg
const WEATHER_CITIES = [
    "oujda", "safi",
    "nador", "errachidia",
    "tanger", "marrakech",
    "rabat", "agadir",
    "casablanca", "laayoune",
    "fes", "dakhla",
];

// Overlay positions in % of the 819x1024 template, measured from the centres of its white pills
const ROW_TOPS = [43.02, 51.42, 59.72, 68.07, 76.42, 84.81];
const COLUMNS = [{ temp: 58.85, icon: 91.4 }, { temp: 20.76, icon: 8.6 }]; // right, left

interface CityWeather {
    icon: string | null;
    max: string;
    min: string;
}

interface DayOption {
    value: number;
    label: string;
}

interface WeatherProps {
    day: number;
    date: string;
    days: DayOption[];
    cities: (CityWeather | null)[];
}

const at = (left: number, top: number) => ({
    position: "absolute" as const,
    left: `${left}%`,
    top: `${top}%`,
    transform: "translate(-50%, -50%)",
    whiteSpace: "nowrap" as const,
});

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
    const requested = Number(query.day);
    const day = Number.isInteger(requested) && requested >= 1 && requested <= 14 ? requested : 1;

    // One request at a time: meteomaroc stalls bursts of parallel connections for ~10s.
    // getWeatherDay returns null on any fetch/parse failure, so one city can't break the poster.
    const results = [];
    for (const slug of WEATHER_CITIES) results.push(await getWeatherDay(slug, day));
    const first = results.find(Boolean);

    return {
        props: {
            day,
            date: first?.date ?? "",
            days: [{ value: 1, label: "اليوم" }, ...(first?.days ?? [])],
            cities: results.map((r) => r && { icon: r.icon, max: r.max, min: r.min }),
        },
    };
};

const Weather: NextPage<WeatherProps> = ({ day, date, days, cities }) => {
    const router = useRouter();
    const exportRef = useRef<HTMLDivElement>(null);

    const handleDownloadImage = async () => {
        if (!exportRef.current) return;
        try {
            const dataUrl = await htmlToImage.toPng(exportRef.current, {
                quality: 1,
                pixelRatio: 2, // High resolution
            });
            const link = document.createElement("a");
            const safeFilename = date.replace(/[^a-zA-Z0-9؀-ۿ\s-]/g, '').trim();
            link.download = `weather-${safeFilename}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Failed to download image", err);
        }
    };

    return (
        <>
            <Head>
                <title>حالة الطقس - شوف TV</title>
                <meta name="description" content="حالة الطقس لأهم مدن المغرب" />
                {/* crossOrigin lets html-to-image read this sheet and embed the font in the PNG */}
                <link
                    href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;700;900&display=swap"
                    rel="stylesheet"
                    crossOrigin="anonymous"
                />
            </Head>

            <div
                dir="rtl"
                style={{
                    minHeight: "100vh",
                    background: "#111",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    fontFamily: "'Noto Kufi Arabic', serif",
                    padding: "2rem 1rem",
                }}
            >
                <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", width: "100%", maxWidth: "819px", background: "#222", padding: "1rem 2rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <label htmlFor="weather-day" style={{ color: "#fff", fontWeight: "bold", fontSize: "1.1rem" }}>اختر اليوم:</label>
                    <select
                        id="weather-day"
                        value={day}
                        onChange={(e) => router.push(`/weather?day=${e.target.value}`)}
                        style={{ padding: "10px 16px", borderRadius: "8px", border: "none", background: "#fff", color: "#111", fontSize: "1rem", fontWeight: "bold", fontFamily: "inherit", cursor: "pointer", minWidth: "250px" }}
                    >
                        {days.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleDownloadImage}
                        style={{ padding: "10px 20px", background: "#f97316", color: "#fff", fontWeight: "bold", fontSize: "1rem", fontFamily: "inherit", border: "none", borderRadius: "8px", cursor: "pointer", boxShadow: "0 4px 12px rgba(249,115,22,0.4)" }}
                    >
                        تحميل
                    </button>
                </div>

                {/* Fixed-size poster; scrolls sideways on narrow screens */}
                <div style={{ maxWidth: "100%", overflowX: "auto" }}>
                    <div ref={exportRef} style={{ position: "relative", width: "819px" }}>
                        <img src="/assets/weather-template.jpg" alt="حالة الطقس ليوم" width={819} height={1024} style={{ display: "block" }} />

                        <span style={{ ...at(50, 37.5), color: "#fff", fontWeight: 700, fontSize: "21px", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                            {date}
                        </span>

                        {cities.map((city, i) => {
                            const top = ROW_TOPS[Math.floor(i / 2)];
                            const column = COLUMNS[i % 2];
                            return (
                                <Fragment key={WEATHER_CITIES[i]}>
                                    <span style={{ ...at(column.temp, top), direction: "ltr", color: "#262626", fontWeight: 700, fontSize: "28px", lineHeight: 1 }}>
                                        {city ? <><span style={{ color: "#c86115" }}>{city.max}</span>/{city.min}</> : "--"}
                                    </span>
                                    {city?.icon && (
                                        <img src={city.icon} alt="" style={{ ...at(column.icon, top), width: "48px", height: "48px" }} />
                                    )}
                                </Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Weather;
