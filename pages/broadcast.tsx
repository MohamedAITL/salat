import type { NextPage, GetServerSideProps } from "next";
import { getAladhanPrayers, getMonthlyPrayers, toMoroccoTime } from "utils";
import cities from "data/cities.json";
import Head from "next/head";
import { useRef, useState } from "react";
import * as htmlToImage from "html-to-image";

// City IDs from habous.gov.ma via salat/data/cities.json
const BROADCAST_CITIES = [
    { id: 14, name: "طنجة" },
    { id: 58, name: "الدار البيضاء" },
    { id: 1, name: "الرباط" },
    { id: 104, name: "مراكش" },
    { id: 117, name: "أكادير" },
    { id: 81, name: "فاس" },
    { id: 156, name: "العيون" },
    { id: 165, name: "الداخلة" }
];

interface PrayerTimes {
    fajr: string;
    dohr: string;
    asr: string;
    maghrib: string;
    ishae: string;
}

interface CityRow {
    name: string;
    times: PrayerTimes | null;
}

interface DayOption {
    value: number;
    label: string;
    titleStr: string;
    cities: CityRow[];
}

interface BroadcastProps {
    days: DayOption[];
    defaultDayIndex: number;
    source: "habous" | "aladhan";
}

const formatTime = (t: string | undefined) =>
    t ? t.replace(/\s*\(.*?\)/g, "").trim() : "--:--";

// Gregorian month names as habous.gov.ma writes them
const MOROCCAN_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو", "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر"];

