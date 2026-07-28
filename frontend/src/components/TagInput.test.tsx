import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagInput } from "./TagInput";

function setup(values: string[] = []) {
  const onChange = vi.fn();
  const utils = render(<TagInput values={values} onChange={onChange} placeholder="Add a tag" />);
  const input = utils.container.querySelector("input") as HTMLInputElement;
  return { onChange, input, ...utils };
}

describe("TagInput", () => {
  it("typing text and pressing Enter adds a chip and clears the draft input", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();

    await user.type(input, "Museums{Enter}");

    expect(onChange).toHaveBeenCalledWith(["Museums"]);
    expect(input.value).toBe("");
  });

  it("pressing Enter with an empty/whitespace-only draft does not add a chip", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();

    await user.type(input, "{Enter}");
    expect(onChange).not.toHaveBeenCalled();

    await user.type(input, "   {Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("typing a value that already exists and pressing Enter does not add a duplicate", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup(["Museums"]);

    await user.type(input, "Museums{Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clicking a chip's remove button removes only that chip", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(["Museums", "Parks", "Beaches"]);

    await user.click(screen.getByRole("button", { name: "Remove Parks" }));

    expect(onChange).toHaveBeenCalledWith(["Museums", "Beaches"]);
  });

  it("Backspace with an empty draft removes the last chip", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup(["Museums", "Parks"]);

    input.focus();
    await user.keyboard("{Backspace}");

    expect(onChange).toHaveBeenCalledWith(["Museums"]);
  });

  it("Backspace with draft text edits the text normally without removing a chip", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup(["Museums"]);

    await user.type(input, "Parks");
    onChange.mockClear();
    await user.type(input, "{Backspace}");

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("Park");
  });

  it("blurring the input with unsubmitted draft text commits it as a chip", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();

    await user.type(input, "Ramen");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(["Ramen"]);
  });
});
