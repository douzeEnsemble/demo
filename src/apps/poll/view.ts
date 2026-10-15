import type { DemoContext } from "../../apps";
import { escapeHtml } from "../../lib/dom";
import { formatLongDate, formatShortDate, plural } from "../../lib/format";
import { icons } from "../../lib/icons";
import { createRng } from "../../lib/random";
import { castVote, generatePoll, MAX_MULTIPLE_CHOICES, MAX_VOTER_LENGTH, setClosed, tally, type PollState, type VoteError } from "./generator";

const VOTE_ERRORS: Record<VoteError, string> = {
  closed: "Le sondage est clos.",
  noName: "Indique ton nom pour voter.",
  nameTooLong: `${MAX_VOTER_LENGTH} caractères maximum pour le nom.`,
  noChoice: "Choisis au moins une réponse.",
  tooManyChoices: `${MAX_MULTIPLE_CHOICES} réponses maximum.`,
  unknownChoice: "Réponse inconnue.",
};

const RECENT_VOTES = 8;

export function mountPoll(root: HTMLElement, ctx: DemoContext): () => void {
  let poll: PollState = generatePoll(createRng(ctx.seed), ctx.today);
  const inputType = poll.multiple ? "checkbox" : "radio";

  root.innerHTML = `
    <section class="card">
      <h2>${escapeHtml(poll.question)}</h2>
      <p class="muted">${escapeHtml(poll.description)}</p>
      <p class="meta-line" id="poll-meta"></p>
      <form id="poll-form" class="poll-form">
        <fieldset>
          <legend class="visually-hidden">Réponses</legend>
          ${poll.options
            .map(
              (o) => `
            <label class="choice">
              <input type="${inputType}" name="choice" value="${escapeHtml(o.id)}" />
              <span>${escapeHtml(o.label)}</span>
            </label>`,
            )
            .join("")}
        </fieldset>
        <div class="row">
          <input id="poll-voter" type="text" placeholder="Ton nom" maxlength="${MAX_VOTER_LENGTH}" aria-label="Ton nom" autocomplete="name" />
          <button type="submit" class="btn primary" id="poll-submit">Voter</button>
        </div>
        <p class="form-message" id="poll-message" aria-live="polite" hidden></p>
      </form>
    </section>

    <section class="card">
      <div class="card-heading">
        <h2>Résultats</h2>
        <button type="button" class="btn small" id="poll-toggle-closed"></button>
      </div>
      <ol class="results" id="poll-results"></ol>
    </section>

    <section class="card">
      <h2>${icons.users} Derniers votes</h2>
      <ul class="history-list" id="poll-recent"></ul>
    </section>
  `;

  const form = root.querySelector<HTMLFormElement>("#poll-form")!;
  const voterInput = root.querySelector<HTMLInputElement>("#poll-voter")!;
  const message = root.querySelector<HTMLElement>("#poll-message")!;
  const toggleClosed = root.querySelector<HTMLButtonElement>("#poll-toggle-closed")!;

  const optionLabel = (id: string): string => poll.options.find((o) => o.id === id)!.label;

  function showMessage(text: string, kind: "error" | "success"): void {
    message.textContent = text;
    message.className = `form-message ${kind}`;
    message.hidden = false;
  }

  function render(): void {
    const voters = poll.votes.length;
    root.querySelector("#poll-meta")!.innerHTML = `
      <span>${icons.users} ${plural(voters, "votant")}</span>
      <span>${icons.calendar} ${poll.closed ? "Clos" : `Clôture le ${formatLongDate(poll.closesOn)}`}</span>
      <span>${poll.multiple ? `Jusqu'à ${MAX_MULTIPLE_CHOICES} réponses` : "Une seule réponse"}</span>`;

    form.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button").forEach((el) => (el.disabled = poll.closed));
    toggleClosed.innerHTML = poll.closed ? `${icons.lock}<span>Rouvrir</span>` : `${icons.lock}<span>Clore le sondage</span>`;

    root.querySelector("#poll-results")!.innerHTML = tally(poll)
      .map(
        (row) => `
        <li class="result${row.leading ? " leading" : ""}">
          <div class="result-label">
            <span>${escapeHtml(row.option.label)}</span>
            <span class="result-count">${plural(row.count, "voix", "voix")} · ${row.percent} %</span>
          </div>
          <div class="bar" role="presentation"><div class="bar-fill" style="width: ${row.percent}%"></div></div>
        </li>`,
      )
      .join("");

    const recent = poll.votes.slice(-RECENT_VOTES).reverse();
    root.querySelector("#poll-recent")!.innerHTML = recent.length
      ? recent
          .map(
            (v) => `
          <li>
            <span><strong>${escapeHtml(v.voter)}</strong> — ${v.choices.map((c) => escapeHtml(optionLabel(c))).join(", ")}</span>
            <span class="muted">${formatShortDate(v.date)}</span>
          </li>`,
          )
          .join("")
      : `<li class="muted">Aucun vote pour l'instant.</li>`;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const choices = Array.from(form.querySelectorAll<HTMLInputElement>("input[name=choice]:checked"), (input) => input.value);
    const result = castVote(poll, voterInput.value, choices, ctx.today);
    if (typeof result === "string") {
      showMessage(VOTE_ERRORS[result], "error");
      return;
    }
    poll = result.poll;
    const voter = poll.votes[poll.votes.length - 1].voter;
    form.reset();
    render();
    showMessage(result.replaced ? `Vote de ${voter} mis à jour.` : `Merci ${voter}, ton vote est enregistré !`, "success");
  });

  toggleClosed.addEventListener("click", () => {
    poll = setClosed(poll, !poll.closed);
    message.hidden = true;
    render();
  });

  render();
  return () => {};
}