const moroccoDate = (ms: number) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Casablanca", day: "2-digit", month: "2-digit", year: "numeric" })
        .format(ms)
        .replace(/\//g, "-");

// Next 30 days from Aladhan, shaped like the habous days, for when habous.gov.ma is down
const getBackupDays = async (): Promise<DayOption[]> => {
    const from = moroccoDate(Date.now());
    const to = moroccoDate(Date.now() + 29 * 864e5);
    const calendars = await Promise.all(BROADCAST_CITIES.map(({ id }) => {
        const city = cities.find((c) => c.id === id)!;
        // cities.json stores degrees and minutes; Moroccan longitudes are west
        return getAladhanPrayers(city.lat_d + city.lat_m / 60, -(city.long_d + city.long_m / 60), from, to);
    }));
    if (!calendars[0]) return [];

    return calendars[0].map((day: any, i: number) => {
        const g = day.date.gregorian;
        const h = day.date.hijri;
        const dayName = h.weekday.ar;
        const gMonthName = MOROCCAN_MONTHS[g.month.number - 1];
        const hMonthName = h.month.ar.replace(/[ً-ْ]/g, ""); // drop diacritics: "جُمادى" -> "جمادى"
        return {
            value: i,
            label: `${dayName} ${g.day} ${gMonthName} - ${h.day} ${hMonthName}`,
            titleStr: `${dayName} ${h.day} ${hMonthName} ${h.year}هـ | الموافق ${g.day} ${gMonthName} ${g.year}م`,
            cities: BROADCAST_CITIES.map((city, cIdx) => {
                const t = calendars[cIdx]?.[i]?.timings;
                return {
                    name: city.name,
                    times: t ? {
                        fajr: toMoroccoTime(t.Fajr),
                        dohr: toMoroccoTime(t.Dhuhr),
                        asr: toMoroccoTime(t.Asr),
                        maghrib: toMoroccoTime(t.Maghrib),
                        ishae: toMoroccoTime(t.Isha),
                    } : null,
                };
            }),
        };
    });
};

export const getServerSideProps: GetServerSideProps = async () => {
    const fetchCity = async (city: { id: number }) => {
        try {
            const data = await getMonthlyPrayers(city.id);
            return data || [];
        } catch {
            return [];
        }
    };

    // The first city's table builds the day list, so when habous.gov.ma is down
    // give up after one request instead of waiting on all 8
    const firstCityData = await fetchCity(BROADCAST_CITIES[0]);
    const allCitiesData = firstCityData.length > 1
        ? [firstCityData, ...(await Promise.all(BROADCAST_CITIES.slice(1).map(fetchCity)))]
        : [];
    const days: DayOption[] = [];

    if (firstCityData && firstCityData.length > 1) {
        const gYear = new Date().getFullYear(); // e.g. 2026
        const hYear = 1447; // User requested Hijri year

        const monthHeader = firstCityData[0].month;
        const gMonths = monthHeader.split(" / ").map((m: string) => m.trim());
        const arabicMonthName = firstCityData[0].arabic_month;

        let currentGMonthIndex = 0;
        let prevGDay = -1;

        for (let i = 1; i < firstCityData.length; i++) {
            const row = firstCityData[i];

            if (row.arabic_month === "حسب نتيجة المراقبة") {
                continue;
            }

            const gDay = parseInt(row.month, 10);
            if (prevGDay > 20 && gDay < 10) {
                currentGMonthIndex = gMonths.length > 1 ? 1 : 0;
            }
            prevGDay = gDay;

            const gMonthName = gMonths[currentGMonthIndex] || gMonths[0];
            const hDay = row.arabic_month;
            const dayName = row.day_name;

            const gDayStr = gDay.toString().padStart(2, '0');
            const hDayStr = hDay.toString().padStart(2, '0');

            const label = `${dayName} ${gDayStr} ${gMonthName} - ${hDayStr} ${arabicMonthName}`;
            const titleStr = `${dayName} ${hDayStr} ${arabicMonthName} ${hYear}هـ | الموافق ${gDayStr} ${gMonthName} ${gYear}م`;

            const citiesData = BROADCAST_CITIES.map((city, cIdx) => {
                const cityRow = allCitiesData[cIdx][i];
                return {
                    name: city.name,
                    times: cityRow ? {
                        fajr: formatTime(cityRow.fajr),
                        dohr: formatTime(cityRow.dohr),
                        asr: formatTime(cityRow.asr),
                        maghrib: formatTime(cityRow.maghrib),
                        ishae: formatTime(cityRow.ishae),
                    } : null
                };
            });

            days.push({
                value: i - 1,
                label,
                titleStr,
                cities: citiesData
            });
        }
    }

    const source = days.length > 0 ? "habous" : "aladhan";
    if (source === "aladhan") days.push(...await getBackupDays());

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDate();
    const tomorrowStr = tomorrowDay.toString().padStart(2, '0');

    let defaultDayIndex = 0;
    const tomorrowIndex = days.findIndex(d => d.label.includes(` ${tomorrowStr} `));
    if (tomorrowIndex !== -1) {
        defaultDayIndex = tomorrowIndex;
    }

    return { props: { days, defaultDayIndex, source } };
};

const Broadcast: NextPage<BroadcastProps> = ({ days, defaultDayIndex, source }) => {
    const exportRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState(defaultDayIndex);

    if (!days || days.length === 0) {
        // Own dark background: the light theme paints the body white, which hid this white text
        return (
            <div dir="rtl" style={{ minHeight: "100vh", background: "#111", color: "#fff", padding: "4rem 1rem", textAlign: "center", lineHeight: 2 }}>
                <p>تعذر جلب مواقيت الصلاة من موقع وزارة الأوقاف (habous.gov.ma) ومن المصدر الاحتياطي (aladhan.com). حاول مرة أخرى لاحقاً.</p>
                <p>
                    <a href="/broadcast" style={{ color: "#f97316" }}>إعادة المحاولة</a>
                    {" · "}
                    <a href="/weather" style={{ color: "#f97316" }}>حالة الطقس</a>
                </p>
            </div>
        );
    }

    const selectedDay = days[selectedIndex];

    const handleDownloadImage = async () => {
        if (!exportRef.current) return;
        try {
            const dataUrl = await htmlToImage.toPng(exportRef.current, {
                quality: 1,
                pixelRatio: 2, // High resolution
            });
            const link = document.createElement("a");
            const safeFilename = selectedDay.titleStr.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, '').trim();
            link.download = `prayer-times-${safeFilename}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Failed to download image", err);
        }
    };

    return (
        <>
            <Head>
                <title>مواقيت الصلاة - شوف TV</title>
                <meta name="description" content="مواقيت الصلاة لأهم مدن المغرب" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;700;900&display=swap"
                    rel="stylesheet"
                />
            </Head>

            <div
                dir="rtl"
                style={{
                    minHeight: "100vh",
                    background: "#111", // Fallback
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    fontFamily: "'Noto Kufi Arabic', serif",
                    padding: "2rem 1rem",
                    position: "relative",
                    overflow: "visible",
                }}
            >
                <style>{`
                    .br-dropdown-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .br-logo { height: 130px; }
                    .br-title { font-size: 3.5rem; }
                    .br-subtitle { font-size: 1.3rem; }
                    .br-header, .br-row { padding: 0.75rem 1rem; }
                    .br-header-text { font-size: 1.05rem; }
                    .br-row-text { font-size: 1.05rem; }
                    
                    @media (max-width: 640px) {
                        .br-dropdown-container {
                            flex-direction: column;
                            align-items: stretch !important;
                            gap: 1rem;
                        }
                        .br-logo { height: 80px !important; }
                        .br-title { font-size: 2.2rem !important; }
                        .br-subtitle { font-size: 1rem !important; }
                        .br-header, .br-row { padding: 0.5rem 0.25rem !important; }
                        .br-header-text { font-size: 0.75rem !important; }
                        .br-row-text { font-size: 0.75rem !important; }
                    }
                `}</style>
                {/* Dropdown UI to select the day */}
                <div
                    className="br-dropdown-container"
                    style={{ marginBottom: "2rem", zIndex: 10, position: "relative", width: "100%", maxWidth: "820px", background: "#222", padding: "1rem 2rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <label style={{ color: "#fff", fontWeight: "bold", fontSize: "1.1rem", textAlign: "center" }}>اختر اليوم:</label>
                    <select
                        value={selectedIndex}
                        onChange={(e) => setSelectedIndex(Number(e.target.value))}
                        style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            border: "none",
                            outline: "none",
                            background: "#fff",
                            color: "#111",
                            fontSize: "1rem",
                            fontWeight: "bold",
                            fontFamily: "'Noto Kufi Arabic', serif",
                            cursor: "pointer",
                            minWidth: "250px"
                        }}
                    >
                        {/* value is the position in days (what selectedIndex indexes), not the habous row number */}
                        {days.map((day, idx) => (
                            <option key={idx} value={idx}>{day.label}</option>
                        ))}
                    </select>
                    <a href="/weather" style={{ color: "#fff", fontWeight: "bold", textDecoration: "underline", textAlign: "center" }}>حالة الطقس</a>
                    <button
                        onClick={handleDownloadImage}
                        style={{
                            padding: "10px 20px",
                            background: "#f97316",
                            color: "#fff",
                            fontWeight: "bold",
                            fontSize: "1rem",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(249,115,22,0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                        }}
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        تحميل
                    </button>
                </div>

                {source === "aladhan" && (
                    <p style={{ color: "#f6d860", width: "100%", maxWidth: "820px", margin: "-1rem 0 1.5rem", textAlign: "center", fontSize: "0.95rem" }}>
                        موقع habous.gov.ma غير متاح: المواقيت من المصدر الاحتياطي aladhan.com (طريقة المغرب). تحقق من التاريخ الهجري قبل النشر.
                    </p>
                )}

                {/* The Graphic we want to export */}
                <div
                    ref={exportRef}
                    style={{
                        width: "100%",
                        maxWidth: "820px",
                        background: "transparent",
                        padding: "0",
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Header */}
                    <div style={{ textAlign: "center", marginBottom: "1.5rem", position: "relative", zIndex: 2 }}>
                        {/* TV Logo using uploaded image */}
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
                            <img
                                src="/assets/logo.png"
                                alt="شوف TV"
                                className="br-logo"
                                style={{ objectFit: "contain", filter: "drop-shadow(0 4px 15px rgba(249,115,22,0.4))" }}
                            />
                        </div>

                        <h1
                            className="br-title"
                            style={{
                                color: "#f6d860",
                                fontWeight: 900,
                                margin: "0 0 0.5rem",
                                textShadow: "0 2px 12px rgba(246,216,96,0.4)",
                                letterSpacing: "0.02em",
                            }}
                        >
                            مواقيت الصلاة
                        </h1>

                        <p
                            className="br-subtitle"
                            style={{
                                color: "#f0c060",
                                fontWeight: 700,
                                margin: 0,
                            }}
                        >
                            {selectedDay.titleStr}
                        </p>
                    </div>

                    {/* Table */}
                    <div
                        style={{
                            borderRadius: "12px",
                            overflow: "hidden",
                            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
                            position: "relative",
                            zIndex: 2,
                        }}
                    >
                        {/* Table Header */}
                        <div
                            className="br-header"
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1fr",
                                background: "#5b4bb0",
                            }}
                        >
                            {["", "الفجر", "الظهر", "العصر", "المغرب", "العشاء"].map(
                                (h, i) => (
                                    <div
                                        key={i}
                                        className="br-header-text"
                                        style={{
                                            color: "#ffffff",
                                            fontWeight: 700,
                                            textAlign: "center",
                                        }}
                                    >
                                        {h}
                                    </div>
                                )
                            )}
                        </div>

                        {/* Rows */}
                        {selectedDay.cities.map((row, idx) => (
                            <div
                                key={idx}
                                className="br-row"
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1fr",
                                    background: idx % 2 === 0 ? "#f97316" : "#ea6a10",
                                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                                }}
                            >
                                <div
                                    className="br-row-text"
                                    style={{
                                        color: "#fff",
                                        fontWeight: 700,
                                        textAlign: "right",
                                    }}
                                >
                                    {row.name}
                                </div>
                                {[
                                    row.times?.fajr,
                                    row.times?.dohr,
                                    row.times?.asr,
                                    row.times?.maghrib,
                                    row.times?.ishae,
                                ].map((t, ti) => (
                                    <div
                                        key={ti}
                                        className="br-row-text"
                                        style={{
                                            color: "#fff",
                                            fontWeight: 700,
                                            textAlign: "center",
                                            direction: "ltr",
                                        }}
                                    >
                                        {t ?? "--:--"}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div >
        </>
    );
};

export default Broadcast;
