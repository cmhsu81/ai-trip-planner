import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { PlannerForm } from "./PlannerForm";
import zh from "@/lib/i18n/zh.json";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn().mockResolvedValue({ suggestions: [] }),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderForm() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <LocaleProvider>
      <PlannerForm onSubmit={onSubmit} submitting={false} />
    </LocaleProvider>
  );

  const dateInputs = utils.container.querySelectorAll('input[type="date"]');
  const timeInputs = utils.container.querySelectorAll('input[type="time"]');
  const daysInput = utils.container.querySelector('input[type="number"]') as HTMLInputElement;
  const submitButton = utils.getByRole("button", { name: new RegExp(zh["planner.generate"]) });

  return {
    onSubmit,
    arrivalDateInput: dateInputs[0] as HTMLInputElement,
    departureDateInput: dateInputs[1] as HTMLInputElement,
    arrivalTimeInput: timeInputs[0] as HTMLInputElement,
    departureTimeInput: timeInputs[1] as HTMLInputElement,
    daysInput,
    submitButton,
    ...utils,
  };
}

describe("PlannerForm validation logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the same-day-invalid-time error and disables submit when departure time is not after arrival time on the same day", async () => {
    const user = userEvent.setup();
    const { arrivalDateInput, departureDateInput, arrivalTimeInput, departureTimeInput, submitButton } =
      renderForm();

    await user.type(arrivalDateInput, "2026-08-01");
    await user.type(departureDateInput, "2026-08-01");
    await user.clear(arrivalTimeInput);
    await user.type(arrivalTimeInput, "14:00");
    await user.clear(departureTimeInput);
    await user.type(departureTimeInput, "10:00");

    expect(screen.getByText(zh["planner.dateTimeError"])).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it("clears the error and re-enables submit once departure time is after arrival time", async () => {
    const user = userEvent.setup();
    const { arrivalDateInput, departureDateInput, arrivalTimeInput, departureTimeInput, submitButton } =
      renderForm();

    await user.type(arrivalDateInput, "2026-08-01");
    await user.type(departureDateInput, "2026-08-01");
    await user.clear(arrivalTimeInput);
    await user.type(arrivalTimeInput, "14:00");
    await user.clear(departureTimeInput);
    await user.type(departureTimeInput, "10:00");
    expect(submitButton).toBeDisabled();

    await user.clear(departureTimeInput);
    await user.type(departureTimeInput, "16:00");

    expect(screen.queryByText(zh["planner.dateTimeError"])).not.toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
  });

  it("does not flag a time error across different days even if departure time is earlier in the clock", async () => {
    const { arrivalDateInput, departureDateInput, arrivalTimeInput, departureTimeInput, submitButton } =
      renderForm();
    const user = userEvent.setup();

    await user.type(arrivalDateInput, "2026-08-01");
    await user.type(departureDateInput, "2026-08-05");
    await user.clear(arrivalTimeInput);
    await user.type(arrivalTimeInput, "20:00");
    await user.clear(departureTimeInput);
    await user.type(departureTimeInput, "08:00");

    expect(screen.queryByText(zh["planner.dateTimeError"])).not.toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
  });

  it("derives the days field from the arrival/departure date range and disables manual entry", async () => {
    const user = userEvent.setup();
    const { arrivalDateInput, departureDateInput, daysInput } = renderForm();

    expect(daysInput).not.toBeDisabled();

    await user.type(arrivalDateInput, "2026-08-01");
    await user.type(departureDateInput, "2026-08-05");

    await waitFor(() => expect(daysInput.value).toBe("5")); // Aug 1 -> Aug 5 inclusive = 5 days
    expect(daysInput).toBeDisabled();
  });

  it("auto-clears a departure date that falls before a newly picked arrival date", async () => {
    const user = userEvent.setup();
    const { arrivalDateInput, departureDateInput } = renderForm();

    await user.type(departureDateInput, "2026-08-01");
    expect(departureDateInput.value).toBe("2026-08-01");

    // moving arrival to a date after the previously chosen departure date
    await user.type(arrivalDateInput, "2026-08-10");

    await waitFor(() => expect(departureDateInput.value).toBe(""));
  });
});
