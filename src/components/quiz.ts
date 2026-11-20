import { QuizSpec } from '../core/types';
import { RenderContext } from './index';
import { clear, h } from '../core/dom';
import { iconEl } from '../core/icons';

export function renderQuiz(spec: QuizSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-quiz-card' });

  const questions = spec.questions || [];

  function build(): void {
    clear(card);

    let answeredCount = 0;
    let correctCount = 0;

    // Header row
    const header = h('div', { class: 'iui-quiz-header' });
    const titleEl = spec.title
      ? h('div', { class: 'iui-title iui-quiz-title' }, spec.title)
      : h('div', { class: 'iui-quiz-title-empty' });
    header.appendChild(titleEl);

    const headerRight = h('div', { class: 'iui-quiz-header-right' });
    const counterChip = h(
      'span',
      { class: 'iui-chip c-stone iui-quiz-counter', 'aria-live': 'polite' },
      `0/${questions.length}`,
    );
    const scoreChip = h(
      'span',
      { class: 'iui-chip c-lavender iui-quiz-score' },
      'Score 0',
    );
    scoreChip.style.display = 'none';

    headerRight.appendChild(counterChip);
    headerRight.appendChild(scoreChip);
    header.appendChild(headerRight);
    card.appendChild(header);

    // Questions list
    const questionsContainer = h('div', { class: 'iui-quiz-questions' });

    for (let qIdx = 0; qIdx < questions.length; qIdx++) {
      const qObj = questions[qIdx];
      const qCard = h('div', { class: 'iui-quiz-q-card' });

      // Question caption
      const caption = h('div', { class: 'iui-quiz-q-caption' }, `Question ${qIdx + 1}`);
      qCard.appendChild(caption);

      // Question text
      const qText = h('div', { class: 'iui-quiz-q-text' }, qObj.q);
      qCard.appendChild(qText);

      // Options
      const optionsContainer = h('div', { class: 'iui-quiz-options' });
      const qButtons: HTMLButtonElement[] = [];
      const chipContainers: HTMLElement[] = [];
      let isQuestionLocked = false;

      const opts = qObj.options || [];
      for (let optIdx = 0; optIdx < opts.length; optIdx++) {
        const optText = opts[optIdx];
        const letter = String.fromCharCode(65 + optIdx);

        const letterBadge = h('span', { class: 'iui-quiz-letter' }, letter);
        const textSpan = h('span', { class: 'iui-quiz-opt-text' }, optText);
        const chipContainer = h('span', { class: 'iui-quiz-opt-chip' });
        chipContainers.push(chipContainer);

        const optBtn = h(
          'button',
          {
            type: 'button',
            class: 'iui-btn secondary iui-quiz-opt-btn',
            onClick: () => {
              if (isQuestionLocked) return;
              isQuestionLocked = true;

              // Lock options for this question
              for (const btn of qButtons) {
                btn.disabled = true;
              }

              const isPickCorrect = optIdx === qObj.answer;
              answeredCount++;
              if (isPickCorrect) {
                correctCount++;
              }

              // Update counter & score
              counterChip.textContent = `${answeredCount}/${questions.length}`;
              scoreChip.textContent = `Score ${correctCount}`;
              scoreChip.style.display = 'inline-flex';

              // Highlight correct option
              const correctBtn = qButtons[qObj.answer];
              if (correctBtn) {
                correctBtn.classList.add('is-correct', 'c-green');
                const correctChip = h(
                  'span',
                  { class: 'iui-chip c-green iui-quiz-chip' },
                  iconEl('check', 13),
                  h('span', {}, 'Correct'),
                );
                chipContainers[qObj.answer].appendChild(correctChip);
              }

              // Highlight incorrect option if pick was wrong
              if (!isPickCorrect) {
                optBtn.classList.add('is-incorrect', 'c-red');
                const incorrectChip = h(
                  'span',
                  { class: 'iui-chip c-red iui-quiz-chip' },
                  iconEl('x', 13),
                  h('span', {}, 'Incorrect'),
                );
                chipContainer.appendChild(incorrectChip);
              }

              // Show explain text if available
              if (qObj.explain) {
                const explainBox = h(
                  'div',
                  { class: 'iui-card tinted c-stone iui-quiz-explain' },
                  h('span', { class: 'iui-quiz-explain-icon' }, iconEl('info', 16)),
                  h('div', { class: 'iui-quiz-explain-text' }, qObj.explain),
                );
                qCard.appendChild(explainBox);
              }

              // If all questions are answered, show result banner
              if (answeredCount === questions.length) {
                const fraction = correctCount / questions.length;
                let toneClass = 'c-red';
                if (correctCount === questions.length) {
                  toneClass = 'c-green';
                } else if (fraction >= 0.5) {
                  toneClass = 'c-butter';
                }

                const banner = h(
                  'div',
                  { class: `iui-card tinted ${toneClass} iui-quiz-result-banner` },
                  h(
                    'span',
                    { class: 'iui-quiz-result-text' },
                    `You scored ${correctCount}/${questions.length}`,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'iui-btn iui-quiz-retry-btn',
                      onClick: () => {
                        build();
                      },
                    },
                    'Retry',
                  ),
                );
                card.appendChild(banner);
              }
            },
          },
          letterBadge,
          textSpan,
          chipContainer,
        );

        qButtons.push(optBtn);
        optionsContainer.appendChild(optBtn);
      }

      qCard.appendChild(optionsContainer);
      questionsContainer.appendChild(qCard);
    }

    card.appendChild(questionsContainer);
  }

  build();
  return card;
}
