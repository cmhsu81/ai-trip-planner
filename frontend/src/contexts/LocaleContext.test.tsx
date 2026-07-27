import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider, useLocale } from "./LocaleContext";
import en from "@/lib/i18n/en.json";
import zh from "@/lib/i18n/zh.json";

function Probe({ localeKey }: { localeKey: keyof typeof en }) {
  const { t, locale, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="translated">{t(localeKey)}</span>
      <button onClick={() => setLocale("en")}>to-en</button>
      <button onClick={() => setLocale("zh")}>to-zh</button>
    </div>
  );
}

describe("LocaleContext t()", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to zh and resolves a known key to the zh dictionary value", () => {
    render(
      <LocaleProvider>
        <Probe localeKey="planner.generate" />
      </LocaleProvider>
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("zh");
    expect(screen.getByTestId("translated")).toHaveTextContent(zh["planner.generate"]);
  });

  it("resolves the same key correctly after switching to en", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <Probe localeKey="planner.generate" />
      </LocaleProvider>
    );

    await act(async () => {
      await user.click(screen.getByText("to-en"));
    });

    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(screen.getByTestId("translated")).toHaveTextContent(en["planner.generate"]);
  });

  it("persists the chosen locale to localStorage", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <Probe localeKey="planner.generate" />
      </LocaleProvider>
    );

    await act(async () => {
      await user.click(screen.getByText("to-en"));
    });

    expect(localStorage.getItem("locale")).toBe("en");
  });

  it("falls back to the raw key when the key is unknown to the dictionary", () => {
    render(
      <LocaleProvider>
        {/* @ts-expect-error intentionally passing an unknown key to test fallback behavior */}
        <Probe localeKey="this.key.does.not.exist" />
      </LocaleProvider>
    );

    expect(screen.getByTestId("translated")).toHaveTextContent("this.key.does.not.exist");
  });

  it("useLocale throws when used outside of a LocaleProvider", () => {
    function Bare() {
      useLocale();
      return null;
    }
    // Suppress the expected React error boundary console noise for this assertion.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow("useLocale must be used within LocaleProvider");
    spy.mockRestore();
  });
});
