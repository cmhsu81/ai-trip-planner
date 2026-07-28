import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
  const rangeInputs = utils.container.querySelectorAll('input[type="range"]');
  // destination input, must-see TagInput draft, must-eat TagInput draft (document order,
  // none of these three have an explicit `type` attribute so they default to text)
  const untypedInputs = utils.container.querySelectorAll("input:not([type])");
  const submitButton = utils.getByRole("button", { name: new RegExp(zh["planner.generate"]) });

  return {
    onSubmit,
    destinationInput: untypedInputs[0] as HTMLInputElement,
    mustSeeInput: untypedInputs[1] as HTMLInputElement,
    mustEatInput: untypedInputs[2] as HTMLInputElement,
    arrivalDateInput: dateInputs[0] as HTMLInputElement,
    departureDateInput: dateInputs[1] as HTMLInputElement,
    arrivalTimeInput: timeInputs[0] as HTMLInputElement,
    departureTimeInput: timeInputs[1] as HTMLInputElement,
    daysInput,
    travelStyleSlider: rangeInputs[0] as HTMLInputElement,
    budgetSlider: rangeInputs[1] as HTMLInputElement,
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

describe("PlannerForm travel style slider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // the selected label also appears (unhighlighted) in the static Chill/Moderate/Packed
  // row below the slider, so target the highlighted label span specifically
  function selectedLabelText(container: HTMLElement): string | null {
    return container.querySelector("label span.font-semibold")?.textContent ?? null;
  }

  it("defaults the travel style index to 1 (moderate)", () => {
    const { travelStyleSlider, container } = renderForm();
    expect(travelStyleSlider.value).toBe("1");
    expect(selectedLabelText(container)).toBe(zh["planner.travelStyleModerate"]);
  });

  it("moving the slider to 0 shows the Chill/relaxed label", () => {
    const { travelStyleSlider, container } = renderForm();

    fireEvent.change(travelStyleSlider, { target: { value: "0" } });

    expect(selectedLabelText(container)).toBe(zh["planner.travelStyleRelaxed"]);
  });

  it("moving the slider to 2 shows the Packed label", () => {
    const { travelStyleSlider, container } = renderForm();

    fireEvent.change(travelStyleSlider, { target: { value: "2" } });

    expect(selectedLabelText(container)).toBe(zh["planner.travelStylePacked"]);
  });

  it("submits travelStyle as the token matching the slider position at submit time", async () => {
    const user = userEvent.setup();
    const { travelStyleSlider, destinationInput, onSubmit, submitButton } = renderForm();

    await user.type(destinationInput, "Tokyo");
    fireEvent.change(travelStyleSlider, { target: { value: "2" } });
    await user.click(submitButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ travelStyle: "packed" });
  });

  it("submits the default moderate token when the slider is untouched", async () => {
    const user = userEvent.setup();
    const { destinationInput, onSubmit, submitButton } = renderForm();

    await user.type(destinationInput, "Tokyo");
    await user.click(submitButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ travelStyle: "moderate" });
  });
});

describe("PlannerForm must-see / must-eat tag inputs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("submits mustSeeAttractions as an array containing the typed value, and undefined when nothing was added", async () => {
    const user = userEvent.setup();
    const { destinationInput, mustSeeInput, onSubmit, submitButton } = renderForm();

    await user.type(destinationInput, "Tokyo");
    await user.type(mustSeeInput, "Shibuya Crossing{Enter}");
    await user.click(submitButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      mustSeeAttractions: ["Shibuya Crossing"],
      mustEatRestaurants: undefined,
    });
  });

  it("submits mustEatRestaurants as an array containing the typed value, and undefined when nothing was added", async () => {
    const user = userEvent.setup();
    const { destinationInput, mustEatInput, onSubmit, submitButton } = renderForm();

    await user.type(destinationInput, "Tokyo");
    await user.type(mustEatInput, "Ichiran Ramen{Enter}");
    await user.click(submitButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      mustEatRestaurants: ["Ichiran Ramen"],
      mustSeeAttractions: undefined,
    });
  });

  it("keeps must-see and must-eat chips independent (no cross-contamination)", async () => {
    const user = userEvent.setup();
    const { destinationInput, mustSeeInput, mustEatInput, onSubmit, submitButton } = renderForm();

    await user.type(destinationInput, "Tokyo");
    await user.type(mustSeeInput, "Shibuya Crossing{Enter}");
    await user.type(mustSeeInput, "Senso-ji{Enter}");
    await user.type(mustEatInput, "Ichiran Ramen{Enter}");

    await user.click(submitButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      mustSeeAttractions: ["Shibuya Crossing", "Senso-ji"],
      mustEatRestaurants: ["Ichiran Ramen"],
    });
  });
});
