import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { ItineraryView, googleMapsUrl } from "./ItineraryView";
import { ItineraryDay, ItineraryItem } from "@/types";
import zh from "@/lib/i18n/zh.json";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function buildItem(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    id: "item-1",
    time: "09:00",
    title: "Senso-ji Temple",
    type: "attraction",
    description: "A historic temple.",
    location: "Senso-ji, Tokyo",
    estimatedDuration: "1h",
    sourceNote: null,
    imageUrl: null,
    confirmed: true,
    orderIndex: 0,
    ...overrides,
  };
}

function buildDays(item: ItineraryItem): ItineraryDay[] {
  return [{ id: "day-1", dayNumber: 1, date: null, items: [item] }];
}

function renderView(item: ItineraryItem) {
  return render(
    <LocaleProvider>
      <ItineraryView
        tripId="trip-1"
        itineraryDays={buildDays(item)}
        onChange={vi.fn()}
        onAskAiToReplace={vi.fn()}
      />
    </LocaleProvider>
  );
}

describe("googleMapsUrl", () => {
  it("builds a query from item.location when present", () => {
    const item = buildItem({ location: "Senso-ji, Tokyo" });
    expect(googleMapsUrl(item)).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Senso-ji, Tokyo")}`
    );
  });

  it("falls back to item.title when location is null", () => {
    const item = buildItem({ location: null, title: "Senso-ji Temple" });
    expect(googleMapsUrl(item)).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Senso-ji Temple")}`
    );
  });

  it("falls back to item.title when location is an empty string", () => {
    const item = buildItem({ location: "", title: "Senso-ji Temple" });
    expect(googleMapsUrl(item)).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Senso-ji Temple")}`
    );
  });
});

describe("ItineraryView Google Maps link", () => {
  it("renders the link with the built href when location is present", () => {
    renderView(buildItem({ location: "Senso-ji, Tokyo" }));

    const link = screen.getByRole("link", { name: zh["itinerary.viewOnMap"] });
    expect(link).toHaveAttribute(
      "href",
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Senso-ji, Tokyo")}`
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render the maps link when location is null", () => {
    renderView(buildItem({ location: null }));

    expect(screen.queryByRole("link", { name: zh["itinerary.viewOnMap"] })).not.toBeInTheDocument();
  });

  it("does not render the maps link when location is an empty string", () => {
    renderView(buildItem({ location: "" }));

    expect(screen.queryByRole("link", { name: zh["itinerary.viewOnMap"] })).not.toBeInTheDocument();
  });
});

describe("ItineraryView image thumbnail", () => {
  it("renders an image when imageUrl is present", () => {
    const { container } = renderView(buildItem({ imageUrl: "https://example.com/photo.jpg" }));

    // alt="" is intentional (decorative thumbnail), which removes it from the
    // accessibility tree, so query by tag rather than getByRole("img").
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("does not render an image when imageUrl is null", () => {
    const { container } = renderView(buildItem({ imageUrl: null }));

    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});
