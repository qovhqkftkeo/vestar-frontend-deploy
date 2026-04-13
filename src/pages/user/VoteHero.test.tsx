import { render } from "@testing-library/react";
import { LanguageProvider } from "../../providers/LanguageProvider";
import type { VoteDetailData } from "../../types/vote";
import { VoteHero } from "./VoteHero";

vi.mock("../../providers/LanguageProvider", () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
  useLanguage: () => ({
    lang: "ko",
    t: (key: string) => ({ badge_end: "종료" })[key] ?? key,
  }),
}));

vi.mock("../../utils/ipfs", () => ({
  resolveIpfsUrl: (url: string) => url,
}));

const baseVote: VoteDetailData = {
  id: "test-1",
  title: "Test Vote",
  org: "Test Org",
  host: "Test Host",
  verified: false,
  emoji: "🎵",
  badge: "live",
  imageUrl: "ipfs://QmTestHash",
  participantCount: 1000,
  voteFrequency: "Daily",
  voteLimit: "1 per day",
  deadlineLabel: "2d left",
  urgent: false,
  startDate: "2026-04-01",
  endDate: "2026-04-10",
  endDateISO: "2026-04-10T00:00:00.000Z",
  resultReveal: "2026-04-11",
  minKarmaTier: 0,
  maxChoices: 1,
  goalVotes: 5000,
  ballotPolicy: "ONE_PER_ELECTION",
  resetIntervalSeconds: 0,
  timezoneWindowOffset: 0,
  resultPublic: true,
  candidates: [],
  sections: [],
  paymentMode: "FREE",
  visibilityMode: "OPEN",
};

function renderHero(vote: VoteDetailData = baseVote) {
  const { container } = render(
    <LanguageProvider>
      <VoteHero vote={vote} />
    </LanguageProvider>,
  );
  return container.firstElementChild as HTMLElement;
}

describe("VoteHero — layout", () => {
  /**
   * Regression: the hero image was hidden under the header because a negative
   * margin-top pulled the entire component up into the header area.
   * After the fix the component should sit naturally below the header.
   */
  it("does NOT slide under the header via negative margin-top", () => {
    const hero = renderHero();
    expect(hero.className).not.toContain("margin-top:calc(var(--header-h)*-1)");
  });

  it("does NOT add header-height to its top padding (parent layout already offsets)", () => {
    const hero = renderHero();
    // Before fix: pt-[calc(var(--header-h)+24px)] double-counts the header offset.
    // After fix: simple pt-6 (24 px) is enough because <main> already has pt-[var(--header-h)].
    expect(hero.className).not.toContain("var(--header-h)+24px");
  });

  it("renders the cover image when imageUrl is provided", () => {
    const hero = renderHero();
    const img = hero.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute("class")).toContain("object-cover");
  });

  it("renders a gradient fallback when imageUrl is absent", () => {
    const hero = renderHero({ ...baseVote, imageUrl: undefined });
    const img = hero.querySelector("img");
    expect(img).not.toBeInTheDocument();
    // fallback gradient div should be present
    const fallback = hero.querySelector('[class*="linear-gradient"]');
    expect(fallback).toBeInTheDocument();
  });

  it("uses the active participation copy for live votes", () => {
    const { container } = render(<VoteHero vote={baseVote} />);
    expect(container.textContent).toContain("1,000명 참여 중");
  });
});
