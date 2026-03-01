import type { NextPage, GetServerSideProps } from "next";
import { getMonthlyPrayers } from "utils";
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
}

const formatTime = (t: string | undefined) =>
    t ? t.replace(/\s*\(.*?\)/g, "").trim() : "--:--";

export const getServerSideProps: GetServerSideProps = async () => {
    const allCitiesData = await Promise.all(
        BROADCAST_CITIES.map(async (city) => {
            try {
                const data = await getMonthlyPrayers(city.id);
                return data || [];
            } catch {
                return [];
            }
        })
    );

    const firstCityData = allCitiesData[0];
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

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDate();
    const tomorrowStr = tomorrowDay.toString().padStart(2, '0');

    let defaultDayIndex = 0;
    const tomorrowIndex = days.findIndex(d => d.label.includes(` ${tomorrowStr} `));
    if (tomorrowIndex !== -1) {
        defaultDayIndex = tomorrowIndex;
    }

    return { props: { days, defaultDayIndex } };
};

const Broadcast: NextPage<BroadcastProps> = ({ days, defaultDayIndex }) => {
    const exportRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState(defaultDayIndex);

    if (!days || days.length === 0) {
        return <div style={{ color: "white", padding: "2rem", textAlign: "center" }}>No data available</div>;
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
                    padding: "2rem",
                    position: "relative",
                    overflow: "visible",
                }}
            >
                {/* Dropdown UI to select the day */}
                <div style={{ marginBottom: "2rem", zIndex: 10, position: "relative", width: "100%", maxWidth: "820px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#222", padding: "1rem 2rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <label style={{ color: "#fff", fontWeight: "bold", fontSize: "1.1rem" }}>اختر اليوم:</label>
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
                        {days.map((day, idx) => (
                            <option key={idx} value={day.value}>{day.label}</option>
                        ))}
                    </select>
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
                                style={{ height: "130px", objectFit: "contain", filter: "drop-shadow(0 4px 15px rgba(249,115,22,0.4))" }}
                            />
                        </div>

                        <h1
                            style={{
                                color: "#f6d860",
                                fontSize: "3.5rem",
                                fontWeight: 900,
                                margin: "0 0 0.5rem",
                                textShadow: "0 2px 12px rgba(246,216,96,0.4)",
                                letterSpacing: "0.02em",
                            }}
                        >
                            مواقيت الصلاة
                        </h1>

                        <p
                            style={{
                                color: "#f0c060",
                                fontSize: "1.3rem",
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
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1fr",
                                background: "#5b4bb0",
                                padding: "0.75rem 1rem",
                            }}
                        >
                            {["", "الفجر", "الظهر", "العصر", "المغرب", "العشاء"].map(
                                (h, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            color: "#ffffff",
                                            fontWeight: 700,
                                            fontSize: "1.05rem",
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
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1fr",
                                    background: idx % 2 === 0 ? "#f97316" : "#ea6a10",
                                    padding: "0.7rem 1rem",
                                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                                }}
                            >
                                <div
                                    style={{
                                        color: "#fff",
                                        fontWeight: 700,
                                        fontSize: "1.05rem",
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
                                        style={{
                                            color: "#fff",
                                            fontWeight: 700,
                                            fontSize: "1.05rem",
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
