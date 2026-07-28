import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { AiSuggestions } from "./AiSuggestions";
import { api } from "@/lib/api";
import zh from "@/lib/i18n/zh.json";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>;

const SUGGESTIONS = [
  { id: "a", label: "Best time to visit?", question: "What is the best time to visit Tokyo?" },
  { id: "b", label: "Local food?", question: "What local food should I try in Tokyo?" },
];

function renderWidget() {
  return render(
    <LocaleProvider>
      <AiSuggestions destination="Tokyo" days={3} />
    </LocaleProvider>
  );
}

// Sets up the mocked quick-suggestions load call and renders the two chips.
async function openSuggestionsList() {
  mockedPost.mockImplementationOnce(() => Promise.resolve({ suggestions: SUGGESTIONS }));
  const user = userEvent.setup();
  renderWidget();
  await user.click(screen.getByRole("button", { name: zh["aiSuggestions.cta"] }));
  await waitFor(() => expect(screen.getByText("Best time to visit?")).toBeInTheDocument());
  mockedPost.mockClear(); // discard the quick-suggestions load call, only count quick-answer calls below
  return user;
}

// A controllable, externally resolvable/rejectable promise for interleaving requests.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("AiSuggestions per-question answer state", () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it("clicking a suggestion calls quick-answer once and shows the returned answer", async () => {
    const user = await openSuggestionsList();
    mockedPost.mockImplementationOnce(() => Promise.resolve({ answer: "Spring is best." }));

    await user.click(screen.getByRole("button", { name: "Best time to visit?" }));

    expect(mockedPost).toHaveBeenCalledWith(
      "/ai/quick-answer",
      expect.objectContaining({ question: SUGGESTIONS[0].question })
    );
    await waitFor(() => expect(screen.getByText("Spring is best.")).toBeInTheDocument());
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it("clicking the same suggestion again after it resolved does not re-call the API", async () => {
    const user = await openSuggestionsList();
    mockedPost.mockImplementationOnce(() => Promise.resolve({ answer: "Spring is best." }));

    await user.click(screen.getByRole("button", { name: "Best time to visit?" }));
    await waitFor(() => expect(screen.getByText("Spring is best.")).toBeInTheDocument());
    expect(mockedPost).toHaveBeenCalledTimes(1);

    // close modal
    await user.click(screen.getByText("×"));
    // reopen the same suggestion
    await user.click(screen.getByRole("button", { name: "Best time to visit?" }));

    expect(screen.getByText("Spring is best.")).toBeInTheDocument();
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it("reopening a suggestion still in flight does not trigger a second call", async () => {
    const user = await openSuggestionsList();
    const d = deferred<{ answer: string }>();
    mockedPost.mockImplementationOnce(() => d.promise);

    await user.click(screen.getByRole("button", { name: "Best time to visit?" }));
    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(screen.getByText(zh["common.loading"])).toBeInTheDocument();

    // close modal while still loading
    await user.click(screen.getByText("×"));
    // reopen same suggestion before the request resolves
    await user.click(screen.getByRole("button", { name: "Best time to visit?" }));

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(screen.getByText(zh["common.loading"])).toBeInTheDocument();

    d.resolve({ answer: "Spring is best." });
    await waitFor(() => expect(screen.getByText("Spring is best.")).toBeInTheDocument());
  });

  it("interleaved requests for two different suggestions each resolve to their own answer, not each other's", async () => {
    const user = await openSuggestionsList();
    const dA = deferred<{ answer: string }>();
    const dB = deferred<{ answer: string }>();
    mockedPost.mockImplementationOnce(() => dA.promise);

    // click A, then close modal before it resolves
    await user.click(screen.getByRole("button", { name: "Best time to visit?" }));
    await user.click(screen.getByText("×"));

    // click B (different question) while A is still in flight
    mockedPost.mockImplementationOnce(() => dB.promise);
    await user.click(screen.getByRole("button", { name: "Local food?" }));
    await user.click(screen.getByText("×"));

    expect(mockedPost).toHaveBeenCalledTimes(2);

    // resolve B first, then A, out of click order
    dB.resolve({ answer: "Try ramen and sushi." });
    dA.resolve({ answer: "Spring is best." });

    await user.click(screen.getByRole("button", { name: "Best time to visit?" }));
    await waitFor(() => expect(screen.getByText("Spring is best.")).toBeInTheDocument());
    await user.click(screen.getByText("×"));

    await user.click(screen.getByRole("button", { name: "Local food?" }));
    await waitFor(() => expect(screen.getByText("Try ramen and sushi.")).toBeInTheDocument());
  });

  it("an error on one suggestion doesn't affect another's state, and retrying the errored one re-calls the API", async () => {
    const user = await openSuggestionsList();
    mockedPost.mockImplementationOnce(() => Promise.reject(new Error("boom")));

    await user.click(screen.getByRole("button", { name: "Best time to visit?" }));
    await waitFor(() => expect(screen.getByText(zh["aiSuggestions.error"])).toBeInTheDocument());
    await user.click(screen.getByText("×"));

    // the other suggestion is unaffected and still fetches normally
    mockedPost.mockImplementationOnce(() => Promise.resolve({ answer: "Try ramen and sushi." }));
    await user.click(screen.getByRole("button", { name: "Local food?" }));
    await waitFor(() => expect(screen.getByText("Try ramen and sushi.")).toBeInTheDocument());
    await user.click(screen.getByText("×"));

    expect(mockedPost).toHaveBeenCalledTimes(2);

    // retry the errored suggestion — since it's "error", not "loading"/"done", it should re-fetch
    mockedPost.mockImplementationOnce(() => Promise.resolve({ answer: "Spring is best on retry." }));
    await user.click(screen.getByRole("button", { name: "Best time to visit?" }));
    expect(mockedPost).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(screen.getByText("Spring is best on retry.")).toBeInTheDocument());
  });
});
