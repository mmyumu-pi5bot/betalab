import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { LanguageSwitcher } from "@/components/language-switcher";
import { localeStorageKey, useT } from "@/lib/i18n";

// A consumer rendered next to the switcher, so the assertions cover the choice
// reaching the rest of the interface rather than only the control's own state.
function SwitcherWithConsumer() {
  const t = useT();
  return (
    <div>
      <LanguageSwitcher />
      <p data-testid="consumer">{t("home.experiments")}</p>
    </div>
  );
}

// Addressed by test id rather than by name: the trigger's name is the current
// language, which is precisely what these tests are checking.
function trigger() {
  return screen.getByTestId("language-switcher-trigger");
}

function options() {
  return within(screen.getByRole("group"));
}

async function openMenu() {
  await userEvent.setup().click(trigger());
}

async function chooseLanguage(name: RegExp) {
  await openMenu();
  await userEvent.setup().click(options().getByRole("button", { name }));
}

describe("LanguageSwitcher", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("names the current language on the closed control", () => {
    render(<SwitcherWithConsumer />);

    expect(trigger()).toHaveTextContent("English");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("lists both languages once opened, marking the current one", async () => {
    render(<SwitcherWithConsumer />);

    await openMenu();

    expect(options().getByRole("button", { name: /English/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(options().getByRole("button", { name: /Français/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switches the interface and remembers the choice in the browser", async () => {
    render(<SwitcherWithConsumer />);

    await chooseLanguage(/Français/);

    expect(window.localStorage.getItem(localeStorageKey)).toBe("fr");
    expect(trigger()).toHaveTextContent("Français");
    expect(screen.getByTestId("consumer")).toHaveTextContent("Expériences");

    // The chosen locale is process-wide state, so this test hands it back.
    await chooseLanguage(/English/);
  });

  it("closes on Escape without changing the language", async () => {
    const user = userEvent.setup();
    render(<SwitcherWithConsumer />);

    await openMenu();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByTestId("consumer")).toHaveTextContent("Experiments");
  });

  // Nothing spells the flags out, so a broken one would leave the row looking
  // blank without failing any of the assertions above.
  it("shows a flag beside every language", async () => {
    render(<SwitcherWithConsumer />);

    await openMenu();

    for (const name of [/English/, /Français/]) {
      expect(
        options().getByRole("button", { name }).querySelector("svg"),
      ).toBeInTheDocument();
    }
  });
});
