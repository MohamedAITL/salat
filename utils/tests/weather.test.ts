/**
 * @jest-environment node
 */
import { parseWeatherDays, weatherIcon } from "../index";

// Trimmed from https://www.meteomaroc.com/ar/previsions/casablanca?day=1
const PAGE = `
<a href="/ar/previsions/casablanca?day=2" class="indextoshow item_previsionsjours_slider_days_list"> <i class="weathericon-med weathericon116"></i> <p> <label> جمع 23</label> <span class="hote">25°</span><span class="cooled">18°</span> </p> </a>
<a href="/ar/previsions/casablanca?day=3" class=" item_previsionsjours_slider_days_list"> <i class="weathericon-med weathericon116"></i> <p> <label> سبت 24</label> <span class="hote">26°</span><span class="cooled">16°</span> </p> </a>
<div class="row"> <div class="selected_ville_part1_top"> <label> الخميس 22 أكتوبر 2026 </label> </div>
<div class="row selected_ville_part1_top"> <div class="col-lg-3 d-flex justify-content-center"> <div class="weathericon-big weathericon119"></div> </div>
<p> العظمى <span class="hote-meteo"> <img src="/build/assets/images/arrow-up.png" alt="meteo الدار البيضاء"/> 25° </span> </p>
<p> الصغرى <span class="cooled-meteo"> <img src="/build/assets/images/arrow-down.png" alt="météo الدار البيضاء"/> 16° </span> </p>
</div></div>`;

describe("parseWeatherDays", () => {
  it("reads today and the following days from the strip", () => {
    expect(parseWeatherDays(PAGE)).toEqual([
      { day: 1, icon: "/assets/weather/nuageux2.png", max: "25°", min: "16°" },
      { day: 2, icon: "/assets/weather/nuageux.png", max: "25°", min: "18°" },
      { day: 3, icon: "/assets/weather/nuageux.png", max: "26°", min: "16°" },
    ]);
  });

  it("returns null for the empty page of an unknown city", () => {
    expect(parseWeatherDays("<html><body><h1> </h1></body></html>")).toBeNull();
  });
});

describe("weatherIcon", () => {
  it("maps meteomaroc codes to the local icon files", () => {
    expect(weatherIcon(113)).toBe("/assets/weather/soleil.png");
    expect(weatherIcon(116)).toBe("/assets/weather/nuageux.png");
    expect(weatherIcon(999)).toBeNull();
  });
});
