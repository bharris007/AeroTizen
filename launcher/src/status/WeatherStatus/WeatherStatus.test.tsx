import { screen } from "@testing-library/preact";
import { expect, test } from "vitest";

import { renderWithEnglish } from "../../test/renderWithEnglish";

import { WeatherStatus } from "./WeatherStatus";

const cloudy = {
  city: "London",
  code: 3,
  condition: "Cloudy",
  text: "12°",
  temperature: 12,
  timeZone: "",
  visible: true,
};

test.each([
  { code: 0, glyph: "sun" },
  { code: 2, glyph: "cloud-sun" },
  { code: 3, glyph: "cloud" },
  { code: 45, glyph: "cloud-fog" },
  { code: 51, glyph: "cloud-rain" },
  { code: 71, glyph: "cloud-snow" },
  { code: 95, glyph: "cloud-lightning" },
])("renders $glyph for weather code $code without changing the temperature", ({ code, glyph }) => {
  const weather = { ...cloudy, code, showLocation: false };
  const { container } = renderWithEnglish(
    <WeatherStatus layout="compact" only={false} weather={weather} showWeather />,
  );

  expect(container.querySelector(`svg.lucide-${glyph}`)).not.toBeNull();
  expect(screen.getByText("12°")).toBeDefined();
  expect(screen.queryByText("London")).toBeNull();
});

test.each(["compact", "vertical"] as const)("%s header weather shows the temperature but never the city", (layout) => {
  const { container } = renderWithEnglish(
    <WeatherStatus layout={layout} only={false} weather={{ ...cloudy, showLocation: true }} showWeather />,
  );
  expect(screen.getByText("12°").hidden).toBe(false);
  expect(container.querySelector("svg.lucide-cloud")).not.toBeNull();
  expect(screen.queryByText("London")).toBeNull();
});
